import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { WindowStateManager } from '../../windowState';

import "./modules/userPasswordManagement"; // Import user password management module
import "./modules/windowEventManagement"; // Import window event management module


app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

export async function createClientWindow() {
    // Initialize window state manager
    const windowStateManager = new WindowStateManager('client', { width: 1200, height: 800 });
    const state = windowStateManager.getState();
    
    const mainWindow = new BrowserWindow({
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: true, // Enable sandboxing for security
            contextIsolation: true, // Enable context isolation
            nodeIntegration: false, // Disable node integration in renderer
            webSecurity: true, // Enable web security
        },
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        minHeight: 500,
        minWidth: 500,
        icon: path.join(__dirname, 'static/icons/icon.png'),
        titleBarStyle: 'hidden',
        show: false, // Don't show initially to prevent flash
    });

    // Setup window state management
    windowStateManager.setupWindow(mainWindow);

    mainWindow.setMenu(null);

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/client.html`)
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/client/client.html'))
    }

    // Open Links in External Browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Allow pressing F12 to open dev tools (development only)
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
            event.preventDefault();
            if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
                mainWindow.webContents.toggleDevTools();
            }
        }
    });
  
    // Enable Zooming Page In and Out
    mainWindow.webContents.on('zoom-changed', (_event, zoomDirection) => {
        if (zoomDirection === 'in') {
            // Increase zoom factor by 0.1 and dispatch a resize event to adjust the layout
            mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.1);
        }
        else if (zoomDirection === 'out') {
            // Decrease zoom factor by 0.1 and dispatch a resize event to adjust the layout
            mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.1);
        }
    });
    
    mainWindow.on('ready-to-show', () => {
        // Always start with zoom reset to 0.0
        mainWindow.webContents.setZoomLevel(0);
        mainWindow.show(); // Show window after it's ready
    });
  
    mainWindow.webContents.send('is-darwin', process.platform === 'darwin');

    return mainWindow;
}

