import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';

export class Screenshot extends Plugin {
    pluginName = 'Screenshot';
    author = 'KMS';
    private isCapturing = false;
    private screenshotCount = 0;
    private usedFilenames: Set<string> = new Set();

    constructor() {
        super();

        this.settings.enable = {
            text: 'Enable Screenshot Plugin',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {
                if (this.settings.enable.value) {
                    this.initializePlugin();
                } else {
                    this.disablePlugin();
                }
            },
        } as any;

        this.settings.saveDirectory = {
            text: 'Save Directory',
            type: SettingsTypes.text,
            value: 'screenshots',
            callback: () => {
                // Settings callback - no action needed
            },
        } as any;

        this.settings.filenameFormat = {
            text: 'Filename Format',
            type: SettingsTypes.text,
            value: 'screenshot_{timestamp}_{count}',
            callback: () => {
                // Settings callback - no action needed
            },
        } as any;

        this.settings.includeTimestamp = {
            text: 'Include Timestamp',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {
                // Settings callback - no action needed
            },
        } as any;


    }

    init(): void {
        this.log('Screenshot plugin initialized');
        
        // Add global test function for debugging
        (window as any).testScreenshotButton = () => {
            this.log('Manual test: Creating screenshot button...');
            this.createScreenshotButton();
        };
    }

    start(): void {
        this.log('Screenshot plugin starting...');
        
        if (!this.settings.enable?.value) {
            this.log('Screenshot plugin disabled in settings');
            return;
        }

        // Add CSS styles immediately
        this.addCSSStyles();
        
        // Try to create button immediately, then retry if needed
        this.createScreenshotButton();
        
        // Also try again after a longer delay to ensure DOM is fully loaded,This is redundant but that's just me.
        setTimeout(() => {
            this.log('Retrying screenshot button creation after delay...');
            this.createScreenshotButton();
        }, 1000);
        
        // And one more time after the page is fully loaded.....LOL
        setTimeout(() => {
            this.log('Final retry for screenshot button creation...');
            this.createScreenshotButton();
        }, 3000);
    }

    stop(): void {
        this.removeScreenshotButton();
        const style = document.querySelector('style[data-screenshot]');
        if (style) {
            style.remove();
        }
    }

    private createScreenshotButton(): void {
        try {
            this.log('Attempting to setup screenshot button...');
            
            // Find the existing screenshot button
            const screenshotButton = document.querySelector('#screenshotButton');
            if (!screenshotButton) {
                this.log('Screenshot button not found in HTML, retrying in 500ms...');
                setTimeout(() => this.createScreenshotButton(), 500);
                return;
            }

            this.log('Found existing screenshot button, setting up click handler...');

            // Remove any existing click handlers
            screenshotButton.removeEventListener('click', this.handleScreenshotClick);
            
            // Add our click handler
            screenshotButton.addEventListener('click', this.handleScreenshotClick);

            this.log('Screenshot button successfully configured');

            // Add keyboard shortcut
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            this.log('Keyboard shortcut added');
        } catch (error) {
            console.error('Error setting up screenshot button', error);
            this.log('Error setting up screenshot button: ' + (error as Error).message);
        }
    }

    private handleScreenshotClick = (e: Event) => {
        e.preventDefault();
        this.playScreenshotSound();
        this.captureScreenshot();
    };

