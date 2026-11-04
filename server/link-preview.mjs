// Link previews for PRD B42. The hub fetches only public http(s) pages, pins
// the address it checked (no DNS rebinding), sends no cookies or credentials,
// reads at most 256 KB of HTML and returns plain text fields only. Images are
// not fetched or proxied. Rooms without internet simply keep the host card.
import { lookup } from "node:dns/promises";
import { isIP, BlockList } from "node:net";
import http from "node:http";
import https from "node:https";

const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
]) blocked.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["64:ff9b::", 96], ["2001:db8::", 32]])
  blocked.addSubnet(net, bits, "ipv6");

/** Validates a link someone sends to the Wall. Throws a message fit for the sender. */
export function cleanLink(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) throw new Error("Paste a complete web link.");
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error("That does not look like a web link."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only web links (http or https) can go on the Wall.");
  if (url.username || url.password) throw new Error("Links with sign-in details cannot be shared.");
  url.hash = "";
  return url;
}

export function publicAddress(address) {
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) is judged as the IPv4 address it names.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) address = mapped[1];
  const family = isIP(address);
  return family !== 0 && !blocked.check(address, family === 6 ? "ipv6" : "ipv4");
}

const decode = (s) => s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|#39|apos|nbsp);/gi, (m, e) => {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " }[e.toLowerCase()];
  if (named) return named;
  const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return Number.isFinite(code) && code > 31 && code < 0x110000 ? String.fromCodePoint(code) : "";
}).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

export function readMetadata(html) {
  const meta = (key) => {
    for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
      const name = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (name === key) return decode(tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] || "");
    }
    return "";
  };
  const title = meta("og:title") || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  return {
    title: title.slice(0, 200),
    site: meta("og:site_name").slice(0, 80),
    description: (meta("og:description") || meta("description")).slice(0, 300),
  };
}

function get(url, address, signal) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request({
      host: address, servername: isIP(url.hostname) ? undefined : url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80), path: url.pathname + url.search, method: "GET", signal,
      headers: { Host: url.host, "User-Agent": "BorderlessLinkPreview/0.1", Accept: "text/html" },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); resolve({ redirect: new URL(res.headers.location, url) }); return;
      }
      if (res.statusCode !== 200 || !/^text\/html\b/i.test(res.headers["content-type"] || "")) { res.resume(); reject(new Error("No page preview")); return; }
      let size = 0; const chunks = [];
      res.on("data", (chunk) => {
        size += chunk.length; chunks.push(chunk);
        if (size > 256 * 1024) { res.destroy(); resolve({ html: Buffer.concat(chunks).toString("utf8") }); }
      });
      res.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("error", reject); req.end();
  });
}

/** Fetches a preview for a public page, or throws. Never reaches private addresses. */
export async function previewLink(link, { resolve = (host) => lookup(host, { all: true }) } = {}) {
  let url = cleanLink(String(link));
  const signal = AbortSignal.timeout(5000);
  for (let hop = 0; hop < 4; hop++) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [{ address: host }] : await resolve(host);
    if (!addresses.length || !addresses.every((a) => publicAddress(a.address))) throw new Error("Private addresses are not previewed.");
    const result = await get(url, addresses[0].address, signal);
    if (result.redirect) { url = cleanLink(result.redirect.href); continue; }
    return readMetadata(result.html);
  }
  throw new Error("Too many redirects.");
}
