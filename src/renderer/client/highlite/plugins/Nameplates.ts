import { Vector3 } from '@babylonjs/core/Maths/math';
import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';
import { UIManager, UIManagerScope } from '../core/managers/highlite/uiManager';
import { NotificationManager } from '../core/managers/highlite/notificationManager';
import { SoundManager } from '../core/managers/highlite/soundsManager';

export class Nameplates extends Plugin {
    pluginName = 'Nameplates';
    author = 'Highlite';
    DOMElement: HTMLDivElement | null = null;

    // Priority system properties
    private altKeyPressed: boolean = false;
    private uiManager: UIManager;
    
    // Alert system properties
    private notificationManager: NotificationManager = new NotificationManager();
    private soundManager: SoundManager = new SoundManager();
    private trackedGroundItems: Set<string> = new Set(); // Track seen ground items to detect new ones

    constructor() {
        super();

        // Initialize UIManager
        this.uiManager = new UIManager();

        // Nameplate toggles
        this.settings.playerNameplates = {
            text: 'Player Nameplates',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {},
        };
        this.settings.npcNameplates = {
            text: 'NPC Nameplates',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {},
        };
        this.settings.youNameplate = {
            text: 'You Nameplate',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {},
        };
        this.settings.groundItemNameplates = {
            text: 'Ground Item Nameplates',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {},
        };

        // Size settings
        this.settings.playerNameplateSize = {
            text: 'Player Nameplate Text Size',
            type: SettingsTypes.range,
            value: 12,
            callback: () => this.updateAllFontSizes(),
            validation: (value: string | number | boolean) => {
                const numValue = value as number;
                return numValue >= 8 && numValue <= 24;
            },
        };
        this.settings.npcNameplateSize = {
            text: 'NPC Nameplate Text Size',
            type: SettingsTypes.range,
            value: 12,
            callback: () => this.updateAllFontSizes(),
            validation: (value: string | number | boolean) => {
                const numValue = value as number;
                return numValue >= 8 && numValue <= 24;
            },
        };
        this.settings.youNameplateSize = {
            text: 'You Nameplate Text Size',
            type: SettingsTypes.range,
            value: 12,
            callback: () => this.updateAllFontSizes(),
            validation: (value: string | number | boolean) => {
                const numValue = value as number;
                return numValue >= 8 && numValue <= 24;
            },
        };
        this.settings.groundItemNameplateSize = {
            text: 'Ground Item Nameplate Text Size',
            type: SettingsTypes.range,
            value: 12,
            callback: () => this.updateAllFontSizes(),
            validation: (value: string | number | boolean) => {
                const numValue = value as number;
                return numValue >= 8 && numValue <= 24;
            },
        };

        // Theme settings
        this.settings.enableTheming = {
            text: 'Enable Enhanced Theming',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.updateAllElementThemes(),
        };
        this.settings.showBackgrounds = {
            text: 'Show Background Colors',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.updateAllElementThemes(),
        };
        this.settings.showBorders = {
            text: 'Show Borders',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.updateAllElementThemes(),
        };
        this.settings.showShadows = {
            text: 'Show Text Shadows',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.updateAllElementThemes(),
        };

        // Stack limit settings
        this.settings.maxNPCStack = {
            text: 'Max NPC Stack Display',
            type: SettingsTypes.range,
            value: 5,
            callback: () => this.updateStackLimits(),
            validation: (value: string | number | boolean) => {
                const numValue = value as number;
                return numValue >= 0 && numValue <= 20;
            },
        };
        this.settings.maxPlayerStack = {
            text: 'Max Player Stack Display',
            type: SettingsTypes.range,
            value: 5,
            callback: () => this.updateStackLimits(),
            validation: (value: string | number | boolean) => {
                const numValue = value as number;
                return numValue >= 0 && numValue <= 20;
            },
        };
        this.settings.maxGroundItemStack = {
            text: 'Max Ground Item Stack Display',
            type: SettingsTypes.range,
            value: 8,
            callback: () => this.updateStackLimits(),
            validation: (value: string | number | boolean) => {
                const numValue = value as number;
                return numValue >= 0 && numValue <= 50;
            },
        };

        // Priority system settings
        this.settings.itemPriorities = {
            text: 'Item Priorities (item:level,item:level)',
            type: SettingsTypes.text,
            value: '',
            callback: () => this.updateAllGroundItemElements(),
        };
        this.settings.priorityItemCustomColor = {
            text: 'Priority Item Custom Color',
            type: SettingsTypes.color,
            value: '#ff0000',
            callback: () => this.updateAllGroundItemElements(),
        };

        // Priority item alert settings
        this.settings.priorityItemAlerts = {
            text: 'Enable Priority Item Alerts',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {}, //NOOP
        };
        this.settings.priorityItemNotifications = {
            text: 'Priority Item Notifications',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {}, //NOOP
        };
        this.settings.priorityItemSounds = {
            text: 'Priority Item Sounds',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {}, //NOOP
        };
        this.settings.priorityItemAlertVolume = {
            text: 'Priority Item Alert Volume',
            type: SettingsTypes.range,
            value: 50,
            callback: () => {}, //NOOP
            validation: (value: string | number | boolean) => {
                const numValue = value as number;
                return numValue >= 0 && numValue <= 100;
            },
        };
    }

    NPCDomElements: {
        [key: string]: { element: HTMLDivElement; position: Vector3 };
    } = {};

    PlayerDomElements: {
        [key: string]: { element: HTMLDivElement; position: Vector3 };
    } = {};

    GroundItemDomElements: {
        [key: string]: {
            element: HTMLDivElement;
            position: Vector3;
            itemName: string;
            quantity: number;
            positionKey: string;
        };
    } = {};

    private positionTracker: Map<string, number> = new Map();

    init(): void {
        this.log('Initializing');
        this.setupKeyboardListeners();
    }

    start(): void {
        this.log('Started');
        if (this.settings.enable.value) {
            this.setupAllElements();
        }
    }

    stop(): void {
        this.log('Stopped');
        this.cleanupAllElements();
    }

    SocketManager_loggedIn(): void {
        if (this.settings.enable.value) {
            this.setupAllElements();
        }
    }

    SocketManager_handleLoggedOut(): void {
        this.cleanupAllElements();
        this.trackedGroundItems.clear(); // Reset tracked items on logout
    }

    private setupKeyboardListeners(): void {
        document.addEventListener('keydown', e => {
            if (e.key === 'Alt') {
                this.altKeyPressed = true;
                this.updatePriorityButtonsVisibility();
                this.disableScreenMaskPointerEvents();
            }
        });

        document.addEventListener('keyup', e => {
            if (e.key === 'Alt') {
                this.resetAltState();
            }
        });

        // Handle window blur (alt-tab) and visibility change
        window.addEventListener('blur', () => {
            if (this.altKeyPressed) {
                this.resetAltState();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.altKeyPressed) {
                this.resetAltState();
            }
        });
    }

    private resetAltState(): void {
        this.altKeyPressed = false;
        this.updatePriorityButtonsVisibility();
        // Add a delay to allow button clicks to complete
        setTimeout(() => {
            this.enableScreenMaskPointerEvents();
        }, 200);
    }

