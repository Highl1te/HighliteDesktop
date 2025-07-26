import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { InventoryManager } from '../core/managers/game/inventoryManager';

export class ShiftClickDrop extends Plugin {
    pluginName = 'ShiftClickDrop';
    pluginDescription = 'Hold Shift and Left Click to drop inventory items';
    author = 'stringy';
    inventoryManager = new InventoryManager();

    // Initialization
    init(): void { this.update(); }

    // Startup function when enabled
    start(): void { this.update(); }

    // Stopping function when disabled
    stop(): void { this.update(); }

    update() {
        this.inventoryManager.shiftKeyDrops = this.settings.enable.value;
    }
}
