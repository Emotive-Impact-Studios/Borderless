import { createApp } from "./app.mjs";

if (!process.parentPort) throw new Error("Start this service through the desktop application.");
let hub, stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await hub?.close();
    process.exit(0);
  } catch (error) {
    console.error("The room hub could not stop cleanly:", error.message);
    process.exit(1);
  }
}
process.parentPort.on("message", (event) => {
  if (event.data?.type === "shutdown") void stop();
});
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
try {
  hub = await createApp({ dataDir: process.argv[2] });
  process.parentPort.postMessage({ type: "ready", localURL: hub.localURL });
} catch (error) {
  process.parentPort.postMessage({ type: "error", message: error.message });
  process.exitCode = 1;
}