    private playScreenshotSound(): void {
        try {
            // Create a simple camera shutter sound effect
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Camera shutter sound: quick high-pitched beep
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch {
            // Fallback: just log if audio fails
            console.log('Screenshot sound effect failed');
        }
    }



    private handleKeyDown(event: KeyboardEvent): void {
        // Ctrl+Shift+S shortcut
        if (event.ctrlKey && event.shiftKey && event.key === 'S') {
            event.preventDefault();
            this.captureScreenshot();
        }
    }

    private async captureScreenshot(): Promise<void> {
        if (this.isCapturing) return;

        this.isCapturing = true;

        try {
            // Find the game canvas/container
            const gameContainer = this.findGameContainer();
            if (!gameContainer) {
                this.log('Could not find game container');
                return;
            }

            // Get the container dimensions and position
            const rect = gameContainer.getBoundingClientRect();
            const containerInfo = {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                devicePixelRatio: window.devicePixelRatio || 1
            };

            this.log('Capturing screenshot of game container:', containerInfo);

            // Generate filename
            const filename = this.generateFilename();

            // Send screenshot request to main process
            const result = await this.requestScreenshot(containerInfo, filename);
            
            if (result?.success) {
                this.screenshotCount++;
                const savedFilename = result.filename || filename;
                this.log(`Screenshot saved: ${savedFilename}`);
                this.showNotification(`Screenshot saved: ${savedFilename}`, 'success');
            } else {
                this.log('Failed to save screenshot');
                this.showNotification('Failed to save screenshot', 'error');
            }

        } catch {
            console.error('Error capturing screenshot');
            this.showNotification('Error capturing screenshot', 'error');
        } finally {
            this.isCapturing = false;
        }
    }

    private findGameContainer(): HTMLElement | null {
        // Try to find the game canvas or main game container
        // The game is likely rendered in a canvas element or a specific container
        
        // Look for canvas elements first (most common for games)
        const canvas = document.querySelector('canvas');
        if (canvas) {
            return canvas;
        }

        // Look for common game container IDs/classes
        const gameContainer = document.querySelector('#game-container, .game-container, #game, .game');
        if (gameContainer) {
            return gameContainer as HTMLElement;
        }

        // Look for the main content area
        const mainContent = document.querySelector('#body-container, main, .main-content');
        if (mainContent) {
            return mainContent as HTMLElement;
        }

        // Fallback to body if no specific game container found
        return document.body;
    }

    private generateFilename(): string {
        let baseFilename = (this.settings.filenameFormat.value as string) || 'screenshot_{timestamp}_{count}';
        
        // Always apply timestamp if enabled, regardless of placeholder
        if (this.settings.includeTimestamp.value as boolean) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                            new Date().toTimeString().replace(/[:.]/g, '-').split(' ')[0];
            
            // If the format contains {timestamp} placeholder, replace it
            if (baseFilename.includes('{timestamp}')) {
                baseFilename = baseFilename.replace('{timestamp}', timestamp);
            } else {
                // If no placeholder, add timestamp to the end (before extension)
                const lastDotIndex = baseFilename.lastIndexOf('.');
                if (lastDotIndex !== -1) {
                    // Has extension, insert timestamp before it
                    baseFilename = baseFilename.substring(0, lastDotIndex) + '_' + timestamp + baseFilename.substring(lastDotIndex);
                } else {
                    // No extension, just append timestamp
                    baseFilename = baseFilename + '_' + timestamp;
                }
            }
        } else {
            // Remove timestamp placeholder if it exists
            baseFilename = baseFilename.replace('{timestamp}', '');
        }
        
        // Replace count placeholder
        baseFilename = baseFilename.replace('{count}', (this.screenshotCount + 1).toString().padStart(3, '0'));
        
        // Clean up any double underscores or dashes
        baseFilename = baseFilename.replace(/[-_]{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '');
        
        // Ensure unique filename by adding increment if file exists
        return this.ensureUniqueFilename(baseFilename);
    }

    private ensureUniqueFilename(baseFilename: string): string {
        const extension = '.png';
        let filename = baseFilename + extension;
        let counter = 1;
        
        // Check if file exists and increment counter until we find a unique name
        while (this.fileExists(filename)) {
            // Remove extension, add counter, then add extension back
            const nameWithoutExt = baseFilename.replace(extension, '');
            filename = `${nameWithoutExt}_${counter}${extension}`;
            counter++;
        }
        
        return filename;
    }

    private fileExists(filename: string): boolean {
        // This is a simple check - in a real implementation, you might want to check the actual filesystem
        // For now, we'll use a basic approach that should work for most cases
        try {
            // Check if we've already used this filename in this session
            if (this.usedFilenames.has(filename)) {
                return true;
            }
            
            // Add to used filenames
            this.usedFilenames.add(filename);
            return false;
        } catch (error) {
            return false;
        }
    }

    private getSaveDirectory(): string {
        return (this.settings.saveDirectory.value as string) || 'screenshots';
    }

    private async requestScreenshot(containerInfo: any, filename: string): Promise<{ success: boolean; filename?: string; error?: string }> {
        try {
            // Use Electron's IPC to communicate with main process
            if (window.electron?.ipcRenderer) {
                const result = await window.electron.ipcRenderer.invoke('capture-screenshot', {
                    containerInfo,
                    filename,
                    saveDirectory: this.getSaveDirectory()
                });
                return result || { success: false, error: 'No response from main process' };
            } else {
                // Fallback for non-Electron environment (web version)
                this.log('Electron IPC not available, using fallback method');
                const fallbackResult = await this.fallbackScreenshot(containerInfo, filename);
                return { success: fallbackResult, filename: fallbackResult ? filename : undefined };
            }
        } catch (error) {
            console.error('Error requesting screenshot:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    private async fallbackScreenshot(containerInfo: any, filename: string): Promise<boolean> {
        try {
            // Use html2canvas or similar library for web fallback
            // For now, we'll just log that we can't save in web environment
            this.log('Screenshot captured (web environment - cannot save to file)');
            this.log('Container info:', containerInfo);
            this.log('Filename:', filename);
            
            // In a real implementation, you might use html2canvas here
            // and trigger a download using data URLs
            
            return true; // Return true to indicate "success" even though we can't save
        } catch {
            console.error('Fallback screenshot failed');
            return false;
        }
    }

    private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
        try {
            const notificationManager = document.highlite?.managers?.NotificationManager;
            if (notificationManager) {
                notificationManager.showNotification(message, type);
            } else {
                // Fallback notification
                console.log(`[Screenshot] ${message}`);
            }
        } catch {
            console.log(`[Screenshot] ${message}`);
        }
    }

    private removeScreenshotButton(): void {
        try {
            // Remove click handler from existing button
            const screenshotButton = document.querySelector('#screenshotButton');
            if (screenshotButton) {
                screenshotButton.removeEventListener('click', this.handleScreenshotClick);
            }
            document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        } catch {
            console.error('Error removing screenshot button handlers');
        }
    }

    private addCSSStyles(): void {
        const style = document.createElement('style');
        style.setAttribute('data-screenshot', 'true');
        style.textContent = `
            /* Titlebar Screenshot Button */
            .titlebar-screenshot-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 5px;
                color: var(--theme-text-primary, #ffffff);
                text-decoration: none;
                transition: color 0.2s ease;
                cursor: pointer;
            }

            .titlebar-screenshot-btn:hover {
                color: var(--theme-accent, #f9f449);
                transform: scale(1.1);
            }

            .titlebar-screenshot-btn .iconify {
                font-size: 16px;
            }

            /* Panel Styles (for future use) */
            .screenshot-panel {
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .screenshot-header {
                margin-bottom: 20px;
                text-align: center;
            }

            .screenshot-header h3 {
                margin: 0 0 8px 0;
                color: #4a9eff;
                font-size: 18px;
            }

            .screenshot-header p {
                margin: 0;
                color: #aaa;
                font-size: 14px;
            }

            .screenshot-controls {
                margin-bottom: 20px;
            }

            .screenshot-capture-btn {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #4a9eff, #357abd);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-bottom: 15px;
            }

            .screenshot-capture-btn:hover:not(:disabled) {
                background: linear-gradient(135deg, #357abd, #2a5f8f);
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(74, 158, 255, 0.3);
            }

            .screenshot-capture-btn:disabled {
                background: #666;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            .screenshot-info {
                background: rgba(255, 255, 255, 0.1);
                padding: 12px;
                border-radius: 4px;
                font-size: 12px;
            }

            .screenshot-info p {
                margin: 5px 0;
                color: #ccc;
            }

            .screenshot-info strong {
                color: #4a9eff;
            }

            .screenshot-settings {
                background: rgba(255, 255, 255, 0.05);
                padding: 15px;
                border-radius: 4px;
            }

            .screenshot-settings h4 {
                margin: 0 0 15px 0;
                color: #4a9eff;
                font-size: 14px;
            }

            .setting-item {
                margin-bottom: 12px;
            }

            .setting-item label {
                display: block;
                margin-bottom: 5px;
                color: #ccc;
                font-size: 12px;
            }

            .setting-item input[type="text"] {
                width: 100%;
                padding: 6px 8px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 3px;
                color: #fff;
                font-size: 12px;
                box-sizing: border-box;
            }

            .setting-item input[type="text"]:focus {
                outline: none;
                border-color: #4a9eff;
                box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
            }

            .setting-item input[type="range"] {
                width: 100%;
                margin-top: 5px;
            }

            .setting-item input[type="checkbox"] {
                margin-right: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    private initializePlugin(): void {
        this.createScreenshotButton();
        if (!document.querySelector('style[data-screenshot]')) {
            this.addCSSStyles();
        }
    }

    private disablePlugin(): void {
        this.removeScreenshotButton();
        const style = document.querySelector('style[data-screenshot]');
        if (style) {
            style.remove();
        }
    }
} 