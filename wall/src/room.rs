//! Pairs with the hub using a one-use display invitation, keeps the Wall's
//! session cookie (owner-only file), and follows the room's live state stream.
//! Trusted HTTPS is required except on this computer's loopback address; the
//! operating system's trust store decides, with no certificate bypass.
use crate::model::{self, Room};
use serde_json::Value;
use std::{fs, path::PathBuf, sync::{mpsc, Arc}, thread, time::Duration};
use tungstenite::{ClientRequestBuilder, Message};
use ureq::tls::{RootCerts, TlsConfig};

pub struct Picture {
    /// The request key: an image's asset id, or `pdf:<asset>:<page>`.
    pub asset: String,
    /// For PDF pages, how many pages the document has.
    pub pages: Option<u32>,
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

impl std::fmt::Debug for Picture {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Picture({}, {}x{})", self.asset, self.width, self.height)
    }
}

/// The Wall's authenticated session, shared with the media connections.
pub struct Session {
    agent: ureq::Agent,
    target: Target,
    cookie: String,
}

impl std::fmt::Debug for Session {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Session({})", self.target.room)
    }
}

impl Session {
    /// Asks the hub for a view-only grant to one live window.
    pub fn media_grant(&self, stream: &str, csrf: &str) -> Result<crate::media::Grant, String> {
        let mut response = self
            .agent
            .post(&format!("{}/api/rooms/{}/streams/{}/media", self.target.base, self.target.room, stream))
            .header("Cookie", &self.cookie)
            .header("X-Borderless-CSRF", csrf)
            .header("Content-Type", "application/json")
            .send(b"{}".as_slice())
            .map_err(|_| "Media unavailable".to_string())?;
        if !response.status().is_success() {
            return Err(format!("Media unavailable ({})", response.status().as_u16()));
        }
        let text = response.body_mut().with_config().limit(64 * 1024).read_to_string().map_err(|_| "Media unavailable".to_string())?;
        let v: Value = serde_json::from_str(&text).map_err(|_| "Media unavailable".to_string())?;
        if v.get("publisher").and_then(Value::as_bool) != Some(false) {
            return Err("View this window from a separate Wall session.".into());
        }
        let url = v.get("url").and_then(Value::as_str).ok_or("Media unavailable")?;
        let token = v.get("token").and_then(Value::as_str).ok_or("Media unavailable")?;
        let parsed = url::Url::parse(url).map_err(|_| "Invalid media address.".to_string())?;
        let host = parsed.host_str().unwrap_or("");
        if !(parsed.scheme() == "wss" || (parsed.scheme() == "ws" && loopback(host))) || !parsed.username().is_empty() || parsed.password().is_some() {
            return Err("Trusted media transport is required.".into());
        }
        Ok(crate::media::Grant { url: url.to_owned(), token: token.to_owned() })
    }
}

#[derive(Debug)]
pub enum RoomEvent {
    /// The session is ready; live windows can now ask for media grants.
    Session(Arc<Session>),
    /// A live window has a new frame waiting.
    Frame,
    /// A room video or audio file is saved locally (owner-only) and ready to open.
    MovieFile { asset: String, path: PathBuf },
    /// A decoded room image, at most 2048 px on its longest side.
    Picture(Picture),
    State(Room),
    Status(String),
    /// Short-lived room events (transfer progress) passed through as JSON.
    #[allow(dead_code)] // consumed by the arrival effect in the next slice
    Live(Value),
}

#[derive(Clone, Debug, PartialEq)]
pub struct Target {
    pub base: String,
    pub room: String,
    pub pair: Option<String>,
}

fn loopback(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "[::1]" | "::1")
}

