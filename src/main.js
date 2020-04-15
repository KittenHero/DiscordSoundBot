const fs = require("fs").promises;
const path = require("path");
const {
  app,
  autoUpdater,
  BrowserWindow,
  dialog,
  ipcMain,
} = require("electron");
const Discord = require("discord.js");

const prod = process.env.NODE_ENV === "production";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      devTools: !prod,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.removeMenu();
  mainWindow.webContents.on("will-navigate", (e) => e.prevenetDefault());
  if (!prod) {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

class IPCClient extends Discord.Client {
  get voiceGuilds() {
    return this.guilds.cache
      .filter((g) => g.channels.cache.some((ch) => ch.type === "voice"))
      .array();
  }

  voiceChannelsIn(guild) {
    return guild.channels.cache
      .filter((ch) => ch.type == "voice" && ch.joinable)
      .array();
  }

  destroy() {
    super.destroy();
    global.discordClient = new IPCClient();
  }
}

global.discordClient = new IPCClient();
const configPath = path.join(app.getAppPath(), "config.json");

ipcMain.handle("read-config", (_event) => {
  return fs
    .readFile(configPath)
    .then((data) => JSON.parse(data))
    .catch(() => ({}));
});

ipcMain.handle("save-config", (_event, config) => {
  fs.writeFile(configPath, JSON.stringify(config, null, 2));
});

(async () => {
  if (!prod || !app.isPackaged || process.platform !== "win32") return;

  const rawpkg = await fs.readFile(path.join(app.getAppPath(), "package.json"));
  const pkg = JSON.parse(rawpkg);
  autoUpdater.setFeedURL({
    url: `https://update.electronjs.org/${pkg.repository.owner}/${
      pkg.repository.name
    }/${process.platform}-${process.arch}/${app.getVersion()}`,
  });

  autoUpdater.on("update-downloaded", (_event, releaseNotes) => {
    const message = {
      type: "info",
      buttons: ["Restart", "Later"],
      title: "Application Update",
      message: releaseNotes,
      detail:
        "A new version has been downloaded. Restart the application to apply the updates.",
    };

    dialog.showMessageBox(message, (response) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 1000 * 60 * 10);
})();