    private updatePriorityButtonsVisibility(): void {
        const buttons = document.querySelectorAll('.priority-button');
        buttons.forEach(button => {
            if (this.altKeyPressed) {
                (button as HTMLElement).style.display = 'inline-block';
            } else {
                (button as HTMLElement).style.display = 'none';
            }
        });

        // Update visibility of ignored items in existing ground item elements
        this.updateIgnoredItemsVisibility();
    }

    private disableScreenMaskPointerEvents(): void {
        const screenMask = document.getElementById('hs-screen-mask');
        if (screenMask) {
            screenMask.style.pointerEvents = 'none';
        }
    }

    private enableScreenMaskPointerEvents(): void {
        const screenMask = document.getElementById('hs-screen-mask');
        if (screenMask) {
            screenMask.style.pointerEvents = 'auto';
        }
    }

    private updateIgnoredItemsVisibility(): void {
        const ignoredItems = this.getIgnoredItemsSet();
        const maxGroundItemStack = this.settings.maxGroundItemStack!
            .value as number;

        // Update all existing ground item elements
        for (const key in this.GroundItemDomElements) {
            const element = this.GroundItemDomElements[key].element;
            const itemContainers = element.children;

            // Remove any existing stack indicators
            const existingIndicators = element.querySelectorAll(
                '.ground-stack-indicator'
            );
            existingIndicators.forEach(indicator => indicator.remove());

            let visibleItemCount = 0;
            let hiddenItemCount = 0;
            let stackIndicatorAdded = false;

            for (let i = 0; i < itemContainers.length; i++) {
                const container = itemContainers[i] as HTMLElement;
                const textSpan = container.querySelector('span');
                if (!textSpan) continue;

                const itemName = textSpan.innerText.split(' [x')[0]; // Extract item name without quantity

                if (ignoredItems.has(itemName)) {
                    if (this.altKeyPressed) {
                        // Show ignored item when ALT is pressed (no stack limits)
                        container.style.display = 'flex';
                        (textSpan as HTMLElement).style.color = 'gray';
                        (textSpan as HTMLElement).style.fontStyle = 'italic';
                        visibleItemCount++;
                        this.log(`Showing ignored item: ${itemName}`);
                    } else {
                        // Hide ignored item when ALT is not pressed
                        container.style.display = 'none';
                        this.log(`Hiding ignored item: ${itemName}`);
                    }
                } else {
                    // Show non-ignored items, respecting stack limits only when ALT is not pressed
                    if (
                        !this.altKeyPressed &&
                        visibleItemCount >= maxGroundItemStack
                    ) {
                        container.style.display = 'none';
                        hiddenItemCount++;

                        // Add stack indicator to the last visible item if not already added
                        if (
                            !stackIndicatorAdded &&
                            visibleItemCount === maxGroundItemStack
                        ) {
                            this.addGroundItemStackIndicator(
                                element,
                                hiddenItemCount
                            );
                            stackIndicatorAdded = true;
                        }
                    } else {
                        container.style.display = 'flex';
                        visibleItemCount++;
                    }
                }
            }
        }

        // Reapply theming to all ground item elements after visibility changes
        for (const key in this.GroundItemDomElements) {
            this.applyGroundItemElementTheme(
                this.GroundItemDomElements[key].element
            );
        }
    }

    private injectCSSVariables(): void {
        if (!this.DOMElement) return;

        try {
            const screenMask = document.getElementById('hs-screen-mask');
            if (!screenMask) return;

            const computedStyle = getComputedStyle(screenMask);
            const cssVariables = [
                '--hs-color-cmbt-lvl-diff-pos-10',
                '--hs-color-cmbt-lvl-diff-pos-9',
                '--hs-color-cmbt-lvl-diff-pos-8',
                '--hs-color-cmbt-lvl-diff-pos-7',
                '--hs-color-cmbt-lvl-diff-pos-6',
                '--hs-color-cmbt-lvl-diff-pos-5',
                '--hs-color-cmbt-lvl-diff-pos-4',
                '--hs-color-cmbt-lvl-diff-pos-3',
                '--hs-color-cmbt-lvl-diff-pos-2',
                '--hs-color-cmbt-lvl-diff-pos-1',
                '--hs-color-cmbt-lvl-diff-pos-0',
                '--hs-color-cmbt-lvl-diff-neg-1',
                '--hs-color-cmbt-lvl-diff-neg-2',
                '--hs-color-cmbt-lvl-diff-neg-3',
                '--hs-color-cmbt-lvl-diff-neg-4',
                '--hs-color-cmbt-lvl-diff-neg-5',
                '--hs-color-cmbt-lvl-diff-neg-6',
                '--hs-color-cmbt-lvl-diff-neg-7',
                '--hs-color-cmbt-lvl-diff-neg-8',
                '--hs-color-cmbt-lvl-diff-neg-9',
                '--hs-color-cmbt-lvl-diff-neg-10',
            ];

            let styleString = '';
            cssVariables.forEach(variable => {
                const value = computedStyle.getPropertyValue(variable);
                if (value) {
                    styleString += `${variable}: ${value}; `;
                }
            });

            if (styleString) {
                this.DOMElement.style.cssText += styleString;
            }
        } catch (error) {
            this.error('Error injecting CSS variables:', error);
        }
    }

    private getItemPriorities(): Map<string, number> {
        const prioritiesStr = this.settings.itemPriorities!.value as string;
        const priorities = new Map<string, number>();

        if (!prioritiesStr) return priorities;

        const entries = prioritiesStr
            .split(',')
            .map(entry => entry.trim())
            .filter(entry => entry.length > 0);

        for (const entry of entries) {
            const [itemName, levelStr] = entry.split(':');
            if (itemName && levelStr) {
                const level = parseInt(levelStr);
                if (!isNaN(level) && level >= -1 && level <= 1) {
                    priorities.set(itemName.trim(), level);
                }
            }
        }

        return priorities;
    }

    private getPriorityItemsSet(): Set<string> {
        const priorities = this.getItemPriorities();
        const priorityItems = new Set<string>();

        for (const [itemName, level] of priorities) {
            if (level === 1) {
                priorityItems.add(itemName);
            }
        }

        return priorityItems;
    }

    private getIgnoredItemsSet(): Set<string> {
        const priorities = this.getItemPriorities();
        const ignoredItems = new Set<string>();

        for (const [itemName, level] of priorities) {
            if (level === -1) {
                ignoredItems.add(itemName);
            }
        }

        return ignoredItems;
    }

    private toggleItemPriority(itemName: string): void {
        const priorities = this.getItemPriorities();
        const currentLevel = priorities.get(itemName) || 0;

        // Shift priority level up by 1, wrapping from 1 back to 0
        const newLevel = currentLevel === 1 ? 0 : currentLevel + 1;
        priorities.set(itemName, newLevel);

        // Update settings
        this.settings.itemPriorities!.value = Array.from(priorities.entries())
            .map(([item, level]) => `${item}:${level}`)
            .join(', ');

        this.updateAllGroundItemElements();
    }

    private toggleItemIgnored(itemName: string): void {
        const priorities = this.getItemPriorities();
        const currentLevel = priorities.get(itemName) || 0;

        // Shift priority level down by 1, wrapping from -1 back to 0
        const newLevel = currentLevel === -1 ? 0 : currentLevel - 1;
        priorities.set(itemName, newLevel);

        // Update settings
        this.settings.itemPriorities!.value = Array.from(priorities.entries())
            .map(([item, level]) => `${item}:${level}`)
            .join(', ');

        this.updateAllGroundItemElements();
    }

