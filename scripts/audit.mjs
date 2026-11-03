import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";

export function verifyRows(rows) {
  const heads = new Map();
  let count = 0;
  for (const row of rows) {
    const digest = createHash("sha256")
      .update(
        JSON.stringify({
          at: row.at,
          room_id: row.room_id,
          actor: row.actor,
          action: row.action,
          details: row.details,
          previous: row.previous,
        }),
      )
      .digest("hex");
    if (
      row.previous !== (heads.get(row.room_id) || "0".repeat(64)) ||
      row.hash !== digest
    )
      return { valid: false, count, failedAt: row.seq };
    heads.set(row.room_id, row.hash);
    count++;
  }
  return { valid: true, count, heads: Object.fromEntries(heads) };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  const file = resolve(
    process.env.BORDERLESS_DATA || ".borderless",
    "borderless.db",
  );
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const result = verifyRows(
      db.prepare("SELECT * FROM audit ORDER BY seq").iterate(),
    );
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
  } finally {
    db.close();
  }
}
