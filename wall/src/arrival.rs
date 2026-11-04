//! Phone throw arrival on the native Wall (CODEX_BRIEF section 4, PRD B39).
//! Every stage follows a real hub event: the spark appears when bytes start
//! arriving, its ring follows real progress, and the vortex plays only once the
//! stored file is in the room state. Time-driven and interruptible.
use serde_json::Value;
use std::{collections::HashMap, time::Instant};

pub struct Pending {
    pub name: String,
    pub aim: f32,
    pub owner_id: String,
    pub owner_name: String,
    pub colour: Option<String>,
    pub progress: f32,
    pub failed: Option<Instant>,
    pub leaving: Option<Instant>,
}

pub struct Burst {
    pub started: Instant,
    pub from: [f32; 2],
    pub owner_id: String,
    pub colour: Option<String>,
    pub surface: String,
    seeds: Vec<[f32; 4]>,
}

pub struct Particle {
    pub x: f32,
    pub y: f32,
    pub size: f32,
    pub alpha: f32,
}

pub const VORTEX_MS: f32 = 900.0;
pub const REVEAL_MS: f32 = 520.0;
pub const ARRIVE_MS: f32 = 700.0;

#[derive(Default)]
pub struct Arrivals {
    pub pending: HashMap<String, Pending>,
    pub bursts: Vec<Burst>,
    /// Windows appearing: when their arrival animation starts.
    appear: HashMap<String, Instant>,
    seed: u64,
}

