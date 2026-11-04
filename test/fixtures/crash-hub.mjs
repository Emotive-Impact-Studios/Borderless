// Fault injection belongs only in the disposable test process, never the server API.
import { createApp } from "../../server/app.mjs";
const hub = await createApp({ dataDir: process.argv[2], port: 0 });
let armed;
process.on("message", ({ stage }) => { armed = stage; process.send({ type: "armed" }); });
const write = hub.storage.write;
hub.storage.write = async (...args) => {
  const result = await write(...args);
  if (armed === "upload") {
    process.send({ type: "fault", assetId: args[1] });
    await new Promise(() => {});
  }
  return result;
};
const remove = hub.storage.removeFile;
hub.storage.removeFile = async (filename) => {
  if (armed === "purge") {
    process.send({ type: "fault", filename });
    await new Promise(() => {});
  }
  return remove(filename);
};
process.send({ type: "ready", localURL: hub.localURL });
