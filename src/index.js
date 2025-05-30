const { app, ipcMain, BrowserWindow, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const keytar = require('keytar');
const path = require('path');
const log = require('electron-log');
const SERVICE_NAME = 'HighLite';
log.initialize({ spyRendererConsole: true });

autoUpdater.autoDownload = false;
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.logger.transports.console.level = 'info';

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Log the app version
log.info('App version:', app.getVersion());

// Password Handling
ipcMain.handle("save-username-password", async (event, username, password) => {
    try {
        await keytar.setPassword(SERVICE_NAME, username, password);
        log.info(`Saved credential for ${username}`);
    } catch (err) {
        log.error('Failed to save credential:', err);
    }
});

ipcMain.handle("get-saved-usernames", async () => {
    try {
        const credentials = await keytar.findCredentials(SERVICE_NAME);
        return credentials.map(c => c.account);
    } catch (err) {
        log.error('Failed to list usernames:', err);
        return [];
    }
});

ipcMain.handle("get-saved-password", async (event, username) => {
    try {
        const password = await keytar.getPassword(SERVICE_NAME, username);
        return password || '';
    } catch (err) {
        log.error(`Failed to get password for ${username}:`, err);
        return '';
    }
});

ipcMain.handle("delete-username-password", async (event, username) => {
    try {
        await keytar.deletePassword(SERVICE_NAME, username);
        log.info(`Deleted credential for ${username}`);
    } catch (err) {
        log.error(`Failed to delete credential for ${username}:`, err);
    }
});

// Window Controls Handling
ipcMain.on('minimize-window', (event) => {
    // Get the BrowserWindow instance from the event
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window && window.isMinimizable()) {
        window.minimize();
    }
});

ipcMain.on('toggle-maximize-window', (event) => {
    // Get the BrowserWindow instance from the event
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        if (window.isMaximized()) {
            window.unmaximize();
        } else {
            window.maximize();
        }
    }
});

ipcMain.on('close-window', (event) => {
    // Get the BrowserWindow instance from the event
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
        window.close();
    }
});

// UI Ready Handling
ipcMain.on('ui-ready', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window.show();
});

// Dev Tools Handling
ipcMain.on('show-dev-tools', (event) => {
    // Get the BrowserWindow instance from the event
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.webContents.toggleDevTools();
    }
});


windows = [];
async function createWindow() {
    const mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: false,
            enablePreferredSizeMode: true,
        },
        minHeight: 500,
        minWidth: 500,
        icon: path.join(__dirname, 'static/icons/icon.png'),
        titleBarStyle: 'hidden',
        show: false,
    });

    mainWindow.setMenu(null);
    windows.push(mainWindow);
    mainWindow.loadURL(path.join('file://', __dirname, `index.html?windowID=${windows.length - 1}`));

    // Open Links in External Browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Allow pressing F12 to open dev tools
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
            event.preventDefault();
            mainWindow.webContents.toggleDevTools();
        }
    });

    // Enable Zooming Page In and Out
    mainWindow.webContents.on('zoom-changed', (event, zoomDirection) => {
        if (zoomDirection === 'in') {
            // Increase zoom factor by 0.1 and dispatch a resize event to adjust the layout
            mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.1);
        }
        else if (zoomDirection === 'out') {
            // Decrease zoom factor by 0.1 and dispatch a resize event to adjust the layout
            mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.1);
        }
    });

    mainWindow.on('closed', () => {
        // Remove the window from the array when closed
        windows = windows.filter(win => win !== mainWindow);
    });

    mainWindow.on('ready-to-show', (event) => {
        console.log(event);
        // Always start with zoom reset to 0.0
        mainWindow.webContents.setZoomLevel(0);
    });

    mainWindow.webContents.send('is-darwin', process.platform === 'darwin');
}

async function createUpdateWindow() {
    const updateWindow = new BrowserWindow({
        title: 'Updating HighLite...',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        frame: true,
        resizable: false,
        icon: path.join(__dirname, 'static/icons/icon.png'),
        titleBarStyle: 'hidden',
        width: 600,
        height: 400,
    });

    updateWindow.loadFile(path.join(__dirname, 'update.html'));
    // Open dev tools if not packaged
    if (!app.isPackaged) {
      updateWindow.webContents.openDevTools();
    }

    updateWindow.on('ready-to-show', async () => {
        if (!app.isPackaged) {
          // Fire delay-update event to delay the update
          // This is a workaround to prevent the update window from closing immediately
          // when the app is not packaged

          await createWindow();
          updateWindow.close();

        } else {
           autoUpdater.checkForUpdates();
        }
        
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
        updateWindow.webContents.send('download-progress', progressObj.percent);
    });

    autoUpdater.on('update-downloaded', async () => {
        updateWindow.webContents.send('update-downloaded');
    });

    autoUpdater.on('update-available', async (updateInfo) => {
        log.info('Update available:', updateInfo.releaseName);
        updateWindow.webContents.send('update-available', updateInfo);
    });

    autoUpdater.on('update-not-available', async () => {
        log.info('Update not available');
        await createWindow();
        updateWindow.close();
    });

    ipcMain.once('install-update', async () => {
        autoUpdater.quitAndInstall();
    });

    ipcMain.once('download-update', async () => {
        autoUpdater.downloadUpdate();
    });

    ipcMain.once('delay-update', async () => {
        await createWindow();
        updateWindow.close();
    });

    // Open Links in External Browser
    updateWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

app.whenReady().then(() => {
    createUpdateWindow();

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('second-instance', (event, argv, workingDirectory) => {
    // Someone tried to run a second instance, open a new window in response.
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