fn uuid(v: &str) -> bool {
    v.len() == 36 && v.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

impl Arrivals {
    fn random(&mut self) -> f32 {
        // xorshift: decoration only, never security.
        self.seed ^= self.seed << 13;
        self.seed ^= self.seed >> 7;
        self.seed ^= self.seed << 17;
        (self.seed >> 40) as f32 / (1u64 << 24) as f32
    }

    /// Applies one validated `transfer.*` event from the hub.
    pub fn event(&mut self, message: &Value, now: Instant) {
        let Some(id) = message.get("id").and_then(Value::as_str).filter(|v| uuid(v)) else { return };
        let text = |k: &str| message.get(k).and_then(Value::as_str).filter(|v| v.len() <= 300).map(str::to_owned);
        match message.get("type").and_then(Value::as_str) {
            Some("transfer.start") => {
                let (Some(name), Some(owner_id), Some(owner_name)) = (text("name"), text("ownerId"), text("ownerName")) else { return };
                let aim = message.get("aim").and_then(Value::as_f64).filter(|a| (0.0..=1.0).contains(a)).unwrap_or(0.5) as f32;
                self.pending.entry(id.to_owned()).or_insert(Pending { name, aim: aim.clamp(0.06, 0.94), owner_id, owner_name, colour: text("colour"), progress: 0.0, failed: None, leaving: None });
            }
            Some("transfer.progress") => {
                if let (Some(p), Some(v)) = (self.pending.get_mut(id), message.get("progress").and_then(Value::as_f64)) {
                    p.progress = (v as f32).clamp(0.0, 1.0);
                }
            }
            Some("transfer.end") => {
                if let Some(p) = self.pending.get_mut(id) {
                    if message.get("ok").and_then(Value::as_bool) == Some(true) {
                        p.progress = 1.0;
                        p.leaving.get_or_insert(now);
                    } else {
                        p.failed = Some(now);
                    }
                }
            }
            _ => {}
        }
    }

    /// A window appeared in the room state. If a transfer from the same person
    /// with the same name is in flight, the vortex carries it in from the spark.
    pub fn landed(&mut self, surface: &str, owner_id: &str, title: &str, wall: [f32; 2], now: Instant, reduced: bool) {
        let matched = self.pending.iter().find(|(_, p)| p.leaving.is_none() && p.failed.is_none() && p.owner_id == owner_id && p.name == title).map(|(id, _)| id.clone());
        match matched {
            Some(id) if !reduced => {
                let p = self.pending.get_mut(&id).unwrap();
                p.progress = 1.0;
                p.leaving = Some(now);
                let from = [p.aim * wall[0], 0.42 * wall[1]];
                let (owner, colour) = (p.owner_id.clone(), p.colour.clone());
                self.seed = self.seed.wrapping_add(now.elapsed().as_nanos() as u64 ^ 0x9E37_79B9_7F4A_7C15) | 1;
                let seeds = (0..160).map(|_| [self.random(), self.random(), self.random(), self.random()]).collect();
                self.bursts.push(Burst { started: now, from, owner_id: owner, colour, surface: surface.to_owned(), seeds });
                self.appear.insert(surface.to_owned(), now + std::time::Duration::from_millis(REVEAL_MS as u64));
            }
            Some(id) => {
                if let Some(p) = self.pending.get_mut(&id) {
                    p.leaving = Some(now);
                }
                self.appear.insert(surface.to_owned(), now);
            }
            None => {
                self.appear.insert(surface.to_owned(), now);
            }
        }
    }

    /// Opacity and scale of a window during its arrival (design-system `bl-arrive`).
    pub fn appearance(&self, surface: &str, now: Instant, reduced: bool) -> (f32, f32) {
        let Some(start) = self.appear.get(surface) else { return (1.0, 1.0) };
        if now < *start {
            return (0.0, 0.86);
        }
        let t = (now.duration_since(*start).as_secs_f32() * 1000.0 / if reduced { 150.0 } else { ARRIVE_MS }).min(1.0);
        if reduced {
            return (t, 1.0);
        }
        // 0%: 0, .86; 65%: 1, 1.03; 100%: 1, 1.
        if t < 0.65 {
            let k = t / 0.65;
            let e = 1.0 - (1.0 - k).powi(3);
            (e, 0.86 + (1.03 - 0.86) * e)
        } else {
            let k = (t - 0.65) / 0.35;
            (1.0, 1.03 - 0.03 * k)
        }
    }

    /// The vortex's particles this frame for one burst, spiralling into `target`.
    pub fn particles(burst: &Burst, target: [f32; 4], now: Instant) -> Vec<Particle> {
        let t = (now.duration_since(burst.started).as_secs_f32() * 1000.0 / VORTEX_MS).min(1.0);
        burst
            .seeds
            .iter()
            .map(|&[a, b, d, e]| {
                let local = ((t - a * 0.25) / 0.75).clamp(0.0, 1.0);
                let k = if local < 0.5 { 4.0 * local.powi(3) } else { 1.0 - (-2.0 * local + 2.0).powi(3) / 2.0 };
                let tx = target[0] + target[2] * (0.1 + 0.8 * b);
                let ty = target[1] + target[3] * (0.1 + 0.8 * d);
                let swirl = (1.0 - k) * (24.0 + 56.0 * e);
                let angle = a * std::f32::consts::TAU + k * std::f32::consts::PI * 3.0;
                Particle {
                    x: burst.from[0] + (tx - burst.from[0]) * k + angle.cos() * swirl,
                    y: burst.from[1] + (ty - burst.from[1]) * k + angle.sin() * swirl,
                    size: 1.2 + 2.4 * e * (1.0 - k * 0.6),
                    alpha: (local * 4.0).min(1.0) * (1.0 - ((local - 0.8) / 0.2).max(0.0)),
                }
            })
            .collect()
    }

    /// Removes finished effects. Returns true while anything is still moving.
    pub fn tidy(&mut self, now: Instant, reduced: bool) -> bool {
        self.bursts.retain(|b| now.duration_since(b.started).as_secs_f32() * 1000.0 < VORTEX_MS + 1200.0);
        self.pending.retain(|_, p| match (p.failed, p.leaving) {
            (Some(f), _) => now.duration_since(f).as_secs_f32() < 2.6,
            (_, Some(l)) => now.duration_since(l).as_secs_f32() < 0.4,
            _ => true,
        });
        let arrive = if reduced { 150.0 } else { ARRIVE_MS };
        self.appear.retain(|_, start| now < *start || now.duration_since(*start).as_secs_f32() * 1000.0 < arrive);
        !self.pending.is_empty() || !self.bursts.is_empty() || !self.appear.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    const T: &str = "0a1b2c3d-0000-4000-8000-000000000009";

    #[test]
    fn a_transfer_shows_progress_then_lands_its_matching_window_through_the_vortex() {
        let now = Instant::now();
        let mut a = Arrivals::default();
        a.event(&json!({"type": "transfer.start", "id": T, "name": "photo.png", "aim": 0.3, "ownerId": "o", "ownerName": "Ama", "colour": "#397cba"}), now);
        a.event(&json!({"type": "transfer.progress", "id": T, "progress": 0.5}), now);
        assert_eq!(a.pending[T].progress, 0.5);
        a.landed("w1", "someone else", "photo.png", [1920.0, 1080.0], now, false);
        assert!(a.bursts.is_empty(), "only the sender's file is carried by the vortex");
        a.landed("w2", "o", "photo.png", [1920.0, 1080.0], now, false);
        assert_eq!(a.bursts.len(), 1);
        assert_eq!(a.bursts[0].from, [0.3 * 1920.0, 0.42 * 1080.0]);
        assert_eq!(a.appearance("w2", now, false).0, 0.0, "hidden until the particles converge");
        let parts = Arrivals::particles(&a.bursts[0], [100.0, 100.0, 400.0, 300.0], now + std::time::Duration::from_millis(900));
        assert!(parts.iter().all(|p| p.x >= 100.0 && p.x <= 500.0 && p.y >= 100.0 && p.y <= 400.0));
    }

    #[test]
    fn a_rejected_transfer_fails_visibly_and_lands_nothing() {
        let now = Instant::now();
        let mut a = Arrivals::default();
        a.event(&json!({"type": "transfer.start", "id": T, "name": "fake.png", "aim": null, "ownerId": "o", "ownerName": "Ama"}), now);
        a.event(&json!({"type": "transfer.end", "id": T, "ok": false}), now);
        assert!(a.pending[T].failed.is_some());
        a.landed("w", "o", "fake.png", [1920.0, 1080.0], now, false);
        assert!(a.bursts.is_empty());
        assert!(a.tidy(now, false));
        assert!(!a.tidy(now + std::time::Duration::from_secs(3), false) || !a.pending.contains_key(T));
    }

    #[test]
    fn malformed_events_are_ignored() {
        let mut a = Arrivals::default();
        a.event(&json!({"type": "transfer.start", "id": "../x", "name": "a"}), Instant::now());
        a.event(&json!({"type": "transfer.start", "id": T, "name": "x".repeat(400), "ownerId": "o", "ownerName": "A"}), Instant::now());
        assert!(a.pending.is_empty());
    }
}
