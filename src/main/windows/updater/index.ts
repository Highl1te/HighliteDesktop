import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import path from 'path';

autoUpdater.autoDownload = false; // Disable auto download to control it manually

export async function createUpdateWindow() {
    const updateWindow = new BrowserWindow({
        title: 'Updating HighLite...',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false, // Disable sandboxing for compatibility with some libraries
        },
        frame: true,
        resizable: false,
        icon: path.join(__dirname, 'static/icons/icon.png'),
        titleBarStyle: 'hidden',
        width: 600,
        height: 400,
    });

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        updateWindow.loadURL(
            `${process.env['ELECTRON_RENDERER_URL']}/update.html`
        );
    } else {
        updateWindow.loadFile(path.join(__dirname, '../renderer/update.html'));
    }

    updateWindow.on('ready-to-show', async () => {
        if (!app.isPackaged) {
            ipcMain.emit('delay-update');
        } else {
            autoUpdater.checkForUpdates();
        }
    });

    autoUpdater.on('download-progress', progressObj => {
        log.info('Download progress:', progressObj.percent);
        updateWindow.webContents.send('download-progress', progressObj.percent);
    });

    autoUpdater.on('update-downloaded', async () => {
        log.info('Update downloaded');
        updateWindow.webContents.send('update-downloaded');
    });

    autoUpdater.on('update-available', async updateInfo => {
        log.info('Update available:', updateInfo.releaseName);
        updateWindow.webContents.send('update-available', updateInfo);
    });

    autoUpdater.on('update-not-available', async () => {
        log.info('Update not available');
        ipcMain.emit('no-update-available');
    });

    ipcMain.once('install-update', async () => {
        log.info('Installing update...');
        autoUpdater.quitAndInstall();
    });

    ipcMain.once('download-update', async () => {
        log.info('Downloading update...');
        autoUpdater.downloadUpdate();
    });

    ipcMain.once('delay-update', async () => {
        log.info('Update delayed');
    });

    // Open Links in External Browser
    updateWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    return updateWindow;
}