    private updateAllGroundItemElements(): void {
        // Force recreation of all ground item elements to reflect new priorities
        for (const key in this.GroundItemDomElements) {
            this.disposeElementFromCollection(this.GroundItemDomElements, key);
        }
    }

    private getPriorityColor(): string {
        // Use custom color if available, otherwise fall back to red
        if (
            this.settings.priorityItemCustomColor &&
            this.settings.priorityItemCustomColor.value
        ) {
            return this.settings.priorityItemCustomColor.value as string;
        }

        return '#ff0000'; // Default red color
    }

    private checkForNewPriorityItems(GroundItems: Map<number, any>): void {
        if (!this.settings.priorityItemAlerts?.value) {
            return;
        }

        const priorityItems = this.getPriorityItemsSet();
        if (priorityItems.size === 0) {
            return; // No priority items configured
        }

        const currentGroundItems = new Set<string>();
        
        // Build set of current ground items
        for (const [key, groundItem] of GroundItems) {
            const itemKey = `${key}_${groundItem._def._nameCapitalized}`;
            currentGroundItems.add(itemKey);
            
            // Check if this is a new priority item
            if (!this.trackedGroundItems.has(itemKey)) {
                const itemName = groundItem._def._nameCapitalized;
                if (priorityItems.has(itemName)) {
                    this.alertPriorityItemDropped(itemName);
                }
            }
        }

        // Update tracked items
        this.trackedGroundItems = currentGroundItems;
    }

    private alertPriorityItemDropped(itemName: string): void {
        this.log(`Priority item detected: ${itemName}`);

        // Send notification if enabled
        if (this.settings.priorityItemNotifications?.value) {
            this.notificationManager.createNotification(
                `Priority item dropped: ${itemName}!`
            );
        }

        // Play sound if enabled
        if (this.settings.priorityItemSounds?.value) {
            const volume = (this.settings.priorityItemAlertVolume?.value as number) / 100;
            this.soundManager.playSound(
                'https://cdn.pixabay.com/download/audio/2024/02/19/audio_e4043ea6be.mp3',
                volume
            );
        }
    }

    GameLoop_draw(): void {
        const NPCS = this.gameHooks.EntityManager.Instance._npcs;
        const Players = this.gameHooks.EntityManager.Instance._players;
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;
        const GroundItems =
            this.gameHooks.GroundItemManager.Instance.GroundItems;
        const playerFriends = this.gameHooks.ChatManager.Instance._friends;
        const BW = this.gameHooks.Nameplates;

        if (!this.settings.enable.value) {
            this.cleanupAllElements();
            return;
        }

        this.resetPositionTracker();

        if (!NPCS || !Players || !MainPlayer || !GroundItems) {
            this.log(
                'Missing required game entities, skipping nameplate rendering.'
            );
            return;
        }

        this.cleanupStaleEntities(NPCS, Players, MainPlayer);
        this.processNPCs(NPCS, MainPlayer, HW);
        this.processPlayers(Players, MainPlayer, playerFriends);
        this.checkForNewPriorityItems(GroundItems);
        this.processGroundItems(GroundItems);
    }

    private cleanupStaleEntities(
        NPCS: Map<number, any>,
        Players: any[],
        MainPlayer: any
    ): void {
        // Cleanup stale NPCs
        for (const key in this.NPCDomElements) {
            if (!NPCS.has(parseInt(key))) {
                this.disposeElementFromCollection(this.NPCDomElements, key);
            }
        }

        // Cleanup stale Players
        for (const key in this.PlayerDomElements) {
            const exists =
                Players.some(p => p._entityId === parseInt(key)) ||
                (MainPlayer && MainPlayer._entityId === parseInt(key));
            if (!exists) {
                this.disposeElementFromCollection(this.PlayerDomElements, key);
            }
        }

        // Cleanup stale Ground Items - this will be handled in processGroundItems
        // since ground items use grouped keys, not individual item IDs
    }

    private processNPCs(
        NPCS: Map<number, any>,
        MainPlayer: any,
        HW: any
    ): void {
        if (!this.settings.npcNameplates!.value) {
            this.cleanupElementCollection(this.NPCDomElements);
            return;
        }

        for (const [key, npc] of NPCS) {
            if (!this.NPCDomElements[key]) {
                this.createNPCElement(key, npc, MainPlayer._combatLevel, HW);
            }

            // Update position for stacking calculation
            const worldPos = this.getEntityWorldPosition(npc, 'npc');
            if (worldPos) {
                this.NPCDomElements[key].position = worldPos;

                // Track position for stacking
                const positionKey = this.getPositionKey(worldPos);
                const currentCount = this.positionTracker.get(positionKey) || 0;
                this.positionTracker.set(positionKey, currentCount + 1);
            }

            const npcMesh = npc._appearance._haloNode;

            try {
                this.updateElementPosition(npcMesh, this.NPCDomElements[key]);
            } catch (e) {
                this.log('Error updating NPC element position: ', e);
            }
        }
    }

    private processPlayers(
        Players: any[],
        MainPlayer: any,
        playerFriends: string[]
    ): void {
        if (this.settings.playerNameplates!.value) {
            for (const player of Players) {
                if (!this.PlayerDomElements[player._entityId]) {
                    this.createPlayerElement(player._entityId, player, false);
                }

                // Update friend status
                const isFriend = playerFriends.includes(player._nameLowerCase);
                const element =
                    this.PlayerDomElements[player._entityId].element;
                const isMainPlayer = element.id.includes(
                    `player-${MainPlayer._entityId}`
                );
                element.style.color = isFriend
                    ? 'lightgreen'
                    : isMainPlayer
                      ? 'cyan'
                      : 'white';

                // Reapply theming to update colors properly
                this.applyPlayerElementTheme(element, isMainPlayer);

                // Update position for stacking calculation
                const worldPos = this.getEntityWorldPosition(player, 'player');
                if (worldPos) {
                    this.PlayerDomElements[player._entityId].position =
                        worldPos;

                    // Track position for stacking
                    const positionKey = this.getPositionKey(worldPos);
                    const currentCount =
                        this.positionTracker.get(positionKey) || 0;
                    this.positionTracker.set(positionKey, currentCount + 1);
                }

                const playerMesh = player._appearance._haloNode;
                try {
                    this.updateElementPosition(
                        playerMesh,
                        this.PlayerDomElements[player._entityId]
                    );
                } catch (e) {
                    this.log('Error updating Player element position: ', e);
                }
            }
        } else {
            // Only cleanup non-main player elements
            for (const key in this.PlayerDomElements) {
                if (MainPlayer && parseInt(key) !== MainPlayer._entityId) {
                    this.disposeElementFromCollection(
                        this.PlayerDomElements,
                        key
                    );
                }
            }
        }

        // Handle main player nameplate
        if (this.settings.youNameplate!.value && MainPlayer) {
            if (!this.PlayerDomElements[MainPlayer._entityId]) {
                this.createPlayerElement(
                    MainPlayer._entityId,
                    MainPlayer,
                    true
                );
            }

            // Update position for stacking calculation
            const worldPos = this.getEntityWorldPosition(MainPlayer, 'player');
            if (worldPos) {
                this.PlayerDomElements[MainPlayer._entityId].position =
                    worldPos;

                // Track position for stacking
                const positionKey = this.getPositionKey(worldPos);
                const currentCount = this.positionTracker.get(positionKey) || 0;
                this.positionTracker.set(positionKey, currentCount + 1);
            }

            const playerMesh = MainPlayer._appearance._haloNode;
            try {
                this.updateElementPosition(
                    playerMesh,
                    this.PlayerDomElements[MainPlayer._entityId]
                );
            } catch (e) {
                this.log('Error updating Player element position: ', e);
            }
        } else if (
            !this.settings.youNameplate!.value &&
            MainPlayer &&
            this.PlayerDomElements[MainPlayer._entityId]
        ) {
            this.disposeElementFromCollection(
                this.PlayerDomElements,
                MainPlayer._entityId
            );
        }
    }

