import { app, ipcMain, BrowserWindow } from 'electron';
import { createUpdateWindow } from './windows/updater';
import { createClientWindow } from './windows/client';
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupSecurity } from './security';
import { HealthMonitor } from './healthMonitor';
import log from 'electron-log';

// Configure logging with better settings
log.initialize({ spyRendererConsole: true });
log.transports.console.level = is.dev ? 'info' : 'info';
log.transports.file.level = 'debug';
log.transports.file.maxSize = 1024 * 1024 * 10; // 10MB max file size

// Add uncaught exception handling
process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error);
    if (!is.dev) {
        app.quit();
    }
});

process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    log.info('Another instance is already running. Exiting...');
    app.quit();
} else {
    // Handle second instance
    app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
        log.info('Second instance attempted, focusing existing window');
        // Find and focus existing window
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            const mainWindow = windows.find(w => w.getTitle().includes('HighLite')) || windows[0];
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        } else {
            createClientWindow().catch(err => log.error('Failed to create client window:', err));
        }
    });
}

ipcMain.on('renderer-error', (_event, errorInfo) => {
    log.error('Renderer Error:', errorInfo);
    
    // Could implement error reporting here
    // Example: send to crash reporting service
});

ipcMain.handle('open-highlite-window', async (_event, url: string) => {
    try {
        log.info(`Opening HighLite window for: ${url}`);
        
        const window = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true
            },
            show: false
        });
        
        window.once('ready-to-show', () => {
            window.show();
        });
        
        await window.loadURL(url);
        return true;
    } catch (error) {
        log.error('Failed to open HighLite window:', error);
        return false;
    }
});

app.whenReady().then(async () => {
    try {
        // Set up security policies first
        setupSecurity();
        
        // Start health monitoring
        const healthMonitor = HealthMonitor.getInstance();
        healthMonitor.startMonitoring();
        
        // Set app user model ID for Windows
        electronApp.setAppUserModelId('com.highlite.desktop');
        
        // Apply electron-toolkit optimizer for performance
        if (BrowserWindow.getAllWindows().length > 0) {
            optimizer.watchWindowShortcuts(BrowserWindow.getAllWindows()[0]);
        }
        
        const updateWindow = await createUpdateWindow();

        ipcMain.once('delay-update', async () => {
            try {
                await createClientWindow();
                if (!updateWindow.isDestroyed()) {
                    updateWindow.close();
                }
            } catch (error) {
                log.error('Failed to create client window:', error);
            }
        });

        ipcMain.on('no-update-available', async () => {
            try {
                await createClientWindow();
                if (!updateWindow.isDestroyed()) {
                    updateWindow.close();
                }
            } catch (error) {
                log.error('Failed to create client window:', error);
            }
        });

        app.on('activate', () => {
            // On macOS it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (BrowserWindow.getAllWindows().length === 0) {
                createClientWindow().catch(err => log.error('Failed to create client window on activate:', err));
            }
        });
    } catch (error) {
        log.error('Failed to initialize app:', error);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        log.info('All windows closed, quitting application');
        app.quit();
    }
});

// Add better app quit handling
app.on('before-quit', (_event) => {
    log.info('Application is about to quit');
    // Clean up any resources here if needed
});

// Handle certificate errors for better security
app.on('certificate-error', (event, _webContents, url, error, _certificate, callback) => {
    if (is.dev) {
        // In development, ignore certificate errors
        event.preventDefault();
        callback(true);
    } else {
        // In production, use default behavior (reject invalid certificates)
        log.warn(`Certificate error for ${url}: ${error}`);
        callback(false);
    }
});