/// Accepts the invitation the leader copies from the Console.
pub fn target(link: &str) -> Result<Target, String> {
    let url = url::Url::parse(link.trim()).map_err(|_| "Paste the complete Wall invitation link.".to_string())?;
    let host = url.host_str().ok_or("The link has no host.")?;
    if !url.username().is_empty() || url.password().is_some() || url.query().is_some() {
        return Err("Use the Wall invitation exactly as the leader copied it.".into());
    }
    if url.scheme() != "https" && !(url.scheme() == "http" && loopback(host)) {
        return Err("Use a trusted HTTPS Wall invitation outside this computer.".into());
    }
    let segments: Vec<&str> = url.path_segments().map(|s| s.collect()).unwrap_or_default();
    let room = match segments.as_slice() {
        ["app", "wall", r] | ["wall", r] => r.to_string(),
        _ => return Err("This is not a Wall invitation.".into()),
    };
    if !(8..=48).contains(&room.len()) || !room.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("This is not a Wall invitation.".into());
    }
    let pair = url.fragment().and_then(|f| f.strip_prefix("pair=")).map(str::to_owned);
    let mut base = format!("{}://{}", url.scheme(), host);
    if let Some(port) = url.port() {
        base.push_str(&format!(":{port}"));
    }
    Ok(Target { base, room, pair })
}

/// Where this Wall keeps its session and last room (owner-only files).
pub fn home() -> PathBuf {
    std::env::var_os("BORDERLESS_WALL_HOME").map(PathBuf::from).unwrap_or_else(|| {
        let home = std::env::var_os("HOME").or_else(|| std::env::var_os("APPDATA")).map(PathBuf::from).unwrap_or_default();
        if cfg!(target_os = "macos") { home.join("Library/Application Support/Borderless Wall") } else { home.join(".config/borderless-wall") }
    })
}

fn session_file(t: &Target) -> PathBuf {
    let key: String = format!("{}_{}", t.base, t.room).chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    home().join("sessions").join(format!("{key}.cookie"))
}

/// Remembers the room (never the one-use token) and display for the next start.
pub fn remember(t: &Target, display: Option<usize>) {
    let value = serde_json::json!({ "base": t.base, "room": t.room, "display": display });
    if let Err(e) = save_cookie(&home().join("last.json"), &value.to_string()) {
        log::warn!("Last room not saved: {e}");
    }
}

/// The room and display this Wall last showed, if it has a saved session for it.
pub fn last() -> Option<(Target, Option<usize>)> {
    let v: Value = serde_json::from_str(&fs::read_to_string(home().join("last.json")).ok()?).ok()?;
    let t = target(&format!("{}/app/wall/{}", v["base"].as_str()?, v["room"].as_str()?)).ok()?;
    session_file(&t).exists().then(|| (t, v["display"].as_u64().map(|d| d as usize)))
}

fn save_cookie(path: &PathBuf, cookie: &str) -> std::io::Result<()> {
    fs::create_dir_all(path.parent().unwrap())?;
    fs::write(path, cookie)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .tls_config(TlsConfig::builder().root_certs(RootCerts::PlatformVerifier).build())
        .http_status_as_error(false)
        .timeout_global(Some(Duration::from_secs(10)))
        .build()
        .into()
}

fn pair(agent: &ureq::Agent, t: &Target, token: &str) -> Result<String, String> {
    let body = serde_json::json!({ "token": token, "name": "Wall" }).to_string();
    let response = agent
        .post(&format!("{}/api/rooms/{}/wall-pair", t.base, t.room))
        .header("Content-Type", "application/json")
        .send(body.as_bytes())
        .map_err(|e| format!("Could not reach the room: {e}"))?;
    if !response.status().is_success() {
        return Err("This invitation has already been used or has expired. Ask the leader for a new one.".into());
    }
    let name = format!("borderless_{}=", t.room);
    response
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .find_map(|v| v.split(';').next().filter(|c| c.starts_with(&name)).map(str::to_owned))
        .ok_or_else(|| "The room did not issue a Wall session.".to_string())
}

fn state(agent: &ureq::Agent, t: &Target, cookie: &str) -> Result<Value, u16> {
    let mut response = agent
        .get(&format!("{}/api/rooms/{}/state", t.base, t.room))
        .header("Cookie", cookie)
        .header("Cache-Control", "no-store")
        .call()
        .map_err(|_| 0u16)?;
    if !response.status().is_success() {
        return Err(response.status().as_u16());
    }
    let text = response.body_mut().with_config().limit(4 * 1024 * 1024).read_to_string().map_err(|_| 0u16)?;
    serde_json::from_str(&text).map_err(|_| 0)
}

/// Runs for the life of the Wall on its own thread.
fn download(agent: &ureq::Agent, t: &Target, cookie: &str, asset: &str) -> Option<Vec<u8>> {
    agent
        .get(&format!("{}/api/rooms/{}/assets/{}", t.base, t.room, asset))
        .header("Cookie", cookie)
        .call()
        .ok()
        .filter(|r| r.status().is_success())
        .and_then(|mut r| r.body_mut().with_config().limit(25 * 1024 * 1024).read_to_vec().ok())
}