    private processGroundItems(GroundItems: Map<number, any>): void {
        if (!this.settings.groundItemNameplates!.value) {
            this.cleanupElementCollection(this.GroundItemDomElements);
            return;
        }

        // Check if ground item stack limit is 0 - if so, hide all ground items
        const maxGroundItemStack = this.settings.maxGroundItemStack!
            .value as number;
        if (maxGroundItemStack === 0) {
            this.cleanupElementCollection(this.GroundItemDomElements);
            return;
        }

        const positionGroups = this.groupGroundItemsByPosition(GroundItems);
        this.cleanupUnusedGroundItemElements(positionGroups);

        for (const [positionKey, positionGroup] of positionGroups) {
            const representativeKey = positionGroup.firstKey;

            // Check if element exists and if the content has changed
            const existingElement =
                this.GroundItemDomElements[representativeKey];
            const needsUpdate =
                !existingElement ||
                existingElement.quantity !== positionGroup.totalItems ||
                existingElement.itemName !==
                    `${positionGroup.items.size} types`;

            if (needsUpdate) {
                // Remove existing element if it exists
                if (existingElement) {
                    this.disposeElementFromCollection(
                        this.GroundItemDomElements,
                        representativeKey
                    );
                }

                // Create new element
                this.createGroundItemElement(
                    representativeKey,
                    positionGroup,
                    positionKey
                );
            }

            const firstItem = Array.from(positionGroup.items.values())[0]
                .items[0];

            // Update position for stacking calculation
            const worldPos = this.getEntityWorldPosition(
                firstItem.item,
                'grounditem'
            );
            if (worldPos) {
                this.GroundItemDomElements[representativeKey].position =
                    worldPos;

                // Track position for stacking
                const stackingPositionKey = this.getPositionKey(worldPos);
                const currentCount =
                    this.positionTracker.get(stackingPositionKey) || 0;
                this.positionTracker.set(stackingPositionKey, currentCount + 1);
            }

            const groundItemMesh = firstItem.item._appearance._billboardMesh;

            try {
                this.updateElementPosition(
                    groundItemMesh,
                    this.GroundItemDomElements[representativeKey]
                );
            } catch (e) {
                this.log('Error updating Ground Item element position: ', e);
            }
        }
    }

    private createNPCElement(
        key: number,
        npc: any,
        playerCombatLevel: number,
        HW: any
    ): void {
        const element = document.createElement('div');
        element.id = `highlite-nameplates-npc-${key}`;
        element.style.position = 'absolute';
        element.style.pointerEvents = 'none';
        element.style.zIndex = '1000';
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.justifyContent = 'center';
        element.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;

        // Create Name
        const nameSpan = document.createElement('div');
        nameSpan.style.color = 'yellow';
        nameSpan.style.textAlign = 'center';
        nameSpan.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;
        nameSpan.innerText = npc._name;
        element.appendChild(nameSpan);

        // Create Level if applicable
        if (npc._combatLevel != 0) {
            const lvlSpan = document.createElement('div');
            lvlSpan.style.textAlign = 'center';
            lvlSpan.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;
            lvlSpan.innerText = `Lvl. ${npc._combatLevel}`;
            lvlSpan.className =
                HW.getTextColorClassNameForCombatLevelDifference(
                    playerCombatLevel,
                    npc._combatLevel
                );

            // Add aggression emojis
            if (
                npc._def._combat._isAggressive &&
                !npc._def._combat._isAlwaysAggro
            ) {
                lvlSpan.innerText += ' 😠';
            } else if (
                !npc._def._combat._isAggressive &&
                !npc._def._combat._isAlwaysAggro
            ) {
                lvlSpan.innerText += ' 😐';
            } else if (npc._def._combat._isAlwaysAggro) {
                lvlSpan.innerText += ' 👿';
            }

            element.appendChild(lvlSpan);
        }

        // Apply theming
        this.applyNPCElementTheme(element);

        this.NPCDomElements[key] = {
            element: element,
            position: Vector3.ZeroReadOnly,
        };

        document.getElementById('highlite-nameplates')?.appendChild(element);
    }

    private createPlayerElement(
        entityId: number,
        player: any,
        isMainPlayer: boolean
    ): void {
        const element = document.createElement('div');
        element.id = `highlite-nameplates-player-${entityId}`;
        element.style.position = 'absolute';
        element.style.pointerEvents = 'none';
        element.style.zIndex = '1000';
        element.style.color = isMainPlayer ? 'cyan' : 'white';
        element.style.fontSize = isMainPlayer
            ? `${this.settings.youNameplateSize!.value}px`
            : `${this.settings.playerNameplateSize!.value}px`;
        element.innerHTML = player._name;

        // Apply theming
        this.applyPlayerElementTheme(element, isMainPlayer);

        this.PlayerDomElements[entityId] = {
            element: element,
            position: Vector3.ZeroReadOnly,
        };

        document.getElementById('highlite-nameplates')?.appendChild(element);
    }

