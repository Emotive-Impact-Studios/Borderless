import { spawn } from "node:child_process";
import { isIPv4 } from "node:net";
import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { RoomServiceClient } from "livekit-server-sdk";

// The SFU control API stays on loopback. LAN clients reach signalling through TLS.
export async function startMediaProcess({
  executable = "livekit-server", args = [], dataDir = ".borderless",
  signalURL, rtcAddress,
  port = 7880, tcpPort = 7881, udpPort = 7882, startupTimeout = 15_000,
} = {}) {
  for (const value of [port, tcpPort, udpPort])
    if (!Number.isInteger(value) || value < 1024 || value > 65535)
      throw new Error("Media ports must be integers from 1024 to 65535.");
  if (new Set([port, tcpPort, udpPort]).size !== 3) throw new Error("Use distinct media ports.");
  let url = `ws://127.0.0.1:${port}`;
  if (signalURL || rtcAddress) {
    if (!signalURL || !rtcAddress) throw new Error("Configure both LAN media signalling and the RTC interface address.");
    const endpoint = new URL(signalURL);
    if (endpoint.protocol !== "wss:" || endpoint.username || endpoint.password ||
        endpoint.search || endpoint.hash || endpoint.pathname !== "/")
      throw new Error("LAN media needs a trusted wss:// signalling origin.");
    const local = Object.values(networkInterfaces()).flat().some(i => i && !i.internal && i.address === rtcAddress);
    if (!isIPv4(rtcAddress ?? "") || !local)
      throw new Error("Choose an IPv4 address assigned to a room network interface.");
    url = endpoint.origin;
  }
  const parent = resolve(dataDir, "media");
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(parent, "run-"));
  const configPath = join(directory, "livekit.json");
  const apiKey = randomBytes(16).toString("hex");
  const apiSecret = randomBytes(32).toString("hex");
  // JSON is a YAML subset. Values never pass through a shell or string template.
  const config = {
    port, bind_addresses: ["127.0.0.1"],
    rtc: { tcp_port: tcpPort, udp_port: udpPort, use_external_ip: false,
      enable_loopback_candidate: !rtcAddress, stun_servers: [],
      ...(rtcAddress ? { node_ip: rtcAddress, ips: { includes: [`${rtcAddress}/32`] } } : {}) },
    keys: { [apiKey]: apiSecret },
    room: { auto_create: false },
    logging: { level: "warn" },
  };
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600, flag: "wx" });
  const service = new RoomServiceClient(`http://127.0.0.1:${port}`, apiKey, apiSecret,
    { requestTimeout: 1 });
  const child = spawn(executable, [...args, "--config", configPath], { stdio: "ignore" });
  let ended = false, spawnError;
  const exited = new Promise(resolveExit => {
    child.once("error", error => { spawnError = error; ended = true; resolveExit(); });
    child.once("exit", () => { ended = true; resolveExit(); });
  });
  let closing;
  function close() {
    if (closing) return closing;
    closing = (async () => {
      if (!ended) {
        child.kill("SIGTERM");
        await Promise.race([exited, delay(2_000)]);
        if (!ended) { child.kill("SIGKILL"); await exited; }
      }
      await rm(directory, { recursive: true, force: true });
    })();
    return closing;
  }
  try {
    const deadline = Date.now() + startupTimeout;
    while (Date.now() < deadline && !ended) {
      try {
        // Random per-run credentials distinguish our process from a different
        // service already occupying this port; a generic HTTP 200 is not enough.
        await service.listRooms();
        if (ended) break;
        return { apiKey, apiSecret, url, service, close, exited, get ended() { return ended; } };
      } catch { await delay(100); }
    }
    throw new Error(spawnError?.code === "ENOENT"
      ? "LiveKit server is not installed. Install livekit-server before enabling media."
      : "LiveKit could not start or authenticate before the deadline. Check its installation and media ports.");
  } catch (error) { await close(); throw error; }
}
