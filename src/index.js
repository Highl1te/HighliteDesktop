const { app, BrowserWindow, shell } = require('electron');
const { ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');

log.initialize();

autoUpdater.autoDownload = false;
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.logger.transports.console.level = 'info';

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Log the app version
log.info('App version:', app.getVersion());

let windows = new Set();

function initializeTitle(mainWindow) {
    const args = process.argv;
    const profileArg = args.find(arg => arg.startsWith('--profile='));

    let title = `HighLite`;

    if (profileArg) {
        let profileName = profileArg.split('=')[1];
        title = `${profileName} - HighLite`;
    }

    mainWindow.webContents.send('set-title', { title });
}

async function createWindow() {
    const mainWindow = new BrowserWindow({
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: false,
            enablePreferredSizeMode: true
        },
        minHeight: 500,
        minWidth: 500,
        icon: path.join(__dirname, 'static/icons/icon.png'),
        ...(process.platform !== 'darwin' ? {
            titleBarOverlay: {
                color: '#141414',
                symbolColor: '#eee',
                height: 25
            },
        } : {}),
        show: false,
    });

    mainWindow.setMenu(null);

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.setVisualZoomLevelLimits(0.25, 5);

    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }
        
    mainWindow.on('closed', () => {
        windows.delete(mainWindow);
    });

    // Listen for "ui-ready" signal from renderer
    ipcMain.once('ui-ready', () => {
        initializeTitle(mainWindow);
    });

    mainWindow.show();

    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow.webContents.send('download-progress', progressObj.percent);
    });

    windows.add(mainWindow);
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
    updateWindow.webContents.openDevTools();

    windows.add(updateWindow);

    updateWindow.on('ready-to-show', () => {
        autoUpdater.checkForUpdates();
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

    ipcMain.once('install-update', async () => {
        autoUpdater.quitAndInstall();
    });

    ipcMain.once('download-update', async () => {
        autoUpdater.downloadUpdate();
    });

    ipcMain.once('delay-update', async () => {
        updateWindow.close();
        windows.delete(updateWindow);
        createWindow();
    });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

app.whenReady().then(() => {
    if (!app.isPackaged) {
        createWindow();
    } else {
        createUpdateWindow();
    }

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (windows.size === 0) {
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

