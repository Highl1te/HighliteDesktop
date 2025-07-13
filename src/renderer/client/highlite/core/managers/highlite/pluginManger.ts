import type { Plugin } from '../../interfaces/highlite/plugin/plugin.class';

export class PluginManager {
    private static instance: PluginManager;
    plugins: Array<Plugin> = [];

    constructor() {
        if (PluginManager.instance) {
            return PluginManager.instance;
        }
        PluginManager.instance = this;
        document.highlite.managers.PluginManager = this;
        document.highlite.plugins = this.plugins;
    }

    registerPlugin<T extends Plugin>(pluginClass: new () => T): boolean {
        const pluginInstance = new pluginClass();
        console.info(
            `[Highlite] New plugin ${pluginInstance.pluginName} registered`
        );

        this.plugins.push(pluginInstance);
        return true;
    }

    initAll(): void {
        for (const plugin of this.plugins) {
            try {
                plugin.init();
            } catch (error) {
                console.error(
                    `[Highlite] Error initializing plugin ${plugin.pluginName}:`,
                    error
                );
            }
        }
    }

    postInitAll(): void {
        for (const plugin of this.plugins) {
            try {
                if (plugin.postInit) {
                    plugin.postInit();
                }
            } catch (error) {
                console.error(
                    `[Highlite] Error post-initializing plugin ${plugin.pluginName}:`,
                    error
                );
            }
        }
    }

    startAll(): void {
        for (const plugin of this.plugins) {
            if (plugin.settings.enable) {
                try {
                    plugin.start();
                } catch (error) {
                    console.error(
                        `[Highlite] Error starting plugin ${plugin.pluginName}:`,
                        error
                    );
                }
            }
        }
    }

    stopAll(): void {
        for (const plugin of this.plugins) {
            try {
                plugin.stop();
            } catch (error) {
                console.error(
                    `[Highlite] Error stopping plugin ${plugin.pluginName}:`,
                    error
                );
            }
        }
    }

    findPluginByName(pluginName: string): Plugin | undefined {
        return this.plugins.find(plugin => plugin.pluginName === pluginName);
    }

    findPluginByClass(pluginClass: new () => Plugin): Plugin | undefined {
        return this.plugins.find(plugin => plugin.constructor === pluginClass);
    }

    unregisterPlugin(plugin: Plugin): boolean {
        try {
            plugin.stop();
            const index = this.plugins.indexOf(plugin);
            if (index > -1) {
                this.plugins.splice(index, 1);
                console.info(
                    `[Highlite] Plugin ${plugin.pluginName} unregistered`
                );
                return true;
            }
        } catch (error) {
            console.error(
                `[Highlite] Error unregistering plugin ${plugin.pluginName}:`,
                error
            );
        }
        return false;
    }

    hotReloadPlugin<T extends Plugin>(pluginClass: new () => T): boolean {
        try {
            // Create a temporary instance to get the plugin name
            const tempPlugin = new pluginClass();
            const pluginName = tempPlugin.pluginName;

            console.info(`[Highlite] Hot reloading plugin ${pluginName}`);

            // Find and remove old instance by name (more reliable than by class)
            const oldPlugin = this.findPluginByName(pluginName);
            if (oldPlugin) {
                console.info(
                    `[Highlite] Found existing plugin ${pluginName}, removing...`
                );
                this.unregisterPlugin(oldPlugin);
            }

            // Register new instance
            const newPlugin = new pluginClass();
            console.info(
                `[Highlite] Registering new instance of ${newPlugin.pluginName}`
            );

            this.plugins.push(newPlugin);

            // Initialize and start if it was previously enabled (or if no old plugin existed)
            const shouldEnable = oldPlugin
                ? oldPlugin.settings.enable.value
                : newPlugin.settings.enable.value;

            newPlugin.init();
            console.info(`[Highlite] Initialized ${newPlugin.pluginName}`);

            if (newPlugin.postInit) {
                newPlugin.postInit();
                console.info(
                    `[Highlite] Post-initialized ${newPlugin.pluginName}`
                );
            }

            if (shouldEnable) {
                newPlugin.start();
                console.info(`[Highlite] Started ${newPlugin.pluginName}`);
            }

            return true;
        } catch (error) {
            console.error(`[Highlite] Error hot reloading plugin:`, error);
            return false;
        }
    }
}
