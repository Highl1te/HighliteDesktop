import { app, screen } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

interface WindowState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

export class WindowStateManager {
  private windowState: WindowState = {};
  private stateFile: string;

  constructor(windowName: string, defaultSize: { width: number; height: number }) {
    this.stateFile = path.join(app.getPath('userData'), `window-state-${windowName}.json`);
    this.loadState(defaultSize);
  }

  private loadState(defaultSize: { width: number; height: number }) {
    try {
      if (fs.existsSync(this.stateFile)) {
        const data = fs.readFileSync(this.stateFile, 'utf8');
        this.windowState = JSON.parse(data);
      }
    } catch (error) {
      log.error('Failed to load window state:', error);
    }

    // Set defaults if no state exists
    if (!this.windowState.width || !this.windowState.height) {
      const { workAreaSize } = screen.getPrimaryDisplay();
      this.windowState = {
        width: Math.min(defaultSize.width, workAreaSize.width),
        height: Math.min(defaultSize.height, workAreaSize.height),
        x: Math.round((workAreaSize.width - defaultSize.width) / 2),
        y: Math.round((workAreaSize.height - defaultSize.height) / 2),
        isMaximized: false,
        isFullScreen: false,
      };
    }

    // Ensure window is visible on current displays
    this.ensureVisibleOnDisplay();
  }

  private ensureVisibleOnDisplay() {
    const displays = screen.getAllDisplays();
    const windowBounds = {
      x: this.windowState.x || 0,
      y: this.windowState.y || 0,
      width: this.windowState.width || 800,
      height: this.windowState.height || 600,
    };

    const isVisible = displays.some(display => {
      const { x, y, width, height } = display.workArea;
      return (
        windowBounds.x >= x &&
        windowBounds.y >= y &&
        windowBounds.x + windowBounds.width <= x + width &&
        windowBounds.y + windowBounds.height <= y + height
      );
    });

    if (!isVisible) {
      const primaryDisplay = screen.getPrimaryDisplay();
      this.windowState.x = Math.round((primaryDisplay.workAreaSize.width - windowBounds.width) / 2);
      this.windowState.y = Math.round((primaryDisplay.workAreaSize.height - windowBounds.height) / 2);
    }
  }

  saveState(window: Electron.BrowserWindow) {
    try {
      if (!window.isDestroyed()) {
        const bounds = window.getBounds();
        this.windowState = {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: window.isMaximized(),
          isFullScreen: window.isFullScreen(),
        };

        fs.writeFileSync(this.stateFile, JSON.stringify(this.windowState, null, 2));
      }
    } catch (error) {
      log.error('Failed to save window state:', error);
    }
  }

  getState(): WindowState {
    return { ...this.windowState };
  }

  setupWindow(window: Electron.BrowserWindow) {
    // Restore maximized state
    if (this.windowState.isMaximized) {
      window.maximize();
    }

    // Restore fullscreen state
    if (this.windowState.isFullScreen) {
      window.setFullScreen(true);
    }

    // Save state on window events
    const saveState = () => this.saveState(window);
    
    window.on('close', saveState);
    window.on('resize', saveState);
    window.on('move', saveState);
    window.on('maximize', saveState);
    window.on('unmaximize', saveState);
    window.on('enter-full-screen', saveState);
    window.on('leave-full-screen', saveState);
  }
}
