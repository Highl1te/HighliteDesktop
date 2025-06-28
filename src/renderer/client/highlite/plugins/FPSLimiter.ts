import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";

export class FPSLimiter extends Plugin {
    pluginName = "FPS Limiter";
    author = "Highlite";
    private originalRAF?: typeof window.requestAnimationFrame;
    private rafPatched = false;

    constructor() {
        super();
        this.settings.enable = {
            text: "Enable FPS Limiter",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {
                if (this.settings.enable.value) {
                    this.start();
                } else {
                    this.stop();
                }
            }
        } as any;
        this.settings.targetFPS = {
            text: "Target FPS",
            type: SettingsTypes.range,
            value: 60,
            callback: () => {
                if (this.settings.enable.value) {
                    this.stop();
                    this.start();
                }
            }
        } as any;
    }

    init(): void {
        this.log("Initializing FPS Limiter");
    }

    start(): void {
        if (this.rafPatched) return;
        if (!this.settings.enable.value) return;
        this.rafPatched = true;
        const targetFPS = Number(this.settings.targetFPS.value);
        const frameTime = 1000 / targetFPS;
        this.originalRAF = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
            return this.originalRAF!((currentTime) => {
                const delay = Math.max(0, frameTime - (performance.now() - currentTime));
                setTimeout(() => {
                    callback(performance.now());
                }, delay);
            });
        };
        this.log(`[FPSLimiter] requestAnimationFrame limited to ${targetFPS} FPS`);
    }y

    stop(): void {
        if (this.rafPatched && this.originalRAF) {
            window.requestAnimationFrame = this.originalRAF;
            this.rafPatched = false;
            this.log("[FPSLimiter] requestAnimationFrame restored to default");
        }
    }
}