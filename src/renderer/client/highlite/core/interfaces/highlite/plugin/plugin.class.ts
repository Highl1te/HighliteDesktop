import { SettingsTypes, type PluginSettings } from "./pluginSettings.interface";

export abstract class Plugin {
    /** Used for plugin[fnName] access */
    [key: string]: any;

    abstract pluginName : string;
    abstract author : string;

    abstract init(): void;
    abstract start(): void;
    abstract stop(): void;
    settings: {
        enable: PluginSettings;
        [key: string]: PluginSettings;
    } = {
        enable: {
            text: "Enable",
            type: SettingsTypes.checkbox,
            value: true,
            callback: this.onSettingsChanged_enabled
        }
    };

    onSettingsChanged_enabled() {
        if (this.settings.enable.value) {
            this.start();
        } else {
            this.stop();
        }
    }
    
    postInit?(): void;

    gameHooks = document.highlite.gameHooks
    gameLookups = document.highlite.gameLookups;
    registerPlugin = document.highlite.managers.PluginManager.registerPlugin.bind(document.highlite.managers.PluginManager);

    // Log seems to be broken from loading HighSpell Client
    log(...args: any[]) : void {
        console.info(`[Highlite][${this.pluginName} Plugin]`, ...args);
    }

    info(...args: any[]) : void {
        console.info(`[Highlite][${this.pluginName} Plugin]`, ...args);
    }

    warn(...args: any[]) : void {
        console.warn(`[Highlite][${this.pluginName} Plugin]`, ...args);
    }

    error(...args: any[]) : void {
        console.error(`[Highlite][${this.pluginName} Plugin]`, ...args);
    }
}
