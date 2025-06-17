import { BrowserWindow } from 'electron';
import log from 'electron-log';

export class HealthMonitor {
  private static instance: HealthMonitor;
  private checkInterval: NodeJS.Timeout | null = null;
  private isHealthy: boolean = true;

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  startMonitoring(intervalMs: number = 30000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    log.info('Health monitoring started');
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    log.info('Health monitoring stopped');
  }

  private performHealthCheck() {
    try {
      const now = Date.now();
      
      // Check if app is responsive
      const windows = BrowserWindow.getAllWindows();
      const memoryUsage = process.memoryUsage();
      
      // Memory usage warning (>500MB)
      if (memoryUsage.heapUsed > 500 * 1024 * 1024) {
        log.warn('High memory usage detected:', Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB');
      }

      // Check if windows are responsive
      let unresponsiveWindows = 0;
      windows.forEach(window => {
        if (!window.isDestroyed() && !window.webContents.isLoading()) {
          // Window exists and is not loading
        } else if (!window.isDestroyed()) {
          unresponsiveWindows++;
        }
      });

      if (unresponsiveWindows > 0) {
        log.warn(`${unresponsiveWindows} unresponsive windows detected`);
      }

      // Update health status
      this.isHealthy = memoryUsage.heapUsed < 1024 * 1024 * 1024 && unresponsiveWindows === 0; // 1GB memory limit

      // Log health info periodically
      if (now % (5 * 60 * 1000) < 30000) { // Every 5 minutes
        log.info('Health check:', {
          windows: windows.length,
          memory: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
          uptime: Math.round(process.uptime() / 60) + 'min',
          healthy: this.isHealthy
        });
      }

    } catch (error) {
      log.error('Health check failed:', error);
      this.isHealthy = false;
    }
  }

  getHealthStatus(): { healthy: boolean; uptime: number; memoryMB: number; windowCount: number } {
    const memoryUsage = process.memoryUsage();
    return {
      healthy: this.isHealthy,
      uptime: process.uptime(),
      memoryMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      windowCount: BrowserWindow.getAllWindows().length
    };
  }

  forceGarbageCollection() {
    if (global.gc) {
      global.gc();
      log.info('Garbage collection performed');
    } else {
      log.warn('Garbage collection not available (run with --expose-gc)');
    }
  }
}
