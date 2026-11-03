import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password, expected) {
  try {
    const actual = passwordHash(password, expected.split(":")[0]);
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function openStore(dataDir) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const keyPath = join(dataDir, "storage.key");
  let key;
  try {
    key = readFileSync(keyPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    key = randomBytes(32);
    writeFileSync(keyPath, key, { mode: 0o600, flag: "wx" });
  }
  if (key.length !== 32)
    throw new Error(
      "Invalid storage key. Restore the original storage.key from your backup.",
    );
  chmodSync(keyPath, 0o600);
  const db = new DatabaseSync(join(dataDir, "borderless.db"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, password TEXT NOT NULL,
      join_code TEXT NOT NULL, wall_key TEXT NOT NULL, state TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id),
      device_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, csrf TEXT NOT NULL, colour TEXT NOT NULL,
      seat TEXT NOT NULL, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS sessions_room ON sessions(room_id);
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id),
      owner_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, hash TEXT NOT NULL,
      created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS commands (room_id TEXT NOT NULL, device_id TEXT NOT NULL, command_id TEXT NOT NULL,
      response TEXT NOT NULL, PRIMARY KEY(room_id, device_id, command_id));
    CREATE TABLE IF NOT EXISTS cleanup_queue (filename TEXT PRIMARY KEY, room_id TEXT NOT NULL, reason TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT);
    CREATE TABLE IF NOT EXISTS audit (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL,
      room_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL,
      previous TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
  `);
  chmodSync(join(dataDir, "borderless.db"), 0o600);
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function audit(roomId, actor, action, details = {}) {
    const previous =
      db
        .prepare(
          "SELECT hash FROM audit WHERE room_id=? ORDER BY seq DESC LIMIT 1",
        )
        .get(roomId)?.hash || "0".repeat(64);
    const row = {
      at: now(),
      room_id: roomId,
      actor,
      action,
      details: JSON.stringify(details),
      previous,
    };
    const digest = hash(JSON.stringify(row));
    db.prepare(
      "INSERT INTO audit(at,room_id,actor,action,details,previous,hash) VALUES(?,?,?,?,?,?,?)",
    ).run(row.at, roomId, actor, action, row.details, previous, digest);
    return digest;
  }
  function room(roomId) {
    const row = db.prepare("SELECT * FROM rooms WHERE id=?").get(roomId);
    return row ? { ...row, state: JSON.parse(row.state) } : null;
  }
  function saveRoom(room) {
    room.state.revision += 1;
    db.prepare(
      "UPDATE rooms SET state=?,join_code=?,wall_key=? WHERE id=?",
    ).run(JSON.stringify(room.state), room.join_code, room.wall_key, room.id);
  }
  function session(token, roomId) {
    if (!token) return null;
    return db
      .prepare(
        "SELECT * FROM sessions WHERE token_hash=? AND room_id=? AND revoked=0 AND expires>?",
      )
      .get(hash(token), roomId, Date.now());
  }
  function createSession(roomId, name, role, seat = "centre") {
    const token = secret();
    const colours = [
      "#c76a39",
      "#327c76",
      "#7570b3",
      "#c14b74",
      "#397cba",
      "#ae8428",
    ];
    const count = db
      .prepare("SELECT count(*) AS n FROM sessions WHERE room_id=?")
      .get(roomId).n;
    const s = {
      token_hash: hash(token),
      room_id: roomId,
      device_id: id(),
      name,
      role,
      csrf: secret(),
      colour: colours[count % colours.length],
      seat,
      expires: Date.now() + 12 * 60 * 60 * 1000,
    };
    db.prepare(
      "INSERT INTO sessions(token_hash,room_id,device_id,name,role,csrf,colour,seat,expires) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(
      s.token_hash,
      roomId,
      s.device_id,
      name,
      role,
      s.csrf,
      s.colour,
      seat,
      s.expires,
    );
    audit(roomId, s.device_id, "session.joined", { name, role });
    return { token, session: s };
  }
  function verifyAudit(roomId) {
    const heads = new Map();
    let count = 0;
    const rows = roomId
      ? db
          .prepare("SELECT * FROM audit WHERE room_id=? ORDER BY seq")
          .iterate(roomId)
      : db.prepare("SELECT * FROM audit ORDER BY seq").iterate();
    for (const row of rows) {
      const digest = hash(
        JSON.stringify({
          at: row.at,
          room_id: row.room_id,
          actor: row.actor,
          action: row.action,
          details: row.details,
          previous: row.previous,
        }),
      );
      if (
        row.previous !== (heads.get(row.room_id) || "0".repeat(64)) ||
        digest !== row.hash
      )
        return { valid: false, count, failedAt: row.seq };
      heads.set(row.room_id, row.hash);
      count += 1;
    }
    return { valid: true, count, heads: Object.fromEntries(heads) };
  }
  return {
    db,
    key,
    room,
    saveRoom,
    audit,
    transaction,
    session,
    createSession,
    verifyAudit,
    close() {
      db.close();
    },
  };
}
