// Copyright (C) 2025  HighLite

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { app, ipcMain, BrowserWindow } from 'electron';
import { createUpdateWindow } from './windows/updater';
import { createClientWindow } from './windows/client';
import { createConsoleWindow } from './windows/console';
import { electronApp } from '@electron-toolkit/utils';
import log from 'electron-log';

log.initialize({ spyRendererConsole: true });
log.transports.console.level = 'info';
log.transports.file.level = 'debug';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

// Keep a reference to the hidden console window so we can close it when no other windows remain
let consoleWindowRef: BrowserWindow | null = null;

app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.highlite.desktop');
    const updateWindow: BrowserWindow = await createUpdateWindow();

    consoleWindowRef = await createConsoleWindow();
    consoleWindowRef.on('closed', () => {
        consoleWindowRef = null;
    });

    ipcMain.once('delay-update', async () => {
        await createClientWindow();
        updateWindow.close();
    });

    ipcMain.on('no-update-available', async () => {
        await createClientWindow();
        updateWindow.close();
    });

    // For any future windows created elsewhere, attach a closed handler
    // to determine when only the console window is left.
    app.on('browser-window-created', (_event, win) => {
        if (win !== consoleWindowRef) {
            win.on('closed', () => {
                const others = BrowserWindow.getAllWindows().filter(w => w !== consoleWindowRef);
                if (others.length === 0 && consoleWindowRef && !consoleWindowRef.isDestroyed()) {
                    consoleWindowRef.close();
                    consoleWindowRef = null;
                }
            });
        }
    });

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createClientWindow();
        }
    });
});

app.on('second-instance', (_event, _argv, _workingDirectory) => {
    // Someone tried to run a second instance, open a new window in response.
    createClientWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