/// PDFium is loaded from the app bundle's Frameworks, next to the executable,
/// `BORDERLESS_PDFIUM`, or the development copy fetched by scripts/fetch-pdfium.mjs.
fn pdfium() -> Option<pdfium_render::prelude::Pdfium> {
    use pdfium_render::prelude::Pdfium;
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?.to_path_buf();
    let platform = format!("{}-{}", if cfg!(target_os = "macos") { "darwin" } else if cfg!(windows) { "win32" } else { "linux" }, if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" });
    let candidates = [
        std::env::var_os("BORDERLESS_PDFIUM").map(PathBuf::from),
        Some(dir.join("../Frameworks")),
        Some(dir.clone()),
        Some(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("vendor/pdfium").join(platform).join("lib")),
    ];
    candidates.into_iter().flatten().find_map(|d| Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&d)).ok()).map(Pdfium::new)
}

/// Downloads room images and renders PDF pages on request, using the Wall's
/// session. Only the hub's accepted image formats and PDFs are decoded.
fn pictures(agent: ureq::Agent, t: Target, cookie: String, requests: mpsc::Receiver<String>, send: Arc<dyn Fn(RoomEvent) + Send + Sync>) {
    thread::spawn(move || {
        let mut pdf_engine = None;
        let mut documents: Vec<(String, Vec<u8>)> = Vec::new();
        for key in requests {
            if let Some(rest) = key.strip_prefix("movie:") {
                let Some((asset, ext)) = rest.split_once(':') else { continue };
                if !matches!(ext, "mp4" | "mov" | "m4v" | "mp3" | "m4a" | "wav" | "aac") {
                    continue;
                }
                let Some(bytes) = download(&agent, &t, &cookie, asset) else { continue };
                let path = home().join("media").join(format!("{asset}.{ext}"));
                if save_cookie(&path, "").and_then(|_| fs::write(&path, &bytes)).is_ok() {
                    send(RoomEvent::MovieFile { asset: asset.to_owned(), path });
                }
                continue;
            }
            if let Some(rest) = key.strip_prefix("pdf:") {
                let Some((asset, page)) = rest.split_once(':') else { continue };
                let Ok(page) = page.parse::<i32>() else { continue };
                if pdf_engine.is_none() {
                    pdf_engine = pdfium();
                    if pdf_engine.is_none() {
                        log::warn!("PDFium is not available; PDF pages cannot be shown.");
                    }
                }
                let Some(engine) = &pdf_engine else { continue };
                if !documents.iter().any(|(a, _)| a == asset) {
                    let Some(bytes) = download(&agent, &t, &cookie, asset) else { continue };
                    documents.push((asset.to_owned(), bytes));
                    if documents.len() > 4 {
                        documents.remove(0);
                    }
                }
                let bytes = documents.iter().find(|(a, _)| a == asset).map(|(_, b)| b.clone()).unwrap();
                let Ok(document) = engine.load_pdf_from_byte_vec(bytes, None) else { continue };
                let pages = document.pages().len();
                let index = (page - 1).clamp(0, (pages - 1).max(0));
                let Ok(p) = document.pages().get(index) else { continue };
                let config = pdfium_render::prelude::PdfRenderConfig::new().set_target_width(2048).set_maximum_height(2048);
                let Ok(bitmap) = p.render_with_config(&config) else { continue };
                let (width, height) = (bitmap.width() as u32, bitmap.height() as u32);
                send(RoomEvent::Picture(Picture { asset: key.clone(), pages: Some(pages as u32), width, height, rgba: bitmap.as_rgba_bytes() }));
                continue;
            }
            let Some(bytes) = download(&agent, &t, &cookie, &key) else { continue };
            let Ok(image) = image::load_from_memory(&bytes) else { continue };
            let image = if image.width().max(image.height()) > 2048 { image.resize(2048, 2048, image::imageops::FilterType::Lanczos3) } else { image };
            let rgba = image.to_rgba8();
            send(RoomEvent::Picture(Picture { asset: key, pages: None, width: rgba.width(), height: rgba.height(), rgba: rgba.into_raw() }));
        }
    });
}

