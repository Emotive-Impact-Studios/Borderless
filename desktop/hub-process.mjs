import { fileURLToPath } from "node:url";

// Native macOS dialogs can suspend Electron's main JavaScript loop. The room
// authority must keep serving its other clients while a picker is on screen.
export function startHubProcess(fork, dataDir, {
  onUnexpectedExit = () => {},
  startupTimeout = 15000,
  shutdownTimeout = 5000,
} = {}) {
  const child = fork(
    fileURLToPath(new URL("../server/desktop-hub.mjs", import.meta.url)),
    [dataDir],
    { serviceName: "Borderless room hub", stdio: "pipe" },
  );
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
  let stopped = false, exited = false, ready = false, settled = false, closePromise;
  const exit = new Promise((resolve) => child.once("exit", (code) => {
    exited = true;
    resolve(code);
    if (ready && !stopped) onUnexpectedExit(code);
  }));
  function close() {
    if (closePromise) return closePromise;
    stopped = true;
    closePromise = (async () => {
      if (exited) return;
      let timer;
      try {
        child.postMessage({ type: "shutdown" });
        await Promise.race([
          exit,
          new Promise((resolve) => {
            timer = setTimeout(() => { child.kill(); resolve(); }, shutdownTimeout);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    })();
    return closePromise;
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => fail(new Error("The room hub did not start in time.")), startupTimeout);
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("message", message);
      stopped = true;
      child.kill();
      reject(error);
    };
    const message = (data) => {
      if (data?.type === "error") return fail(new Error(data.message));
      if (data?.type !== "ready") return;
      clearTimeout(timer);
      child.off("message", message);
      ready = true;
      settled = true;
      resolve({ localURL: data.localURL, close });
    };
    child.on("message", message);
    child.on("error", () => fail(new Error("The room hub encountered a fatal runtime error.")));
    exit.then((code) => {
      if (!ready) fail(new Error(`The room hub stopped during startup (exit ${code}).`));
    });
  });
}
