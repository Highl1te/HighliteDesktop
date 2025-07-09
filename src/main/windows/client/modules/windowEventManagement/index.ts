import { ipcMain, BrowserWindow } from 'electron';

// Window Controls Handling
ipcMain.on('minimize-window', (event) => {
    // Get the BrowserWindow instance from the event
    const window = BrowserWindow.fromWebContents(event.sender);
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