/// Starts the room connection; returns where to ask for room images.
pub fn run(t: Target, send: impl Fn(RoomEvent) + Send + Sync + 'static) -> mpsc::Sender<String> {
    let (ask, requests) = mpsc::channel::<String>();
    let send: Arc<dyn Fn(RoomEvent) + Send + Sync> = Arc::new(send);
    thread::spawn(move || {
        let agent = agent();
        let file = session_file(&t);
        let cookie = match &t.pair {
            Some(token) => match pair(&agent, &t, token) {
                Ok(c) => {
                    if let Err(e) = save_cookie(&file, &c) {
                        log::warn!("Wall session not saved: {e}");
                    }
                    c
                }
                Err(e) => return send(RoomEvent::Status(e)),
            },
            None => match fs::read_to_string(&file) {
                Ok(c) => c.trim().to_owned(),
                Err(_) => return send(RoomEvent::Status("Pair this Wall using a fresh invitation from the room leader.".into())),
            },
        };
        pictures(agent.clone(), t.clone(), cookie.clone(), requests, send.clone());
        send(RoomEvent::Session(Arc::new(Session { agent: agent.clone(), target: t.clone(), cookie: cookie.clone() })));
        loop {
            match state(&agent, &t, &cookie) {
                Ok(v) => match model::parse(&t.room, &v) {
                    Ok(room) => send(RoomEvent::State(room)),
                    Err(e) => send(RoomEvent::Status(e.into())),
                },
                Err(401) | Err(403) => {
                    let _ = fs::remove_file(&file);
                    return send(RoomEvent::Status("This Wall was disconnected by the room. Pair it again with a fresh invitation.".into()));
                }
                Err(_) => {
                    send(RoomEvent::Status("Room unavailable · reconnecting…".into()));
                    thread::sleep(Duration::from_secs(3));
                    continue;
                }
            }
            let ws = t.base.replacen("http", "ws", 1);
            let uri = match format!("{ws}/api/rooms/{}/live", t.room).parse() {
                Ok(u) => u,
                Err(_) => return send(RoomEvent::Status("Invalid room address.".into())),
            };
            let request = ClientRequestBuilder::new(uri).with_header("Cookie", cookie.clone());
            match tungstenite::connect(request) {
                Ok((mut socket, _)) => {
                    send(RoomEvent::Status("Wall connected".into()));
                    loop {
                        match socket.read() {
                            Ok(Message::Text(text)) if text.len() <= 4 * 1024 * 1024 => {
                                let Ok(message) = serde_json::from_str::<Value>(&text) else { break };
                                match message.get("type").and_then(Value::as_str) {
                                    Some("state") => match model::parse(&t.room, &message["state"]) {
                                        Ok(room) => send(RoomEvent::State(room)),
                                        Err(e) => {
                                            send(RoomEvent::Status(e.into()));
                                            break;
                                        }
                                    },
                                    Some(kind) if kind.starts_with("transfer.") => send(RoomEvent::Live(message)),
                                    _ => {}
                                }
                            }
                            Ok(Message::Close(_)) | Err(_) => break,
                            Ok(_) => {}
                        }
                    }
                }
                Err(e) => log::warn!("Room stream unavailable: {e}"),
            }
            send(RoomEvent::Status("Room disconnected · reconnecting…".into()));
            thread::sleep(Duration::from_secs(3));
        }
    });
    ask
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_shared_and_old_invitations_and_refuses_untrusted_ones() {
        let t = target("https://room.local:8443/app/wall/abcdefgh12#pair=secret").unwrap();
        assert_eq!(t, Target { base: "https://room.local:8443".into(), room: "abcdefgh12".into(), pair: Some("secret".into()) });
        assert_eq!(target("https://room.local/wall/abcdefgh12").unwrap().pair, None);
        assert!(target("http://192.168.1.4:8443/app/wall/abcdefgh12").is_err());
        assert!(target("http://127.0.0.1:8455/app/wall/abcdefgh12").is_ok());
        assert!(target("https://u:p@room.local/app/wall/abcdefgh12").is_err());
        assert!(target("https://room.local/app/console/abcdefgh12").is_err());
        assert!(target("https://room.local/app/wall/short").is_err());
    }
}
