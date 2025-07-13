import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { ContextMenuManager } from '../core/managers/game/contextMenuManager';

export class ContextMenuOptions extends Plugin {
    pluginName = 'Context Menu Options';
    author = 'Highlite';
    contextMenuManager: ContextMenuManager = new ContextMenuManager();

    constructor() {
        super();
        this.settings.enable = {
            text: 'Enable',
            type: 0,
            value: false, // Default to false
            callback: () => {}, //NOOP
        };

        this.settings.prioritizePickpocket = {
            text: 'Prioritize Pickpocket',
            type: 0,
            value: false,
            callback: this.enablePrioritizePickpocketChanged,
        };

        this.settings.prioritizeAttack = {
            text: 'Prioritize Loot',
            type: 0,
            value: false,
            callback: this.enablePrioritizeAttackChanged,
        };
    }

    init(): void {
        this.log('Initialized');
    }

    start(): void {
        this.log('Started');
        this.enablePrioritizeAttackChanged(
            this.settings.prioritizeAttack!.value as boolean
        );
        this.enablePrioritizePickpocketChanged(
            this.settings.prioritizePickpocket!.value as boolean
        );
    }

    stop(): void {
        this.log('Stopped');
        this.enablePrioritizeAttackChanged(false);
        this.enablePrioritizePickpocketChanged(false);
    }

    enablePrioritizePickpocketChanged() {
        if (
            this.settings.prioritizePickpocket?.value &&
            this.settings.enable?.value
        ) {
            this.contextMenuManager.SetGameWorldActionMenuPosition(
                'Pickpocket',
                -1
            );
        } else {
            this.contextMenuManager.RemoveGameWorldActionMenuPosition(
                'Pickpocket'
            );
        }
    }

    enablePrioritizeAttackChanged() {
        if (
            this.settings.prioritizeAttack?.value &&
            this.settings.enable?.value
        ) {
            this.contextMenuManager.SetGameWorldActionMenuPosition(
                'Attack',
                -1
            );
        } else {
            this.contextMenuManager.RemoveGameWorldActionMenuPosition('Attack');
        }
    }
}
