//! The hub's room snapshot, validated the same way the shared front end does.
//! The Wall holds no authority: it only renders what the hub sends.
use serde_json::Value;

#[derive(Clone, Debug, PartialEq)]
pub enum Kind {
    Live,
    /// `playback`: playing, position in seconds, and when the hub set it (ms since the epoch).
    File { asset_id: String, mime: String, page: u32, playback: Option<(bool, f64, f64)> },
    Link { url: String, host: String, site: String, description: String, pending: bool },
    Note { text: String },
}

#[derive(Clone, Debug, PartialEq)]
pub struct Surface {
    pub id: String,
    pub kind: Kind,
    pub title: String,
    pub owner_id: String,
    pub owner_name: String,
    pub colour: Option<String>,
    pub rect: [f32; 4],
    pub z: i64,
}

#[derive(Clone, Debug, Default)]
pub struct Room {
    /// This Wall's CSRF token for room commands (media grants).
    pub csrf: String,
    pub name: String,
    pub ended: bool,
    pub theme: Option<String>,
    pub surfaces: Vec<Surface>,
}

fn s(v: &Value, k: &str) -> Option<String> {
    v.get(k)?.as_str().map(str::to_owned)
}

fn rect(v: &Value) -> Option<[f32; 4]> {
    let mut r = [0.0f32; 4];
    for (i, k) in ["x", "y", "w", "h"].iter().enumerate() {
        let n = v.get(*k)?.as_f64()?;
        if !(0.0..=1.0).contains(&n) {
            return None;
        }
        r[i] = n as f32;
    }
    Some(r)
}

fn uuid(v: &str) -> bool {
    v.len() == 36 && v.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

pub fn parse(room_id: &str, value: &Value) -> Result<Room, &'static str> {
    if value.get("id").and_then(Value::as_str) != Some(room_id) {
        return Err("Room state does not match this Wall.");
    }
    let mut room = Room {
        name: s(value, "name").ok_or("Room state has no name.")?,
        ended: value.get("ended").and_then(Value::as_bool).ok_or("Room state is incomplete.")?,
        theme: s(value, "theme"),
        csrf: value.get("me").and_then(|m| s(m, "csrf")).unwrap_or_default(),
        surfaces: Vec::new(),
    };
    let streams = value.get("streams").and_then(Value::as_array).ok_or("Room state is incomplete.")?;
    if streams.len() > 6 {
        return Err("Too many live windows.");
    }
    for st in streams {
        if st.get("canReceive").and_then(Value::as_bool) != Some(true) {
            continue;
        }
        let (Some(id), Some(r)) = (s(st, "id"), rect(st)) else { return Err("Invalid live window.") };
        if !uuid(&id) {
            return Err("Invalid live window.");
        }
        room.surfaces.push(Surface {
            id,
            kind: Kind::Live,
            title: s(st, "title").unwrap_or_default(),
            owner_id: s(st, "ownerId").unwrap_or_default(),
            owner_name: s(st, "ownerName").unwrap_or_default(),
            colour: s(st, "colour"),
            rect: r,
            z: st.get("z").and_then(Value::as_i64).unwrap_or(0),
        });
    }
    for it in value.get("items").and_then(Value::as_array).ok_or("Room state is incomplete.")? {
        let (Some(id), Some(r)) = (s(it, "id"), rect(it)) else { continue };
        if !uuid(&id) {
            continue;
        }
        let kind = match it.get("kind").and_then(Value::as_str) {
            Some("file") => match (s(it, "assetId"), s(it, "mime")) {
                (Some(a), Some(m)) if uuid(&a) => Kind::File {
                    asset_id: a,
                    mime: m,
                    page: it.get("page").and_then(Value::as_u64).unwrap_or(1).clamp(1, 10_000) as u32,
                    playback: it.get("playback").and_then(|p| Some((p.get("playing")?.as_bool()?, p.get("position")?.as_f64()?.clamp(0.0, 86_400.0), p.get("at")?.as_f64()?))),
                },
                _ => continue,
            },
            Some("link") => {
                let Some(url) = s(it, "url").filter(|u| u.starts_with("https://") || u.starts_with("http://")) else { continue };
                Kind::Link {
                    url,
                    host: s(it, "host").unwrap_or_default(),
                    site: s(it, "site").unwrap_or_default(),
                    description: s(it, "description").unwrap_or_default(),
                    pending: it.get("preview").and_then(Value::as_str) == Some("pending"),
                }
            }
            Some("note") => Kind::Note { text: s(it, "text").unwrap_or_default() },
            _ => continue,
        };
        room.surfaces.push(Surface {
            id,
            kind,
            title: s(it, "title").unwrap_or_default(),
            owner_id: s(it, "ownerId").unwrap_or_default(),
            owner_name: s(it, "ownerName").unwrap_or_default(),
            colour: s(it, "colour"),
            rect: r,
            z: it.get("z").and_then(Value::as_i64).unwrap_or(0),
        });
    }
    room.surfaces.sort_by_key(|s| s.z);
    Ok(room)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    const ID: &str = "abcdefgh12";
    const U: &str = "0a1b2c3d-0000-4000-8000-000000000001";
    #[test]
    fn parses_files_notes_links_and_receivable_streams_only() {
        let v = json!({"id": ID, "name": "Room", "ended": false, "theme": "studio",
            "streams": [{"id": U, "canReceive": false, "x": 0, "y": 0, "w": 1, "h": 1}],
            "items": [
                {"id": U, "kind": "note", "title": "T", "text": "Hi", "ownerId": "o", "ownerName": "Ama", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2, "z": 2},
                {"id": U, "kind": "link", "url": "javascript:alert(1)", "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2},
                {"id": U, "kind": "file", "assetId": U, "mime": "image/png", "x": 0.1, "y": 0.1, "w": 2.0, "h": 0.2}
            ]});
        let room = parse(ID, &v).unwrap();
        assert_eq!(room.surfaces.len(), 1);
        assert_eq!(room.surfaces[0].kind, Kind::Note { text: "Hi".into() });
    }
    #[test]
    fn rejects_state_for_another_room() {
        assert!(parse(ID, &json!({"id": "other", "name": "x", "ended": false, "items": [], "streams": []})).is_err());
    }
}
