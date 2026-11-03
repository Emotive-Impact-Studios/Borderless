import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isIP } from "node:net";
import { resolve, join } from "node:path";

const addresses = [
  ...new Set(["localhost", "127.0.0.1", ...process.argv.slice(2)]),
];
if (
  addresses.some(
    (a) => !isIP(a) && !/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/.test(a),
  )
)
  throw new Error(
    "Use hostnames or LAN IP addresses, without protocols or ports.",
  );
const dir = resolve("certs");
mkdirSync(dir, { recursive: true, mode: 0o700 });
if (existsSync(join(dir, "key.pem")) || existsSync(join(dir, "cert.pem")))
  throw new Error(
    "Certificates already exist. Keep them, or move the old certs directory before generating replacements.",
  );
const san = addresses.map((a) => `${isIP(a) ? "IP" : "DNS"}:${a}`).join(",");
const result = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:3072",
    "-sha256",
    "-nodes",
    "-days",
    "30",
    "-keyout",
    join(dir, "key.pem"),
    "-out",
    join(dir, "cert.pem"),
    "-subj",
    "/CN=Borderless local hub",
    "-addext",
    `subjectAltName=${san}`,
  ],
  { stdio: "pipe" },
);
if (result.status !== 0)
  throw new Error(
    `OpenSSL could not generate a certificate. Install OpenSSL from your OS package manager. ${result.error?.message || ""}`,
  );
const { chmodSync } = await import("node:fs");
chmodSync(join(dir, "key.pem"), 0o600);
writeFileSync(
  join(dir, "README.txt"),
  `Development certificate for: ${addresses.join(", ")}\nValid for 30 days.\nFor LAN deployment, use a certificate trusted by each device through your organisation's certificate process. Do not disable certificate validation or bypass browser warnings.\n`,
);
console.log(
  "Created certs/cert.pem and certs/key.pem with the requested SANs. See docs/OPERATIONS.md for trust and LAN setup.",
);
