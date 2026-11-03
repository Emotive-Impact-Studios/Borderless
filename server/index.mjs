import { createApp } from "./app.mjs";
import { Bonjour } from "bonjour-service";

const app = await createApp();
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
    await app.close();
    process.exit(0);
  });
