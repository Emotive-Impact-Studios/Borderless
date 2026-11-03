import {
  app,
  BrowserWindow,
  Menu,
  screen,
  session,
  desktopCapturer,
  ipcMain,
  dialog,
  shell,
} from "electron";
import { fileURLToPath } from "node:url";
import { join, extname } from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { createApp } from "../server/app.mjs";

let hub,
  mainWindow,
  edgeTimer,
  edgeEnabled = false,
  tempDir;
const windows = new Set();
const preload = fileURLToPath(new URL("./preload.cjs", import.meta.url));
const remote = process.argv.find((arg) => arg.startsWith("--hub="))?.slice(6);
let origin;
function authorised(event) {
  try {
    return (
      event.senderFrame === event.sender.mainFrame &&
      new URL(event.senderFrame.url).origin === origin
    );
  } catch {
    return false;
  }
}
function newWindow(url, bounds) {
  const window = new BrowserWindow({
    width: 1450,
    height: 920,
    minWidth: 380,
    minHeight: 550,
    backgroundColor: "#f5f5ef",
    title: "Borderless",
    ...(bounds ? { ...bounds, frame: false } : {}),
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  windows.add(window);
  window.on("closed", () => windows.delete(window));
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    try {
      if (
        new URL(target).origin === origin &&
        /^\/(wall|portal)\/[a-zA-Z0-9_-]+$/.test(new URL(target).pathname)
      )
        newWindow(target);
    } catch {
      /* Ignore malformed links. */
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, target) => {
    try {
      if (new URL(target).origin !== origin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  window.loadURL(url);
  return window;
}
function wallURL() {
  const current = mainWindow?.webContents.getURL();
  try {
    const url = new URL(current);
    const match = url.pathname.match(
      /^\/(room|portal|wall)\/([a-zA-Z0-9_-]+)$/,
    );
    return match ? `${origin}/wall/${match[2]}` : null;
  } catch {
    return null;
  }
}
function rebuildMenu() {
  const displays = screen.getAllDisplays();
  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    {
      label: "Room",
      submenu: [
        { label: "Open hub", click: () => mainWindow.loadURL(`${origin}/`) },
        {
          label: "Open wall on display",
          submenu: displays.map((display, index) => ({
            label: `Display ${index + 1} · ${display.size.width} × ${display.size.height}`,
            click: () => {
              const url = wallURL();
              if (!url) return;
              const window = newWindow(url, display.bounds);
              window.setFullScreen(true);
            },
          })),
        },
        {
          label: "Span wall across connected displays",
          click: () => {
            const url = wallURL();
            if (!url) return;
            const all = screen.getAllDisplays();
            const x = Math.min(...all.map((d) => d.bounds.x)),
              y = Math.min(...all.map((d) => d.bounds.y));
            const width =
                Math.max(...all.map((d) => d.bounds.x + d.bounds.width)) - x,
              height =
                Math.max(...all.map((d) => d.bounds.y + d.bounds.height)) - y;
            newWindow(url, { x, y, width, height });
          },
        },
        { type: "separator" },
        {
          label: "Enable desktop edge cues",
          type: "checkbox",
          checked: edgeEnabled,
          click: (item) => {
            edgeEnabled = item.checked;
          },
        },
        {
          label: "About desktop edge cues",
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Desktop edge cues",
              message: "A little cue at the border.",
              detail:
                "Moving to a display’s left or right edge sends a coloured entry cue and pointer to your active room. This is not an OS virtual monitor and does not move native application windows. Share a screen for live pixels, or drop files onto the canvas.",
            }),
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    {
      label: "Help",
      submenu: [
        {
          label: "About Borderless",
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Borderless",
              message: "One room. Every screen.",
              detail:
                "Borderless 0.1.0\nLocal hub, shared canvas, participant portal and leader console.\nTLS is required for connections from other devices. Trust certificates through your IT process; certificate validation remains enabled.",
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
app
  .whenReady()
  .then(async () => {
    if (remote) {
      const url = new URL(remote);
      if (
        url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
        )
      )
        throw new Error("Remote room hubs require trusted HTTPS.");
      origin = url.origin;
    } else {
      hub = await createApp({ dataDir: join(app.getPath("userData"), "hub") });
      origin = new URL(hub.localURL).origin;
    }
    // Chromium still shows its source picker. macOS permissions and certificate checks are not bypassed.
    session.defaultSession.setPermissionRequestHandler(
      (contents, permission, callback) => {
        let trusted = false;
        try {
          trusted = new URL(contents.getURL()).origin === origin;
        } catch {
          /* No permission for an unknown origin. */
        }
        callback(
          trusted && ["display-capture", "fullscreen"].includes(permission),
        );
      },
    );
    session.defaultSession.setDisplayMediaRequestHandler(
      async (request, callback) => {
        try {
          if (new URL(request.securityOrigin).origin !== origin) {
            callback(null);
            return;
          }
          const sources = await desktopCapturer.getSources({
            types: ["screen", "window"],
            thumbnailSize: { width: 240, height: 140 },
          });
          if (!sources.length) {
            callback(null);
            return;
          }
          const result = await dialog.showMessageBox({
            type: "question",
            title: "Share a screen or window",
            message: "Choose what the room can see.",
            detail:
              "Only the selected source will be shared. You can stop sharing in Borderless or in the system control.",
            buttons: [...sources.slice(0, 15).map((s) => s.name), "Cancel"],
            cancelId: Math.min(15, sources.length),
            noLink: true,
          });
          if (result.response >= Math.min(15, sources.length)) {
            callback(null);
            return;
          }
          callback({ video: sources[result.response] });
        } catch {
          callback(null);
        }
      },
      { useSystemPicker: true },
    );
    mainWindow = newWindow(`${origin}/`);
    rebuildMenu();
    screen.on("display-added", rebuildMenu);
    screen.on("display-removed", rebuildMenu);
    let lastEdge = "";
    edgeTimer = setInterval(() => {
      if (!edgeEnabled || !mainWindow || mainWindow.isDestroyed() || !wallURL())
        return;
      const point = screen.getCursorScreenPoint(),
        display = screen.getDisplayNearestPoint(point),
        b = display.bounds;
      const edge =
        point.x >= b.x + b.width - 3
          ? "right"
          : point.x <= b.x + 2
            ? "left"
            : "";
      const key = `${display.id}:${edge}`;
      if (edge && key !== lastEdge)
        mainWindow.webContents.send("borderless:edge", {
          edge,
          y: Math.max(0, Math.min(1, (point.y - b.y) / b.height)),
        });
      lastEdge = edge ? key : "";
    }, 32);
    tempDir = await mkdtemp(join(tmpdir(), "borderless-"));
    ipcMain.handle("borderless:open-asset", async (event, input) => {
      if (!authorised(event))
        throw new Error("This request did not come from the room application.");
      if (
        !input ||
        !/^[-\w]{8,48}$/.test(input.roomId) ||
        !/^[a-f0-9-]{36}$/.test(input.assetId)
      )
        throw new Error("Invalid file reference.");
      const stateResponse = await event.sender.session.fetch(
        `${origin}/api/rooms/${input.roomId}/state`,
      );
      if (!stateResponse.ok)
        throw new Error("Join this room before opening a file.");
      const state = await stateResponse.json();
      const item = state.items.find((i) => i.assetId === input.assetId);
      if (!item || !(state.me.role === "admin" || item.ownerId === state.me.id))
        throw new Error(
          "Only the sender or room leader can open this file on the host.",
        );
      const extension = extname(item.title).toLowerCase();
      if (
        ![
          ".pdf",
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".webp",
          ".txt",
          ".md",
          ".csv",
          ".json",
          ".mp3",
          ".wav",
          ".mp4",
          ".m4a",
          ".mov",
          ".webm",
          ".ogg",
          ".docx",
          ".xlsx",
          ".pptx",
        ].includes(extension)
      )
        throw new Error("This file type cannot be opened by Borderless.");
      const confirm = await dialog.showMessageBox(
        BrowserWindow.fromWebContents(event.sender),
        {
          type: "question",
          title: "Open in a local application?",
          message: `Open ${item.title}?`,
          detail:
            "This opens the shared file using this computer’s default application. Only open content you trust.",
          buttons: ["Cancel", "Open file"],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        },
      );
      if (confirm.response !== 1) return { opened: false };
      const response = await event.sender.session.fetch(
        `${origin}/api/rooms/${input.roomId}/assets/${input.assetId}?download=1`,
      );
      if (
        !response.ok ||
        Number(response.headers.get("content-length")) > 25 * 1024 * 1024
      )
        throw new Error("The file could not be downloaded.");
      const file = Buffer.from(await response.arrayBuffer());
      if (
        file.length > 25 * 1024 * 1024 ||
        createHash("sha256").update(file).digest("hex") !== item.hash
      )
        throw new Error("The file failed its integrity check.");
      const filename = join(tempDir, `${input.assetId}${extension}`);
      await writeFile(filename, file, { mode: 0o600 });
      const result = await shell.openPath(filename);
      if (result) throw new Error(result);
      return { opened: true };
    });
    app.on("activate", () => {
      if (!windows.size) mainWindow = newWindow(`${origin}/`);
    });
  })
  .catch(async (error) => {
    await dialog.showMessageBox({
      type: "error",
      title: "Borderless could not start",
      message: error.message,
    });
    app.quit();
  });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
let quitting = false;
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  clearInterval(edgeTimer);
  Promise.all([
    hub?.close(),
    tempDir ? rm(tempDir, { recursive: true, force: true }) : undefined,
  ]).finally(() => app.quit());
});
