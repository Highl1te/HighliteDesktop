// Global error handler for the renderer process
export class ErrorBoundary {
  static instance;
  errorCount = 0;
  maxErrors = 10;

  static getInstance() {
    if (!ErrorBoundary.instance) {
      ErrorBoundary.instance = new ErrorBoundary();
    }
    return ErrorBoundary.instance;
  }

  init() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError('JavaScript Error', event.error || event.message, {
        filename: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError('Unhandled Promise Rejection', event.reason);
      event.preventDefault(); // Prevent the error from being logged to console
    });

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.handleError('Resource Load Error', `Failed to load ${event.target?.src || event.target?.href || 'unknown resource'}`);
      }
    }, true);

    console.log('[ErrorBoundary] Initialized');
  }

  handleError(type, error, details) {
    this.errorCount++;
    
    const errorInfo = {
      type,
      message: error?.message || error?.toString() || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      details
    };

    console.error(`[${type}]`, errorInfo);

    // Send error to main process if available
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('renderer-error', errorInfo);
    }

    // If too many errors, suggest restart
    if (this.errorCount >= this.maxErrors) {
      this.showCriticalErrorDialog();
    }
  }

  showCriticalErrorDialog() {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: Arial, sans-serif;
    `;

    dialog.innerHTML = `
      <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; text-align: center;">
        <h3 style="color: #d32f2f; margin: 0 0 16px 0;">⚠️ Critical Error</h3>
        <p style="margin: 0 0 16px 0;">Multiple errors have occurred. Please restart the application.</p>
        <button onclick="window.location.reload()" style="background: #1976d2; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
          Restart Application
        </button>
      </div>
    `;

    document.body.appendChild(dialog);
  }

  reset() {
    this.errorCount = 0;
  }
}

// Initialize error boundary when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ErrorBoundary.getInstance().init();
  });
} else {
  ErrorBoundary.getInstance().init();
}

// Export for use in other modules
window.ErrorBoundary = ErrorBoundary.getInstance();