    private createGroundItemElement(
        representativeKey: string,
        positionGroup: any,
        positionKey: string
    ): void {
        const element = document.createElement('div');
        element.id = `highlite-nameplates-grounditem-${representativeKey}`;
        element.style.position = 'absolute';
        element.style.pointerEvents = 'none';
        element.style.zIndex = '1000';
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.justifyContent = 'center';
        element.style.fontSize = `${this.settings.groundItemNameplateSize!.value}px`;

        const entries = Array.from(positionGroup.items.entries()) as [
            string,
            any,
        ][];

        // Sort by priority: priority items first, then by name
        const priorityItems = this.getPriorityItemsSet();
        const ignoredItems = this.getIgnoredItemsSet();

        entries.sort(([a, aGroup], [b, bGroup]) => {
            const aIsPriority = priorityItems.has(a);
            const bIsPriority = priorityItems.has(b);

            if (aIsPriority && !bIsPriority) return -1;
            if (!aIsPriority && bIsPriority) return 1;

            return a.localeCompare(b);
        });

        const maxGroundItemStack = this.settings.maxGroundItemStack!
            .value as number;
        let visibleItemCount = 0;
        let hiddenItemCount = 0;
        let stackIndicatorAdded = false;

        for (const [itemName, itemGroup] of entries) {
            const itemDiv = document.createElement('div');
            itemDiv.style.textAlign = 'center';
            itemDiv.style.fontSize = `${this.settings.groundItemNameplateSize!.value}px`;

            const itemText =
                itemGroup.count > 1
                    ? `${itemName} [x${itemGroup.count}]`
                    : itemName;

            // Create container for item text and buttons
            const itemContainer = document.createElement('div');
            itemContainer.style.display = 'flex';
            itemContainer.style.alignItems = 'center';
            itemContainer.style.justifyContent = 'center';
            itemContainer.style.gap = '4px';
            itemContainer.style.pointerEvents = 'auto';
            itemContainer.style.position = 'relative';
            itemContainer.style.zIndex = '1002';

            // Item text
            const textSpan = document.createElement('span');
            textSpan.innerText = itemText;

            // Set color based on priority and ignore status
            if (ignoredItems.has(itemName)) {
                textSpan.style.color = 'gray';
                textSpan.style.fontStyle = 'italic';
                // Initially hide ignored items
                itemContainer.style.display = this.altKeyPressed
                    ? 'flex'
                    : 'none';
            } else if (priorityItems.has(itemName)) {
                textSpan.style.color = this.getPriorityColor();
                textSpan.style.fontWeight = 'bold';
                // Add priority indicator styling
                if (this.settings.showBorders?.value) {
                    itemContainer.style.border =
                        '1px solid ' + this.getPriorityColor();
                    itemContainer.style.borderRadius = '2px';
                    itemContainer.style.padding = '1px 2px';
                }
            } else {
                textSpan.style.color = 'orange';
            }

            itemContainer.appendChild(textSpan);

            // Priority buttons (always show when ALT is pressed)
            // Priority button (+)
            const priorityBtn = document.createElement('button');
            priorityBtn.className = 'priority-button';
            priorityBtn.innerText = '+';
            priorityBtn.style.display = this.altKeyPressed
                ? 'inline-block'
                : 'none';
            const currentLevel = this.getItemPriorities().get(itemName) || 0;
            priorityBtn.style.background =
                currentLevel === 1 ? 'orange' : 'transparent';
            priorityBtn.style.color = currentLevel === 1 ? 'white' : 'orange';
            priorityBtn.style.border = '1px solid orange';
            priorityBtn.style.borderRadius = '2px';
            priorityBtn.style.padding = '1px 4px';
            priorityBtn.style.fontSize = '10px';
            priorityBtn.style.cursor = 'pointer';
            priorityBtn.style.fontWeight = 'bold';
            priorityBtn.style.pointerEvents = 'auto';
            priorityBtn.style.zIndex = '1001';
            priorityBtn.style.userSelect = 'none';
            priorityBtn.title =
                currentLevel === 1 ? 'Remove Priority' : 'Add Priority';

            // Use UIManager to bind the click event properly
            this.uiManager.bindOnClickBlockHsMask(priorityBtn, () => {
                this.toggleItemPriority(itemName);
            });

            // Ignore button (-)
            const ignoreBtn = document.createElement('button');
            ignoreBtn.className = 'priority-button';
            ignoreBtn.innerText = '-';
            ignoreBtn.style.display = this.altKeyPressed
                ? 'inline-block'
                : 'none';
            ignoreBtn.style.background =
                currentLevel === -1 ? 'orange' : 'transparent';
            ignoreBtn.style.color = currentLevel === -1 ? 'white' : 'orange';
            ignoreBtn.style.border = '1px solid orange';
            ignoreBtn.style.borderRadius = '2px';
            ignoreBtn.style.padding = '1px 4px';
            ignoreBtn.style.fontSize = '10px';
            ignoreBtn.style.cursor = 'pointer';
            ignoreBtn.style.fontWeight = 'bold';
            ignoreBtn.style.pointerEvents = 'auto';
            ignoreBtn.style.zIndex = '1001';
            ignoreBtn.style.userSelect = 'none';
            ignoreBtn.title =
                currentLevel === -1 ? 'Un-ignore Item' : 'Hide Item';

            // Use UIManager to bind the click event properly
            this.uiManager.bindOnClickBlockHsMask(ignoreBtn, () => {
                this.toggleItemIgnored(itemName);
            });

            itemContainer.appendChild(priorityBtn);
            itemContainer.appendChild(ignoreBtn);

            // Apply stack limit logic for ground items
            const isIgnored = ignoredItems.has(itemName);
            const shouldShowIgnored = this.altKeyPressed;

            if (isIgnored && !shouldShowIgnored) {
                // Hidden ignored item
                itemContainer.style.display = 'none';
                hiddenItemCount++;
            } else {
                // Visible item - check stack limit only when ALT is not pressed
                if (
                    !this.altKeyPressed &&
                    visibleItemCount >= maxGroundItemStack
                ) {
                    // Hide this item due to stack limit (only when ALT is not pressed)
                    itemContainer.style.display = 'none';
                    hiddenItemCount++;

                    // Add stack indicator to the last visible item if not already added
                    if (
                        !stackIndicatorAdded &&
                        visibleItemCount === maxGroundItemStack
                    ) {
                        this.addGroundItemStackIndicator(
                            element,
                            hiddenItemCount
                        );
                        stackIndicatorAdded = true;
                    }
                } else {
                    // Show this item (always show when ALT is pressed)
                    itemContainer.style.display = 'flex';
                    visibleItemCount++;
                }
            }

            element.appendChild(itemContainer);
        }

        // Apply theming
        this.applyGroundItemElementTheme(element);

        this.GroundItemDomElements[representativeKey] = {
            element: element,
            position: Vector3.ZeroReadOnly,
            itemName: `${positionGroup.items.size} types`,
            quantity: positionGroup.totalItems,
            positionKey: positionKey,
        };

        document.getElementById('highlite-nameplates')?.appendChild(element);
    }

    private groupGroundItemsByPosition(GroundItems: Map<number, any>): Map<
        string,
        {
            items: Map<string, { items: any[]; count: number }>;
            firstKey: string;
            totalItems: number;
        }
    > {
        const positionGroups = new Map();
        const tolerance = 0.5; // 0.5 unit tolerance for grouping

        for (const [key, groundItem] of GroundItems) {
            const worldPos = this.getEntityWorldPosition(
                groundItem,
                'grounditem'
            );
            if (!worldPos) continue;

            // Find existing group within tolerance, or create new one
            let foundGroup = false;
            let groupKey = '';

            for (const [existingKey, existingGroup] of positionGroups) {
                const [existingX, existingZ] = existingKey
                    .split('_')
                    .map(Number);
                const distance = Math.sqrt(
                    Math.pow(worldPos.x - existingX, 2) +
                        Math.pow(worldPos.z - existingZ, 2)
                );

                if (distance <= tolerance) {
                    groupKey = existingKey;
                    foundGroup = true;
                    break;
                }
            }

            if (!foundGroup) {
                // Create new group with rounded position
                groupKey = `${Math.round(worldPos.x * 2) / 2}_${Math.round(worldPos.z * 2) / 2}`;
                positionGroups.set(groupKey, {
                    items: new Map(),
                    firstKey: String(key),
                    totalItems: 0,
                });
            }

            const positionGroup = positionGroups.get(groupKey)!;
            const itemName = groundItem._def._nameCapitalized;

            if (!positionGroup.items.has(itemName)) {
                positionGroup.items.set(itemName, { items: [], count: 0 });
            }

            positionGroup.items
                .get(itemName)!
                .items.push({ key: String(key), item: groundItem });
            positionGroup.items.get(itemName)!.count++;
            positionGroup.totalItems++;
        }

        return positionGroups;
    }

