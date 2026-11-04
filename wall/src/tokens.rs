//! Design-system tokens, read from the single generated source
//! (`design-system/dist/tokens.json`) so the native Wall never drifts from the
//! Console and Portal.
use serde_json::Value;

pub type Rgba = [f32; 4];

pub struct Theme {
    pub dark: bool,
    pub wall: Rgba,
    pub wash_a: Rgba,
    pub wash_b: Rgba,
    pub grid: Rgba,
    pub surface: Rgba,
    pub ink: Rgba,
    pub ink_muted: Rgba,
    pub accent: Rgba,
    pub glass: Rgba,
    owners: Vec<Rgba>,
}

pub struct Tokens {
    json: Value,
    pub radius_window: f32,
}

const OWNER_ORDER: [&str; 8] = ["blue", "orange", "green", "pink", "purple", "teal", "gold", "indigo"];

impl Tokens {
    pub fn load() -> Self {
        let json: Value = serde_json::from_str(include_str!("../../design-system/dist/tokens.json"))
            .expect("design-system tokens are valid JSON");
        let radius_window = json["radius"]["window"].as_f64().unwrap_or(24.0) as f32;
        Self { json, radius_window }
    }

    /// The hub's legacy room modes map onto the four approved looks.
    pub fn theme(&self, room_theme: Option<&str>) -> Theme {
        let name = match room_theme.unwrap_or("") {
            "studio" | "synth" => "studio",
            "executive" => "executive",
            "command" => "tactical",
            _ => "whiteboard",
        };
        let t = &self.json["themes"][name];
        let c = &t["color"];
        let dark = t["mode"].as_str() == Some("dark");
        let get = |k: &str| parse_colour(c[k].as_str().unwrap_or("#000000"));
        let owners_json = &self.json["owners"][if dark { "dark" } else { "light" }];
        Theme {
            dark,
            wall: get("wall"),
            wash_a: get("wallWashA"),
            wash_b: get("wallWashB"),
            grid: get("grid"),
            surface: get("surface"),
            ink: get("ink"),
            ink_muted: get("inkMuted"),
            accent: get("accent"),
            glass: parse_colour(t["glass"]["fill"].as_str().unwrap_or("rgba(255,255,255,0.55)")),
            owners: OWNER_ORDER.iter().map(|k| parse_colour(owners_json[*k].as_str().unwrap_or("#0A6FE0"))).collect(),
        }
    }
}

impl Theme {
    /// Same mapping as the shared front end: a legacy hub colour if known,
    /// otherwise a stable hash of the owner's id.
    pub fn owner(&self, owner_id: &str, legacy: Option<&str>) -> Rgba {
        let index = match legacy.map(|c| c.to_ascii_lowercase()).as_deref() {
            Some("#c76a39") => 1,
            Some("#327c76") => 5,
            Some("#7570b3") => 4,
            Some("#c14b74") => 3,
            Some("#397cba") => 0,
            Some("#ae8428") => 6,
            _ => owner_id.encode_utf16().map(|c| c as usize).sum::<usize>() % OWNER_ORDER.len(),
        };
        self.owners[index]
    }
}

/// Parses `#RRGGBB`, `#RGB` or `rgba(r,g,b,a)` into linear-ready sRGB floats.
pub fn parse_colour(value: &str) -> Rgba {
    let v = value.trim();
    if let Some(hex) = v.strip_prefix('#') {
        let expand: String = if hex.len() == 3 { hex.chars().flat_map(|c| [c, c]).collect() } else { hex.to_string() };
        let n = u32::from_str_radix(&expand[..6.min(expand.len())], 16).unwrap_or(0);
        return [((n >> 16) & 255) as f32 / 255.0, ((n >> 8) & 255) as f32 / 255.0, (n & 255) as f32 / 255.0, 1.0];
    }
    if let Some(inner) = v.strip_prefix("rgba(").or_else(|| v.strip_prefix("rgb(")).and_then(|s| s.strip_suffix(')')) {
        let p: Vec<f32> = inner.split(',').filter_map(|x| x.trim().parse().ok()).collect();
        if p.len() >= 3 {
            return [p[0] / 255.0, p[1] / 255.0, p[2] / 255.0, p.get(3).copied().unwrap_or(1.0)];
        }
    }
    [0.0, 0.0, 0.0, 1.0]
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn colours_parse() {
        assert_eq!(parse_colour("#FF0000"), [1.0, 0.0, 0.0, 1.0]);
        assert_eq!(parse_colour("rgba(0,0,0,0.5)"), [0.0, 0.0, 0.0, 0.5]);
    }
    #[test]
    fn every_look_loads_and_owner_colours_are_stable() {
        let t = Tokens::load();
        for look in ["classroom", "studio", "executive", "command"] {
            let theme = t.theme(Some(look));
            assert!(theme.surface[3] > 0.0);
        }
        let theme = t.theme(None);
        assert_eq!(theme.owner("abc", None), theme.owner("abc", None));
        assert_eq!(theme.owner("x", Some("#397CBA")), theme.owners[0]);
    }
}
