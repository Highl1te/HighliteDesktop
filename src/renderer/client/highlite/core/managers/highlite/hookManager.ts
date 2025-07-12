export class HookManager {
    private static instance: HookManager;

    constructor() {
        if (HookManager.instance) {
            return HookManager.instance;
        }
        HookManager.instance = this;
        document.highlite.managers.HookManager = this;
    }

    public registerClass(className: string, mappedName: string): boolean {
        const classInstance = document.client.get(className);

        if (!classInstance) {
            console.warn(
                `[Highlite] ${className} (${mappedName}) is not defined in client.`
            );
            return false;
        }

        document.highlite.gameHooks[mappedName] = classInstance;
        return true;
    }

    public registerClassHook(
        sourceClass: string,
        fnName: string,
        hookFn = this.hook
    ): boolean {
        const self = this;
        const classObject = document.highlite.gameHooks[sourceClass].prototype;

        if (!classObject) {
            console.warn(
                `[Highlite] Attempted to register unknown client class hook (${sourceClass}).`
            );
            return false;
        }

        let functionName = fnName;
        if (functionName.startsWith('_')) {
            functionName = functionName.substring(1);
        }

        const hookName = `${sourceClass}_${functionName}`;
        (function (originalFunction: any) {
            classObject[fnName] = function (...args: Array<unknown>) {
                const originalReturn = originalFunction.apply(this, arguments);
                hookFn.apply(self, [hookName, ...args, this]);
                return originalReturn;
            };
        })(classObject[fnName]);

        return true;
    }

    public registerClassOverrideHook(
        sourceClass: string,
        fnName: string,
        hookFn = this.hook
    ): boolean {
        const self = this;
        const classObject = document.highlite.gameHooks[sourceClass].prototype;

        if (!classObject) {
            console.warn(
                `[Highlite] Attempted to register unknown client class override hook (${sourceClass}).`
            );
            return false;
        }

        let functionName = fnName;
        if (functionName.startsWith('_')) {
            functionName = functionName.substring(1);
        }

        const hookName = `${sourceClass}_${functionName}`;
        (function (originalFunction: any) {
            classObject[fnName] = function (...args: Array<unknown>) {
                return hookFn.apply(self, [hookName, ...args, this]);
            };
        })(classObject[fnName]);
        return true;
    }

    public registerStaticClassHook(
        sourceClass: string,
        fnName: string,
        hookFn = this.hook
    ): boolean {
        const self = this;
        const classObject = document.client.get(sourceClass);

        if (!classObject) {
            console.warn(
                `[Highlite] Attempted to register unknown static client class hook (${sourceClass}).`
            );
            return false;
        }

        let functionName = fnName;
        if (functionName.startsWith('_')) {
            functionName = functionName.substring(1);
        }

        const hookName = `${sourceClass}_${functionName}`;
        (function (originalFunction: any) {
            classObject[fnName] = function (...args: Array<unknown>) {
                const returnValue = originalFunction.apply(this, arguments);
                hookFn.apply(self, [hookName, ...args, this]);
                return returnValue;
            };
        })(classObject[fnName]);
        return true;
    }

    private hook(fnName: string, ...args: any[]): void {
        for (const plugin of document.highlite.plugins) {
            if (typeof plugin[fnName] === 'function') {
                try {
                    plugin[fnName].apply(plugin, args);
                } catch (error) {
                    console.error(
                        `[Highlite] Error in plugin ${plugin.pluginName} (${fnName}):`,
                        error
                    );
                }
            }
        }
    }
}
