//! Pairs with the hub using a one-use display invitation, keeps the Wall's
//! session cookie (owner-only file), and follows the room's live state stream.
//! Trusted HTTPS is required except on this computer's loopback address; the
//! operating system's trust store decides, with no certificate bypass.
use crate::model::{self, Room};
use serde_json::Value;
use std::{fs, path::PathBuf, thread, time::Duration};
use tungstenite::{ClientRequestBuilder, Message};
use ureq::tls::{RootCerts, TlsConfig};

#[derive(Debug)]
pub enum RoomEvent {
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

fn session_file(t: &Target) -> PathBuf {
    let root = std::env::var_os("BORDERLESS_WALL_HOME").map(PathBuf::from).unwrap_or_else(|| {
        let home = std::env::var_os("HOME").or_else(|| std::env::var_os("APPDATA")).map(PathBuf::from).unwrap_or_default();
        if cfg!(target_os = "macos") { home.join("Library/Application Support/Borderless Wall") } else { home.join(".config/borderless-wall") }
    });
    let key: String = format!("{}_{}", t.base, t.room).chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    root.join("sessions").join(format!("{key}.cookie"))
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
pub fn run(t: Target, send: impl Fn(RoomEvent) + Send + 'static) {
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