    private cleanupUnusedGroundItemElements(
        positionGroups: Map<string, any>
    ): void {
        // Get all currently active representative keys
        const activeRepresentativeKeys = new Set<string>();
        for (const [, positionGroup] of positionGroups) {
            activeRepresentativeKeys.add(positionGroup.firstKey);
        }

        // Remove elements that are no longer active
        for (const key in this.GroundItemDomElements) {
            if (!activeRepresentativeKeys.has(key)) {
                this.disposeElementFromCollection(
                    this.GroundItemDomElements,
                    key
                );
            }
        }
    }

    private getEntityWorldPosition(
        entity: any,
        entityType: 'player' | 'npc' | 'grounditem'
    ): Vector3 | null {
        if (!entity || !entity._appearance) {
            return null;
        }

        if (entityType === 'grounditem') {
            return (
                entity._appearance._billboardMesh?.getAbsolutePosition() || null
            );
        } else {
            return entity._appearance._haloNode?.getAbsolutePosition() || null;
        }
    }

    private resetPositionTracker(): void {
        this.positionTracker.clear();
    }

    private getPositionKey(worldPosition: Vector3): string {
        // Round to consistent grid for stacking with 1 unit tolerance
        // This prevents minor position changes from causing restacking
        const roundedX = Math.round(worldPosition.x);
        const roundedZ = Math.round(worldPosition.z);
        return `${roundedX}_${roundedZ}`;
    }

    private updateElementPosition(entityMesh: any, domElement: any): void {
        const translationCoordinates = Vector3.Project(
            Vector3.ZeroReadOnly,
            entityMesh.getWorldMatrix(),
            this.gameHooks.GameEngine.Instance.Scene.getTransformMatrix(),
            this.gameHooks.GameCameraManager.Camera.viewport.toGlobal(
                this.gameHooks.GameEngine.Instance.Engine.getRenderWidth(1),
                this.gameHooks.GameEngine.Instance.Engine.getRenderHeight(1)
            )
        );

        const camera = this.gameHooks.GameCameraManager.Camera;
        const isInFrustrum = camera.isInFrustum(entityMesh);

        // Calculate stacking offset and visibility
        const stackingResult = this.calculateStackingOffset(domElement);

        // Apply frustum culling first - if not in frustum, hide regardless of stack limits
        if (!isInFrustrum) {
            domElement.element.style.visibility = 'hidden';
            return;
        }

        // Handle visibility based on stack limits (only if in frustum)
        if (!stackingResult.shouldShow) {
            domElement.element.style.visibility = 'hidden';
            return;
        } else {
            domElement.element.style.visibility = 'visible';
        }

        // Add stack indicator if needed
        this.updateStackIndicator(domElement, stackingResult.stackInfo);

        domElement.element.style.transform = `translate3d(calc(${this.pxToRem(translationCoordinates.x)}rem - 50%), calc(${this.pxToRem(translationCoordinates.y - 30 - stackingResult.offset)}rem - 50%), 0px)`;
    }

    private calculateStackingOffset(domElement: any): {
        offset: number;
        shouldShow: boolean;
        stackInfo?: { total: number; hidden: number; type: string };
    } {
        if (!domElement.position) {
            return { offset: 0, shouldShow: true };
        }

        const positionKey = this.getPositionKey(domElement.position);

        // Collect all elements at this position
        const elementsAtPosition: Array<{
            element: HTMLDivElement;
            id: string;
            type: string;
        }> = [];

        // Add NPCs at this position
        for (const [key, npcElement] of Object.entries(this.NPCDomElements)) {
            if (
                npcElement.position &&
                this.getPositionKey(npcElement.position) === positionKey
            ) {
                elementsAtPosition.push({
                    element: npcElement.element,
                    id: `npc_${key}`,
                    type: 'npc',
                });
            }
        }

        // Add Players at this position
        for (const [key, playerElement] of Object.entries(
            this.PlayerDomElements
        )) {
            if (
                playerElement.position &&
                this.getPositionKey(playerElement.position) === positionKey
            ) {
                elementsAtPosition.push({
                    element: playerElement.element,
                    id: `player_${key}`,
                    type: 'player',
                });
            }
        }

        // Add Ground Items at this position
        for (const [key, groundElement] of Object.entries(
            this.GroundItemDomElements
        )) {
            if (
                groundElement.position &&
                this.getPositionKey(groundElement.position) === positionKey
            ) {
                elementsAtPosition.push({
                    element: groundElement.element,
                    id: `ground_${key}`,
                    type: 'ground',
                });
            }
        }

        if (elementsAtPosition.length <= 1) {
            return { offset: 0, shouldShow: true };
        }

        // Sort by type priority (ground items first, then NPCs, then players) and then by ID for consistency
        // Main player should always be on top
        elementsAtPosition.sort((a, b) => {
            const typePriority = { ground: 0, npc: 1, player: 2 };
            const priorityDiff =
                typePriority[a.type as keyof typeof typePriority] -
                typePriority[b.type as keyof typeof typePriority];
            if (priorityDiff !== 0) return priorityDiff;

            // Check if either element is the main player
            const isMainPlayerA =
                a.type === 'player' &&
                this.gameHooks.EntityManager.Instance.MainPlayer &&
                a.id.includes(
                    `player-${this.gameHooks.EntityManager.Instance.MainPlayer._entityId}`
                );
            const isMainPlayerB =
                b.type === 'player' &&
                this.gameHooks.EntityManager.Instance.MainPlayer &&
                b.id.includes(
                    `player-${this.gameHooks.EntityManager.Instance.MainPlayer._entityId}`
                );

            // Main player should always be first (lowest index = highest position)
            if (isMainPlayerA && !isMainPlayerB) return -1;
            if (!isMainPlayerA && isMainPlayerB) return 1;

            return a.id.localeCompare(b.id);
        });

        // Find the index of the current element
        const currentElementId = domElement.element.id;
        const index = elementsAtPosition.findIndex(
            el => el.element.id === currentElementId
        );

        // Determine element type and max stack limit
        const elementType = domElement.element.id.includes('npc')
            ? 'npc'
            : domElement.element.id.includes('player')
              ? 'player'
              : 'ground';

        // Check if this is the main player
        const isMainPlayer =
            elementType === 'player' &&
            this.gameHooks.EntityManager.Instance.MainPlayer &&
            domElement.element.id.includes(
                `player-${this.gameHooks.EntityManager.Instance.MainPlayer._entityId}`
            );

        // Main player should never be subject to stack limits and should have a fixed high position
        if (isMainPlayer) {
            return { offset: 50, shouldShow: true };
        }

        const maxStack =
            elementType === 'npc'
                ? (this.settings.maxNPCStack!.value as number)
                : elementType === 'player'
                  ? (this.settings.maxPlayerStack!.value as number)
                  : (this.settings.maxGroundItemStack!.value as number);

        // For ground items, we need to count individual items within the nameplate
        let effectiveIndex = index;
        let effectiveTotal = elementsAtPosition.length;

        if (elementType === 'ground') {
            // Ground items are handled differently - the stack limit applies to items within the nameplate
            // This is handled in the createGroundItemElement method, not here
            // Here we just use the position-based counting for the nameplate itself
            const groundElementsAtPosition = elementsAtPosition.filter(
                el => el.type === 'ground'
            );
            const groundIndex = groundElementsAtPosition.findIndex(
                el => el.element.id === currentElementId
            );
            effectiveIndex = groundIndex;
            effectiveTotal = groundElementsAtPosition.length;
        }

        // Check if this element should be shown based on stack limits
        if (effectiveIndex >= maxStack) {
            return {
                offset: 0,
                shouldShow: false,
                stackInfo: {
                    total: effectiveTotal,
                    hidden: effectiveTotal - maxStack,
                    type: elementType,
                },
            };
        }

        // If this is the last visible element and there are hidden elements, add stack info
        if (effectiveIndex === maxStack - 1 && effectiveTotal > maxStack) {
            return {
                offset: index * 25,
                shouldShow: true,
                stackInfo: {
                    total: effectiveTotal,
                    hidden: effectiveTotal - maxStack,
                    type: elementType,
                },
            };
        }

        return { offset: (index as number) * 25, shouldShow: true };
    }

