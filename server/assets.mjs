import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { createWriteStream, mkdirSync } from "node:fs";
import {
  readFile,
  rename,
  unlink,
  appendFile,
  readdir,
} from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { join, basename } from "node:path";
import { fail } from "./protocol.mjs";

const extensions = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/plain",
  csv: "text/plain",
  json: "text/plain",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export function safeName(value) {
  const name = basename(String(value || ""))
    .replace(/[\x00-\x1f\x7f<>:"|?*\\/]/g, "_")
    .slice(0, 160);
  if (!name || !extensions[name.split(".").pop().toLowerCase()])
    fail(415, "Use an image, PDF, text, Office document, audio or video file.");
  return name;
}
export const mimeFor = (name) =>
  extensions[name.split(".").pop().toLowerCase()];
export function signatureMatches(file, name) {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return file.subarray(0, 5).toString() === "%PDF-";
  if (ext === "png")
    return file
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (["jpg", "jpeg"].includes(ext))
    return file[0] === 255 && file[1] === 216 && file[2] === 255;
  if (ext === "gif")
    return ["GIF87a", "GIF89a"].includes(file.subarray(0, 6).toString());
  if (ext === "webp")
    return (
      file.subarray(0, 4).toString() === "RIFF" &&
      file.subarray(8, 12).toString() === "WEBP"
    );
  if (["docx", "xlsx", "pptx"].includes(ext))
    return file.subarray(0, 2).toString() === "PK";
  if (["txt", "md", "csv", "json"].includes(ext))
    return !file.subarray(0, 4096).includes(0);
  if (["mp4", "mov", "m4a"].includes(ext))
    return file.subarray(4, 8).toString() === "ftyp";
  if (ext === "webm")
    return file.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (ext === "ogg") return file.subarray(0, 4).toString() === "OggS";
  if (ext === "wav")
    return (
      file.subarray(0, 4).toString() === "RIFF" &&
      file.subarray(8, 12).toString() === "WAVE"
    );
  if (ext === "mp3")
    return (
      file.subarray(0, 3).toString() === "ID3" ||
      (file[0] === 255 && (file[1] & 0xe0) === 0xe0)
    );
  return false;
}
export function assetStorage(dataDir, key, maxBytes = 25 * 1024 * 1024) {
  const dir = join(dataDir, "assets");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const pathFor = (assetId) => join(dir, `${assetId}.blf`);
  async function write(source, assetId, name) {
    const temp = join(dir, `${assetId}.part`);
    const nonce = randomBytes(12),
      digest = createHash("sha256");
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    const target = createWriteStream(temp, { flags: "wx", mode: 0o600 });
    target.write(Buffer.concat([Buffer.from("BLF1"), nonce]));
    let size = 0,
      prefix = Buffer.alloc(0);
    const limiter = new Transform({
      transform(chunk, _enc, callback) {
        size += chunk.length;
        if (size > maxBytes) {
          callback(
            Object.assign(new Error("File exceeds the 25 MB limit."), {
              status: 413,
            }),
          );
          return;
        }
        if (prefix.length < 4096)
          prefix = Buffer.concat([
            prefix,
            chunk.subarray(0, 4096 - prefix.length),
          ]);
        digest.update(chunk);
        callback(null, chunk);
      },
    });
    try {
      await pipeline(source, limiter, cipher, target);
      if (!size || !signatureMatches(prefix, name))
        fail(415, "The file contents do not match a supported file type.");
      await appendFile(temp, cipher.getAuthTag());
      await rename(temp, pathFor(assetId));
      return { size, hash: digest.digest("hex") };
    } catch (error) {
      await unlink(temp).catch(() => {});
      throw error;
    }
  }
  async function read(asset) {
    const encrypted = await readFile(pathFor(asset.id));
    if (
      encrypted.length > maxBytes + 32 ||
      encrypted.subarray(0, 4).toString() !== "BLF1"
    )
      throw new Error("Asset integrity failure");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      encrypted.subarray(4, 16),
    );
    decipher.setAuthTag(encrypted.subarray(-16));
    const plain = Buffer.concat([
      decipher.update(encrypted.subarray(16, -16)),
      decipher.final(),
    ]);
    if (
      plain.length !== asset.size ||
      createHash("sha256").update(plain).digest("hex") !== asset.hash
    )
      throw new Error("Asset integrity failure");
    return plain;
  }
  async function removeFile(filename) {
    if (!/^[a-f0-9-]{36}\.(blf|part)$/.test(filename))
      throw new Error("Invalid cleanup reference");
    await unlink(join(dir, filename)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  async function orphans(known) {
    return (await readdir(dir)).filter(
      (filename) =>
        /^[a-f0-9-]{36}\.(blf|part)$/.test(filename) &&
        (filename.endsWith(".part") || !known.has(filename.slice(0, -4))),
    );
  }
  return {
    write,
    read,
    removeFile,
    orphans,
    remove: (assetId) => removeFile(`${assetId}.blf`),
  };
}
