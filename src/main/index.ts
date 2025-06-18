import { app, ipcMain, BrowserWindow } from 'electron';
import { createUpdateWindow } from './windows/updater';
import { createClientWindow } from './windows/client';
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log';

log.initialize({ spyRendererConsole: true });
log.transports.console.level = 'info';
log.transports.file.level = 'debug';


const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.highlite')
    const updateWindow : BrowserWindow = await createUpdateWindow();

    ipcMain.once('delay-update', async () => {
        await createClientWindow();
        updateWindow.close();
    });

    ipcMain.on('no-update-available', async () => {
        await createClientWindow();
        updateWindow.close();
    });


    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createClientWindow();
        }
    });
});

app.on('second-instance', (event, argv, workingDirectory) => {
    // Someone tried to run a second instance, open a new window in response.
    createClientWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});