    private addGroundItemStackIndicator(
        element: HTMLDivElement,
        hiddenCount: number
    ): void {
        // Find the last visible item container
        const itemContainers = Array.from(element.children) as HTMLElement[];
        const lastVisibleContainer = itemContainers.find(
            container => container.style.display !== 'none'
        );

        if (lastVisibleContainer) {
            // Create stack indicator
            const stackIndicator = document.createElement('div');
            stackIndicator.className = 'ground-stack-indicator';
            stackIndicator.style.position = 'absolute';
            stackIndicator.style.top = '-12px';
            stackIndicator.style.left = '50%';
            stackIndicator.style.transform = 'translateX(-50%)';
            stackIndicator.style.fontSize = '8px';
            stackIndicator.style.fontWeight = '600';
            stackIndicator.style.color = '#FFA500';
            stackIndicator.style.textShadow = '0 0 3px rgba(255, 165, 0, 0.8)';
            stackIndicator.style.letterSpacing = '0.3px';
            stackIndicator.style.textTransform = 'uppercase';
            stackIndicator.style.zIndex = '1003';
            stackIndicator.style.pointerEvents = 'none';
            stackIndicator.style.background = 'rgba(0, 0, 0, 0.4)';
            stackIndicator.style.padding = '1px 3px';
            stackIndicator.style.borderRadius = '2px';
            stackIndicator.style.backdropFilter = 'blur(1px)';

            // Format the text
            if (hiddenCount === 1) {
                stackIndicator.textContent = '+1';
            } else if (hiddenCount < 10) {
                stackIndicator.textContent = `+${hiddenCount}`;
            } else {
                stackIndicator.textContent = `+${hiddenCount}+`;
            }

            lastVisibleContainer.appendChild(stackIndicator);
        }
    }

