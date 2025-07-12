import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';

export class FPSLimiter extends Plugin {
    pluginName = 'FPS Limiter';
    author = 'Highlite';
    private originalRAF?: typeof window.requestAnimationFrame;
    private rafPatched = false;
    private lastFrameTime = 0;
    private frameTimeThreshold = 0;

    constructor() {
        super();
        this.settings.targetFPS = {
            text: 'Target FPS',
            type: SettingsTypes.range,
            value: 60,
            callback: () => {
                if (this.settings.enable.value) {
                    this.stop();
                    this.start();
                }
            },
        };
    }

    init(): void {
        this.log('Initializing FPS Limiter');
    }

    start(): void {
        if (this.rafPatched) return;
        if (!this.settings.enable.value) return;

        const targetFPS = Number(this.settings.targetFPS.value);

        this.rafPatched = true;
        this.frameTimeThreshold = 1000 / targetFPS;
        this.lastFrameTime = performance.now();

        this.originalRAF = window.requestAnimationFrame.bind(window);

        window.requestAnimationFrame = (
            callback: FrameRequestCallback
        ): number => {
            return this.originalRAF!(currentTime => {
                const deltaTime = currentTime - this.lastFrameTime;

                if (deltaTime >= this.frameTimeThreshold) {
                    // Enough time has passed, execute the callback immediately
                    this.lastFrameTime = currentTime;
                    callback(currentTime);
                } else {
                    // Not enough time has passed, delay the callback
                    const delay = Math.max(
                        0,
                        this.frameTimeThreshold - deltaTime
                    );
                    setTimeout(() => {
                        const now = performance.now();
                        this.lastFrameTime = now;
                        callback(now);
                    }, delay);
                }
            });
        };

        this.log(
            `[FPSLimiter] Frame rate limited to ${targetFPS} FPS (${this.frameTimeThreshold.toFixed(2)}ms per frame)`
        );
    }

    stop(): void {
        if (this.rafPatched && this.originalRAF) {
            window.requestAnimationFrame = this.originalRAF;
            this.rafPatched = false;
            this.lastFrameTime = 0;
            this.frameTimeThreshold = 0;
            this.log(
                '[FPSLimiter] Frame rate limiting disabled - restored to native refresh rate'
            );
        }
    }
}
