// Control-API fixture only. Does not implement or simulate video delivery.
import http from "node:http";
import { readFileSync } from "node:fs";
import { TokenVerifier } from "livekit-server-sdk";
const config = JSON.parse(readFileSync(process.argv.at(-1), "utf8"));
const [[key, secret]] = Object.entries(config.keys);
const verifier = new TokenVerifier(key, secret);
const server = http.createServer(async (req, res) => {
  try {
    const claims = await verifier.verify(req.headers.authorization?.replace(/^Bearer /, ""));
    if (!claims.video?.roomList) throw new Error("No list grant");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ rooms: [] }));
  } catch { res.writeHead(401); res.end(); }
});
server.listen(config.port, config.bind_addresses[0]);
process.on("SIGTERM", () => server.close());
