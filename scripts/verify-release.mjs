import { readFile } from "node:fs/promises";
import { createHash, createPublicKey, verify } from "node:crypto";
import { resolve } from "node:path";

export function releasePayload(manifest) {
  return Buffer.from(
    JSON.stringify({
      version: manifest.version,
      platform: manifest.platform,
      sha256: manifest.sha256,
      bytes: manifest.bytes,
      expires: manifest.expires,
    }),
  );
}
function versionParts(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error("Release versions must use major.minor.patch.");
  return version.split(".").map(Number);
}
export function verifyRelease(
  manifest,
  bytes,
  publicKey,
  {
    currentVersion = "0.1.0",
    platform = process.platform,
    at = Date.now(),
  } = {},
) {
  if (
    !manifest ||
    !Number.isSafeInteger(manifest.bytes) ||
    manifest.bytes < 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    typeof manifest.signature !== "string"
  )
    throw new Error("Invalid release manifest.");
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("Release keys must use Ed25519.");
  if (
    !verify(
      null,
      releasePayload(manifest),
      key,
      Buffer.from(manifest.signature, "base64"),
    )
  )
    throw new Error("Release signature is invalid.");
  if (manifest.platform !== platform)
    throw new Error("Release platform does not match this device.");
  const expiry = Date.parse(manifest.expires);
  if (!Number.isFinite(expiry) || expiry <= at)
    throw new Error("Release manifest has expired.");
  const next = versionParts(manifest.version),
    current = versionParts(currentVersion);
  let newer = false;
  for (let i = 0; i < 3; i++) {
    if (next[i] > current[i]) {
      newer = true;
      break;
    }
    if (next[i] < current[i]) break;
  }
  if (!newer)
    throw new Error("Release is not newer than the installed version.");
  if (
    bytes.length !== manifest.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== manifest.sha256
  )
    throw new Error("Release file integrity failed.");
  return {
    verified: true,
    version: manifest.version,
    platform: manifest.platform,
    sha256: manifest.sha256,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  const [manifestPath, packagePath, keyPath, currentVersion] =
    process.argv.slice(2);
  if (!keyPath)
    throw new Error(
      "Usage: npm run release:verify -- <manifest.json> <package> <trusted-public-key.pem> [installed-version]",
    );
  console.log(
    JSON.stringify(
      verifyRelease(
        JSON.parse(await readFile(manifestPath, "utf8")),
        await readFile(packagePath),
        await readFile(keyPath),
        { currentVersion: currentVersion || "0.1.0" },
      ),
      null,
      2,
    ),
  );
}