    private updateStackIndicator(
        domElement: any,
        stackInfo?: { total: number; hidden: number; type: string }
    ): void {
        if (!stackInfo || stackInfo.hidden <= 0) {
            // Remove any existing stack indicator
            const existingIndicator =
                domElement.element.querySelector('.stack-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            return;
        }

        // Check if stack indicator already exists
        let stackIndicator =
            domElement.element.querySelector('.stack-indicator');

        if (!stackIndicator) {
            // Create new stack indicator
            stackIndicator = document.createElement('div');
            stackIndicator.className = 'stack-indicator';
            stackIndicator.style.position = 'absolute';
            stackIndicator.style.top = '-16px';
            stackIndicator.style.left = '50%';
            stackIndicator.style.transform = 'translateX(-50%)';
            stackIndicator.style.fontSize = '9px';
            stackIndicator.style.fontWeight = '600';
            stackIndicator.style.zIndex = '1001';
            stackIndicator.style.pointerEvents = 'none';
            stackIndicator.style.letterSpacing = '0.5px';
            stackIndicator.style.textTransform = 'uppercase';

            // Apply theming based on element type
            const elementType = domElement.element.id.includes('npc')
                ? 'npc'
                : domElement.element.id.includes('player')
                  ? 'player'
                  : 'ground';

            if (elementType === 'npc') {
                stackIndicator.style.color = '#FFD700';
                stackIndicator.style.textShadow =
                    '0 0 4px rgba(255, 215, 0, 0.8)';
            } else if (elementType === 'player') {
                stackIndicator.style.color = '#87CEEB';
                stackIndicator.style.textShadow =
                    '0 0 4px rgba(135, 206, 235, 0.8)';
            } else {
                stackIndicator.style.color = '#FFA500';
                stackIndicator.style.textShadow =
                    '0 0 4px rgba(255, 165, 0, 0.8)';
            }

            // Add subtle background glow
            stackIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
            stackIndicator.style.padding = '1px 4px';
            stackIndicator.style.borderRadius = '2px';
            stackIndicator.style.backdropFilter = 'blur(2px)';

            domElement.element.appendChild(stackIndicator);
        }

        // Update the indicator text with better formatting
        const count = stackInfo.hidden;
        if (count === 1) {
            stackIndicator.textContent = '+1';
        } else if (count < 10) {
            stackIndicator.textContent = `+${count}`;
        } else {
            stackIndicator.textContent = `+${count}+`;
        }
    }

    private pxToRem(px: number): number {
        return px / 16;
    }

    private updateAllFontSizes(): void {
        // Update NPC font sizes
        for (const key in this.NPCDomElements) {
            const element = this.NPCDomElements[key].element;
            element.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;

            // Update all child elements (name and level) font sizes as well
            const childElements = element.children;
            for (let i = 0; i < childElements.length; i++) {
                const childElement = childElements[i] as HTMLElement;
                childElement.style.fontSize = `${this.settings.npcNameplateSize!.value}px`;
            }
        }

        // Update player font sizes
        for (const key in this.PlayerDomElements) {
            const element = this.PlayerDomElements[key].element;
            const isMainPlayer = element.style.color === 'cyan';
            const fontSize = isMainPlayer
                ? this.settings.youNameplateSize!.value
                : this.settings.playerNameplateSize!.value;
            element.style.fontSize = `${fontSize}px`;
        }

        // Update ground item font sizes
        for (const key in this.GroundItemDomElements) {
            const element = this.GroundItemDomElements[key].element;
            element.style.fontSize = `${this.settings.groundItemNameplateSize!.value}px`;

            // Update all child elements (individual item lines) font sizes as well
            const childElements = element.children;
            for (let i = 0; i < childElements.length; i++) {
                const childElement = childElements[i] as HTMLElement;
                childElement.style.fontSize = `${this.settings.groundItemNameplateSize!.value}px`;
            }
        }
    }

    private updateStackLimits(): void {
        // Force recreation of ground item elements to apply new stack limits
        for (const key in this.GroundItemDomElements) {
            this.disposeElementFromCollection(this.GroundItemDomElements, key);
        }

        this.log('Stack limits updated, forcing ground item recreation');
    }

    private updateAllElementThemes(): void {
        // Update NPC themes
        for (const key in this.NPCDomElements) {
            this.applyNPCElementTheme(this.NPCDomElements[key].element);
        }

        // Update player themes
        for (const key in this.PlayerDomElements) {
            const element = this.PlayerDomElements[key].element;
            const isMainPlayer = element.style.color === 'cyan';
            this.applyPlayerElementTheme(element, isMainPlayer);
        }

        // Update ground item themes
        for (const key in this.GroundItemDomElements) {
            this.applyGroundItemElementTheme(
                this.GroundItemDomElements[key].element
            );
        }
    }

    private applyNPCElementTheme(element: HTMLDivElement): void {
        if (!this.settings.enableTheming?.value) {
            // Reset to basic styling
            element.style.background = 'transparent';
            element.style.border = 'none';
            element.style.borderRadius = '0';
            element.style.padding = '0';
            element.style.boxShadow = 'none';
            element.style.textShadow = 'none';
            return;
        }

        // Apply enhanced theming
        if (this.settings.showBackgrounds?.value) {
            element.style.background = 'rgba(0, 0, 0, 0.8)';
            element.style.borderRadius = '4px';
            element.style.padding = '2px 6px';
        } else {
            element.style.background = 'transparent';
            element.style.borderRadius = '0';
            element.style.padding = '0';
        }

        if (this.settings.showBorders?.value) {
            element.style.border = '1px solid rgba(255, 255, 0, 0.6)';
        } else {
            element.style.border = 'none';
        }

        if (this.settings.showShadows?.value) {
            element.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
            element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        } else {
            element.style.textShadow = 'none';
            element.style.boxShadow = 'none';
        }

        // Apply theme to child elements
        const childElements = element.children;
        for (let i = 0; i < childElements.length; i++) {
            const childElement = childElements[i] as HTMLElement;
            if (this.settings.showShadows?.value) {
                childElement.style.textShadow =
                    '1px 1px 2px rgba(0, 0, 0, 0.8)';
            } else {
                childElement.style.textShadow = 'none';
            }
        }
    }

    private applyPlayerElementTheme(
        element: HTMLDivElement,
        isMainPlayer: boolean
    ): void {
        if (!this.settings.enableTheming?.value) {
            // Reset to basic styling
            element.style.background = 'transparent';
            element.style.border = 'none';
            element.style.borderRadius = '0';
            element.style.padding = '0';
            element.style.boxShadow = 'none';
            element.style.textShadow = 'none';
            return;
        }

        // Determine player type for theming
        const isFriend = element.style.color === 'lightgreen';
        const isMainPlayerElement = element.style.color === 'cyan';

        // Apply enhanced theming
        if (this.settings.showBackgrounds?.value) {
            if (isMainPlayerElement) {
                element.style.background = 'rgba(0, 255, 255, 0.2)';
            } else if (isFriend) {
                element.style.background = 'rgba(144, 238, 144, 0.2)';
            } else {
                element.style.background = 'rgba(255, 255, 255, 0.1)';
            }
            element.style.borderRadius = '4px';
            element.style.padding = '2px 6px';
        } else {
            element.style.background = 'transparent';
            element.style.borderRadius = '0';
            element.style.padding = '0';
        }

        if (this.settings.showBorders?.value) {
            if (isMainPlayerElement) {
                element.style.border = '1px solid rgba(0, 255, 255, 0.6)';
            } else if (isFriend) {
                element.style.border = '1px solid rgba(144, 238, 144, 0.6)';
            } else {
                element.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            }
        } else {
            element.style.border = 'none';
        }

        if (this.settings.showShadows?.value) {
            element.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
            element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        } else {
            element.style.textShadow = 'none';
            element.style.boxShadow = 'none';
        }
    }

    private applyGroundItemElementTheme(element: HTMLDivElement): void {
        if (!this.settings.enableTheming?.value) {
            // Reset to basic styling
            element.style.background = 'transparent';
            element.style.border = 'none';
            element.style.borderRadius = '0';
            element.style.padding = '0';
            element.style.boxShadow = 'none';
            element.style.textShadow = 'none';
            return;
        }

        // Check if this element has any visible (non-ignored) items
        const hasVisibleItems = this.hasVisibleGroundItems(element);

        if (!hasVisibleItems) {
            // If no visible items, don't apply any theming
            element.style.background = 'transparent';
            element.style.border = 'none';
            element.style.borderRadius = '0';
            element.style.padding = '0';
            element.style.boxShadow = 'none';
            element.style.textShadow = 'none';
            return;
        }

        // Apply enhanced theming only if there are visible items
        if (this.settings.showBackgrounds?.value) {
            element.style.background = 'rgba(255, 165, 0, 0.15)';
            element.style.borderRadius = '4px';
            element.style.padding = '2px 6px';
        } else {
            element.style.background = 'transparent';
            element.style.borderRadius = '0';
            element.style.padding = '0';
        }

        if (this.settings.showBorders?.value) {
            element.style.border = '1px solid rgba(255, 165, 0, 0.4)';
        } else {
            element.style.border = 'none';
        }

        if (this.settings.showShadows?.value) {
            element.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
            element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        } else {
            element.style.textShadow = 'none';
            element.style.boxShadow = 'none';
        }

        // Apply theme to child elements (item containers)
        const childElements = element.children;
        for (let i = 0; i < childElements.length; i++) {
            const childElement = childElements[i] as HTMLElement;
            if (this.settings.showShadows?.value) {
                childElement.style.textShadow =
                    '1px 1px 2px rgba(0, 0, 0, 0.8)';
            } else {
                childElement.style.textShadow = 'none';
            }
        }
    }

    private hasVisibleGroundItems(element: HTMLDivElement): boolean {
        const ignoredItems = this.getIgnoredItemsSet();
        const itemContainers = element.children;

        for (let i = 0; i < itemContainers.length; i++) {
            const container = itemContainers[i] as HTMLElement;
            const textSpan = container.querySelector('span');
            if (!textSpan) continue;

            const itemName = textSpan.innerText.split(' [x')[0];

            // Check if this item is visible (not ignored, or ALT is pressed)
            if (!ignoredItems.has(itemName) || this.altKeyPressed) {
                return true;
            }
        }

        return false;
    }

    private disposeElementFromCollection(
        collection: any,
        key: string | number
    ): void {
        if (collection[key]?.element) {
            collection[key].element.remove();
            delete collection[key];
        }
    }

    private cleanupElementCollection(collection: any): void {
        for (const key in collection) {
            if (collection[key]) {
                collection[key].element.remove();
                delete collection[key];
            }
        }
    }

    private cleanupAllElements(): void {
        this.cleanupElementCollection(this.NPCDomElements);
        this.cleanupElementCollection(this.PlayerDomElements);
        this.cleanupElementCollection(this.GroundItemDomElements);

        this.NPCDomElements = {};
        this.PlayerDomElements = {};
        this.GroundItemDomElements = {};

        if (this.DOMElement) {
            this.DOMElement.remove();
            this.DOMElement = null;
        }
    }

    private setupAllElements(): void {
        this.cleanupAllElements();

        // Use UIManager to create the container with ClientRelative scope
        this.DOMElement = this.uiManager.createElement(
            UIManagerScope.ClientRelative
        ) as HTMLDivElement;
        if (this.DOMElement) {
            this.DOMElement.id = 'highlite-nameplates';
            this.DOMElement.style.position = 'absolute';
            this.DOMElement.style.pointerEvents = 'none';
            this.DOMElement.style.zIndex = '1';
            this.DOMElement.style.overflow = 'hidden';
            this.DOMElement.style.width = '100%';
            this.DOMElement.style.height =
                'calc(100% - var(--titlebar-height))'; // Account for titlebar height
            this.DOMElement.style.top = 'var(--titlebar-height)'; // Position below titlebar
            this.DOMElement.style.fontFamily = 'Inter';
            this.DOMElement.style.fontSize = '12px';
            this.DOMElement.style.fontWeight = 'bold';

            // Inject CSS variables from screen mask to ensure proper styling
            this.injectCSSVariables();
        }
    }
}
