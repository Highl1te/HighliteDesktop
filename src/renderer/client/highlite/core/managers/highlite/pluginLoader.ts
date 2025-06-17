import { Plugin } from '../../interfaces/highlite/plugin/plugin.class';

// Simple logger for renderer process
const log = {
  info: (message: string, ...args: any[]) => console.info(`[PluginLoader] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[PluginLoader] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[PluginLoader] ${message}`, ...args),
};

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private loadedPlugins: string[] = [];
  
  async loadPlugin(PluginClass: new () => Plugin): Promise<boolean> {
    try {
      const plugin = new PluginClass();
      const pluginName = plugin.pluginName || PluginClass.name;
      
      if (this.plugins.has(pluginName)) {
        log.warn(`Plugin ${pluginName} is already loaded`);
        return false;
      }
      
      // Initialize plugin
      await this.safeExecute(() => plugin.init(), `initialize ${pluginName}`);
      
      this.plugins.set(pluginName, plugin);
      this.loadedPlugins.push(pluginName);
      
      log.info(`Successfully loaded plugin: ${pluginName}`);
      return true;
    } catch (error) {
      log.error(`Failed to load plugin ${PluginClass.name}:`, error);
      return false;
    }
  }
  
  async startPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      log.error(`Plugin ${pluginName} not found`);
      return false;
    }
    
    return await this.safeExecute(() => plugin.start(), `start ${pluginName}`);
  }
  
  async stopPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      log.error(`Plugin ${pluginName} not found`);
      return false;
    }
    
    return await this.safeExecute(() => plugin.stop(), `stop ${pluginName}`);
  }
  
  async startAllPlugins(): Promise<void> {
    for (const pluginName of this.loadedPlugins) {
      await this.startPlugin(pluginName);
    }
  }
  
  async stopAllPlugins(): Promise<void> {
    for (const pluginName of this.loadedPlugins) {
      await this.stopPlugin(pluginName);
    }
  }
  
  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }
  
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
  
  getLoadedPluginNames(): string[] {
    return [...this.loadedPlugins];
  }
  
  private async safeExecute(fn: () => void | Promise<void>, operation: string): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (error) {
      log.error(`Failed to ${operation}:`, error);
      return false;
    }
  }
  
  unloadPlugin(pluginName: string): boolean {
    try {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        return false;
      }
      
      // Stop the plugin first
      this.safeExecute(() => plugin.stop(), `stop ${pluginName} during unload`);
      
      // Remove from maps
      this.plugins.delete(pluginName);
      this.loadedPlugins = this.loadedPlugins.filter(name => name !== pluginName);
      
      log.info(`Successfully unloaded plugin: ${pluginName}`);
      return true;
    } catch (error) {
      log.error(`Failed to unload plugin ${pluginName}:`, error);
      return false;
    }
  }
}
