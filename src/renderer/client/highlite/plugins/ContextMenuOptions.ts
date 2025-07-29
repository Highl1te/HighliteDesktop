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


        this.settings.deprioritizeTalkTo = {
            text: 'Deprioritize Talk To',
            type: 0,
            value: false,
            callback: this.enableDeprioritizeTalkToChanged,
        };
    }

    init(): void {
        this.log('Initialized');
    }

    start(): void {
        this.log('Started');
        this.update();
    }

    stop(): void {
        this.log('Stopped');
        this.update();
    }

    update(): void {
        this.enablePrioritizeAttackChanged();
        this.enablePrioritizePickpocketChanged();
        this.enableDeprioritizeTalkToChanged();
    }

    enableDeprioritizeTalkToChanged() {
        if (
            this.settings.deprioritizeTalkTo?.value &&
            this.settings.enable?.value
        ) {
            this.contextMenuManager.SetGameWorldActionMenuPosition(
                'Talk To',
                100000
            );
        } else {
            this.contextMenuManager.RemoveGameWorldActionMenuPosition(
                'Talk To'
            );
        }
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
