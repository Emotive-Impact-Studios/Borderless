const networkPermissions = new Set(["local-network-access", "local-network", "loopback-network"]);

// Only our main-frame hub may request these capabilities. Chromium's network
// permissions are separate from the operating system's Local Network consent.
export function roomPermissionHandler(origin, prompt) {
  const granted = new Set(), pending = new Map();
  return (contents, permission, callback, details = {}) => {
    try {
      if (!contents || details.isMainFrame === false ||
          new URL(contents.getURL()).origin !== origin ||
          (details.requestingUrl && new URL(details.requestingUrl).origin !== origin)) {
        callback(false);
        return;
      }
    } catch {
      callback(false);
      return;
    }
    if (["display-capture", "fullscreen"].includes(permission)) {
      callback(true);
      return;
    }
    if (!networkPermissions.has(permission)) {
      callback(false);
      return;
    }
    if (granted.has(permission)) {
      callback(true);
      return;
    }
    if (!pending.has(permission)) {
      const decision = Promise.resolve().then(() => prompt(contents, {
        type: "question",
        title: "Connect to your room?",
        message: permission === "loopback-network" ? "Allow connections to this computer’s room hub?" : "Allow connections to devices in your room?",
        detail: `Borderless uses local connections for files and live screens. Only the room application at ${origin} receives this permission for this app session. macOS may also ask for Local Network access.`,
        buttons: ["Cancel", "Allow connection"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })).then(result => {
        return result.response === 1;
      }).catch(() => false).finally(() => pending.delete(permission));
      pending.set(permission, decision);
    }
    pending.get(permission).then(allowed => {
      // The window may have navigated while the native prompt was open.
      try {
        const approved = allowed && !contents.isDestroyed() && new URL(contents.getURL()).origin === origin;
        if (approved) granted.add(permission);
        callback(approved);
      }
      catch { callback(false); }
    });
  };
}
