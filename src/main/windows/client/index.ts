import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { format } from 'url';

import './modules/userPasswordManagement'; // Import user password management module
import './modules/windowEventManagement'; // Import window event management module

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

export async function createClientWindow() {
    const mainWindow = new BrowserWindow({
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false, // Disable sandboxing for compatibility with some libraries
            webSecurity: app.isPackaged, // Disable web security only in development for CORS
        },
        minHeight: 500,
        minWidth: 500,
        icon: path.join(__dirname, 'static/icons/icon.png'),
        titleBarStyle: 'hidden',
        show: true,
    });

    mainWindow.setMenu(null);

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        const devUrl = `${process.env['ELECTRON_RENDERER_URL']}/client.html`;
        console.log('Loading dev URL:', devUrl);
        mainWindow.loadURL(devUrl);
    } else {
        const fileUrl = format({
            protocol: 'file',
            slashes: true,
            pathname: path.join(__dirname, '../renderer/client.html'),
            query: { windowId: mainWindow.id },
        });

        mainWindow.loadURL(fileUrl);
    }

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
            mainWindow.webContents.setZoomLevel(
                mainWindow.webContents.getZoomLevel() + 0.1
            );
        } else if (zoomDirection === 'out') {
            // Decrease zoom factor by 0.1 and dispatch a resize event to adjust the layout
            mainWindow.webContents.setZoomLevel(
                mainWindow.webContents.getZoomLevel() - 0.1
            );
        }
    });

    // In development, modify requests to High Spell servers
    if (!app.isPackaged) {
        // Set user agent and origin for High Spell compatibility
        mainWindow.webContents.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
            (details, callback) => {
                if (details.url.includes('highspell.com')) {
                    details.requestHeaders['Origin'] = 'https://highspell.com';
                    details.requestHeaders['Referer'] =
                        'https://highspell.com/';
                }
                callback({ requestHeaders: details.requestHeaders });
            }
        );
    }

    mainWindow.on('ready-to-show', () => {
        // Always start with zoom reset to 0.0
        mainWindow.webContents.setZoomLevel(0);
    });

    mainWindow.webContents.send('is-darwin', process.platform === 'darwin');

    return mainWindow;
}
