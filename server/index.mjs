import { createApp } from "./app.mjs";
import { Bonjour } from "bonjour-service";
import { startMediaProcess } from "./media-process.mjs";

if (process.env.BORDERLESS_MEDIA === "1" && (process.env.BORDERLESS_MEDIA_SIGNAL_URL || process.env.BORDERLESS_MEDIA_RTC_ADDRESS) &&
    !(process.env.BORDERLESS_TLS_CERT && process.env.BORDERLESS_TLS_KEY))
  throw new Error("Configure trusted hub TLS before enabling LAN media.");

const media = process.env.BORDERLESS_MEDIA === "1" ? await startMediaProcess({
  signalURL: process.env.BORDERLESS_MEDIA_SIGNAL_URL,
  rtcAddress: process.env.BORDERLESS_MEDIA_RTC_ADDRESS,
  executable: process.env.BORDERLESS_LIVEKIT_BINARY || "livekit-server",
  dataDir: process.env.BORDERLESS_DATA || ".borderless",
}) : null;
let app;
try { app = await createApp({ media }); }
catch (error) { await media?.close(); throw error; }
console.log(
  `\nBorderless 0.1.0\nOpen ${app.localURL}\nData stays on this host. Press Ctrl+C to stop.\n`,
);
let bonjour;
if (process.env.BORDERLESS_MDNS === "1") {
  try {
    bonjour = new Bonjour();
    const service = bonjour.publish({
      name: "Borderless room hub",
      type: "borderless",
      port: app.port,
      txt: {
        version: "0.1.0",
        tls: process.env.BORDERLESS_TLS_CERT ? "1" : "0",
      },
    });
    service.on("error", (error) =>
      console.warn("Local discovery unavailable:", error.message),
    );
  } catch (error) {
    console.warn("Local discovery unavailable:", error.message);
  }
}
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    bonjour?.destroy();
    try { await app.close(); }
    finally { await media?.close(); }
    process.exit(0);
  });

if (media) media.exited.then(async () => {
  if (stopping) return;
  stopping = true;
  console.error("The local media server stopped. Closing the hub; restart it to reconnect safely.");
  bonjour?.destroy();
  try { await app.close(); }
  catch { /* The media service has already stopped. */ }
  finally { await media.close(); process.exitCode = 1; }
});
