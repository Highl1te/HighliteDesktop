import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';
import { PanelManager } from '../core/managers/highlite/panelManager';
import { DatabaseManager } from '../core/managers/highlite/databaseManager';

interface TrackedNPC {
    entityId: number;
    defId: number;
    name: string;
    position: { x: number; y: number; z: number };
    deathTime: number;
}

interface NPCHealthTracker {
    entityId: number;
    currentHP: number;
    maxHP: number;
    name: string;
    position: { x: number; y: number; z: number };
    damageListener: any;
}

interface NPCKillData {
    name: string;
    killCount: number;
    drops: {
        [itemId: number]: {
            name: string;
            quantity: number;
            totalDropped: number;
        };
    };
    lastUpdated: number;
}

export class DropLog extends Plugin {
    pluginName = 'Drop Log';
    author = 'JayArrowz';
    private panelManager: PanelManager = new PanelManager();
    private panelContent: HTMLElement | null = null;
    private static readonly DB_STORE_NAME = 'drop_logs';
    private isLoggedIn = false;

    private attackedNPCs: Set<number> = new Set();
    private npcDataCache: Map<number, any> = new Map(); // entityId -> npc data when first tracked
    private npcHealthTrackers: Map<number, NPCHealthTracker> = new Map(); // entityId -> health tracker
    private pendingDeaths: Map<number, TrackedNPC> = new Map();
    private dropData: Map<number, NPCKillData> = new Map(); // defId -> kill data
    private lastGroundItems: Map<number, any> = new Map();
    private groundItemTimestamps: Map<number, number> = new Map();

    private searchQuery: string = '';
    private filteredData: Array<[number, NPCKillData]> = [];
    private virtualScrollContainer: HTMLElement | null = null;
    private virtualScrollContent: HTMLElement | null = null;
    private itemHeight: number = 120;
    private scrollTop: number = 0;
    private processedDeaths: Set<string> = new Set();

    constructor() {
        super();

        this.settings.enabled = {
            text: 'Enable Drop Log',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {
                if (this.settings.enabled.value) {
                    this.initializePlugin();
                } else {
                    this.disablePlugin();
                }
            },
        } as any;

        this.settings.maxDistance = {
            text: 'Max Drop Distance',
            type: SettingsTypes.range,
            value: 5,
            callback: () => {},
        } as any;

        this.settings.dropTimeout = {
            text: 'Drop Timeout (ms)',
            type: SettingsTypes.range,
            value: 2000,
            callback: () => {},
        } as any;
    }

    start(): void {
        if (!this.settings.enabled?.value) {
            return;
        }

        this.createPanel();
        this.addCSSStyles();

        if (this.isLoggedIn) {
            this.loadFromDatabase();
        }
    }

    init(): void {}

    GameLoop_update(): void {
        if (!this.settings.enabled?.value || !this.isLoggedIn) return;

        this.trackCurrentTarget();
        this.checkForDeaths();
        this.checkForDrops();
        this.cleanupOldDeaths();
    }

    private trackCurrentTarget(): void {
        try {
            const gameHooks = (document as any).highlite?.gameHooks;
            if (!gameHooks) return;

            const entityManager = gameHooks.EntityManager?.Instance;
            if (!entityManager) return;

            const mainPlayer = entityManager.MainPlayer;
            if (!mainPlayer) return;

            const currentTarget = mainPlayer.CurrentTarget;
            if (!currentTarget) return;

            if (!currentTarget._def || currentTarget._isDestroyed) return;

            const entityId = currentTarget._entityId;
            if (!entityId) return;

            if (this.attackedNPCs.has(entityId)) return;

            const npc = entityManager.NPCs?.get(entityId);
            if (!npc) return;

            this.npcDataCache.set(entityId, {
                entityId: entityId,
                def: currentTarget._def,
                position: npc._currentGamePosition || npc._lastGamePosition,
                name:
                    currentTarget._def._nameCapitalized ||
                    currentTarget._def._name,
            });

            this.setupHealthTracker(entityId, npc, currentTarget._def);
            this.attackedNPCs.add(entityId);
        } catch (error) {}
    }

    private setupHealthTracker(entityId: number, npc: any, def: any): void {
        try {
            if (this.npcHealthTrackers.has(entityId)) return;

            const currentHP = npc.Hitpoints?._currentLevel || 0;
            const maxHP = npc.Hitpoints?._level || currentHP;
            const name = def._nameCapitalized || def._name || `NPC ${entityId}`;
            const position = {
                x:
                    npc._currentGamePosition?._x ||
                    npc._lastGamePosition?._x ||
                    0,
                y:
                    npc._currentGamePosition?._y ||
                    npc._lastGamePosition?._y ||
                    0,
                z:
                    npc._currentGamePosition?._z ||
                    npc._lastGamePosition?._z ||
                    0,
            };

            const damageListener = (
                hitpointsObj: any,
                damageAmount: number
            ) => {
                this.handleNPCDamage(entityId, hitpointsObj, damageAmount);
            };

            const tracker: NPCHealthTracker = {
                entityId,
                currentHP,
                maxHP,
                name,
                position,
                damageListener,
            };

            if (npc.Hitpoints && npc.Hitpoints.OnReceivedDamageListener) {
                npc.Hitpoints.OnReceivedDamageListener.add(damageListener);
                this.npcHealthTrackers.set(entityId, tracker);
            }
        } catch (error) {}
    }

    private handleNPCDamage(
        entityId: number,
        hitpointsObj: any,
        damageAmount: number
    ): void {
        try {
            const tracker = this.npcHealthTrackers.get(entityId);
            if (!tracker) return;

            const currentHP = hitpointsObj._currentLevel || 0;
            const hpAfterDamage = currentHP - damageAmount;
            tracker.currentHP = Math.max(0, hpAfterDamage);

            if (hpAfterDamage <= 0) {
                const trackedNPC: TrackedNPC = {
                    entityId,
                    defId: this.npcDataCache.get(entityId)?.def?._id || 0,
                    name: tracker.name,
                    position: tracker.position,
                    deathTime: Date.now(),
                };

                this.pendingDeaths.set(entityId, trackedNPC);
                this.cleanupHealthTracker(entityId);
            }
        } catch (error) {}
    }

    private cleanupHealthTracker(entityId: number): void {
        try {
            const tracker = this.npcHealthTrackers.get(entityId);
            if (tracker) {
                const npc = (
                    document as any
                ).highlite?.gameHooks?.EntityManager?.Instance?.NPCs?.get(
                    entityId
                );
                if (
                    npc &&
                    npc.Hitpoints &&
                    npc.Hitpoints.OnReceivedDamageListener
                ) {
                    npc.Hitpoints.OnReceivedDamageListener.remove(
                        tracker.damageListener
                    );
                }

                this.npcHealthTrackers.delete(entityId);
                this.attackedNPCs.delete(entityId);
                this.npcDataCache.delete(entityId);
            }
        } catch (error) {}
    }

    private checkForDeaths(): void {
        if (this.npcHealthTrackers.size === 0) return;

        const trackersToRemove: number[] = [];

        for (const [entityId, tracker] of this.npcHealthTrackers) {
            try {
                const npc = (
                    document as any
                ).highlite?.gameHooks?.EntityManager?.Instance?.NPCs?.get(
                    entityId
                );

                if (!npc) {
                    trackersToRemove.push(entityId);
                } else {
                    if (npc._currentGamePosition) {
                        tracker.position = {
                            x: npc._currentGamePosition._x,
                            y: npc._currentGamePosition._y,
                            z: npc._currentGamePosition._z,
                        };
                    }
                }
            } catch (error) {
                trackersToRemove.push(entityId);
            }
        }

        if (trackersToRemove.length > 0) {
            trackersToRemove.forEach((id) => {
                this.cleanupHealthTracker(id);
            });
        }
    }

    private checkForDrops(): void {
        try {
            const groundItems = (document as any).highlite?.gameHooks
                ?.GroundItemManager?.Instance?._groundItems;
            if (!groundItems) return;

            const itemsToMatch: Array<{ item: any; entityId: number }> = [];
            groundItems.forEach((item: any, itemEntityId: number) => {
                if (this.lastGroundItems.has(itemEntityId)) return;

                itemsToMatch.push({ item, entityId: itemEntityId });
                this.lastGroundItems.set(itemEntityId, item);
                this.groundItemTimestamps.set(itemEntityId, Date.now());
            });

            const processedDeaths = new Set<number>();
            for (const { item, entityId } of itemsToMatch) {
                for (const [npcEntityId, trackedNPC] of this.pendingDeaths) {
                    if (processedDeaths.has(npcEntityId)) continue;

                    if (this.isItemNearPosition(item, trackedNPC.position)) {
                        const itemAppearTime =
                            this.groundItemTimestamps.get(entityId) || 0;
                        if (itemAppearTime >= trackedNPC.deathTime) {
                            this.recordDrop(trackedNPC, item);
                        }
                    }
                }
            }

            const currentItemIds = new Set(Array.from(groundItems.keys()));
            for (const [itemId] of this.lastGroundItems) {
                if (!currentItemIds.has(itemId)) {
                    this.lastGroundItems.delete(itemId);
                    this.groundItemTimestamps.delete(itemId);
                }
            }
        } catch (error) {}
    }

    private getDistance(
        item: any,
        position: { x: number; y: number; z: number }
    ): number {
        if (!item._currentGamePosition) return Infinity;

        const itemPos = item._currentGamePosition;
        return Math.sqrt(
            Math.pow(itemPos._x - position.x, 2) +
                Math.pow(itemPos._z - position.z, 2)
        );
    }

    private isItemNearPosition(
        item: any,
        position: { x: number; y: number; z: number }
    ): boolean {
        const distance = this.getDistance(item, position);
        const maxDistance = (this.settings.maxDistance?.value as number) || 5;
        return distance <= maxDistance;
    }

    private recordDrop(npc: TrackedNPC, item: any): void {
        try {
            this.log('recordDrop', npc, item);
            if (!this.dropData.has(npc.defId)) {
                this.dropData.set(npc.defId, {
                    name: npc.name,
                    killCount: 0,
                    drops: {},
                    lastUpdated: Date.now(),
                });
            }

            const killData = this.dropData.get(npc.defId)!;
            const deathKey = `${npc.entityId}_${npc.deathTime}`;
            if (!this.processedDeaths.has(deathKey)) {
                const oldCount = killData.killCount;
                killData.killCount++;
                this.log(
                    `Incrementing kill count for ${npc.name} (defId: ${npc.defId}) from ${oldCount} to ${killData.killCount}`
                );
                this.processedDeaths.add(deathKey);
            }

            const itemId = item._def?._id || item._entityTypeId;
            const itemName =
                item._def?._nameCapitalized ||
                item._def?._name ||
                `Item ${itemId}`;
            const quantity = item._amount || 1;

            if (!killData.drops[itemId]) {
                killData.drops[itemId] = {
                    name: itemName,
                    quantity: 0,
                    totalDropped: 0,
                };
            }

            killData.drops[itemId].quantity += quantity;
            killData.drops[itemId].totalDropped++;
            killData.lastUpdated = Date.now();

            this.updatePanelContent();
            this.saveNPCToDatabase(npc.defId, killData);
        } catch (error) {
            console.error('Error recording drop', error);
        }
    }

    private cleanupOldDeaths(): void {
        if (this.pendingDeaths.size === 0) return;

        const timeout = (this.settings.dropTimeout?.value as number) || 2000;
        const now = Date.now();

        const toRemove: number[] = [];
        for (const [entityId, trackedNPC] of this.pendingDeaths) {
            const timeSinceDeath = now - trackedNPC.deathTime;

            if (timeSinceDeath > timeout) {
                const deathKey = `${entityId}_${trackedNPC.deathTime}`;
                const alreadyCounted = this.processedDeaths.has(deathKey);

                if (!alreadyCounted) {
                    if (!this.dropData.has(trackedNPC.defId)) {
                        this.dropData.set(trackedNPC.defId, {
                            name: trackedNPC.name,
                            killCount: 0,
                            drops: {},
                            lastUpdated: Date.now(),
                        });
                    }
                    const killData = this.dropData.get(trackedNPC.defId)!;
                    const oldCount = killData.killCount;
                    killData.killCount++;
                    this.log(
                        `Incrementing kill count (timeout) for ${trackedNPC.name} (defId: ${trackedNPC.defId}) from ${oldCount} to ${killData.killCount}`
                    );
                    killData.lastUpdated = Date.now();
                    this.processedDeaths.add(deathKey);
                    this.saveNPCToDatabase(trackedNPC.defId, killData);
                }

                this.updatePanelContent();
                toRemove.push(entityId);
            }
        }

        if (toRemove.length > 0) {
            toRemove.forEach((id) => this.pendingDeaths.delete(id));
        }
    }

    private createPanel(): void {
        try {
            const panelItems = this.panelManager.requestMenuItem(
                '📋',
                'Drop Log'
            );
            if (!panelItems) return;

            this.panelContent = panelItems[1] as HTMLElement;

            this.panelContent.className = 'drop-log-panel';
            this.panelContent.style.width = '100%';
            this.panelContent.style.height = '100%';
            this.panelContent.style.display = 'flex';
            this.panelContent.style.flexDirection = 'column';

            this.injectSpriteStyles();
            this.updatePanelContent();
        } catch (error) {
            console.error('Error creating panel', error);
        }
    }

    private updatePanelContent(): void {
        if (!this.panelContent) return;

        this.injectSpriteStyles();

        this.panelContent.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'drop-log-header';

        if (!this.isLoggedIn) {
            header.innerHTML = `
                <h3>Drop Log</h3>
                <div class="drop-log-login-message">
                    <p>Please log into the game to start tracking drops</p>
                    <p>The drop log will automatically load once you're logged in</p>
                </div>
            `;
            this.panelContent.appendChild(header);
            return;
        }

        const filteredCount = this.getFilteredData().length;
        header.innerHTML = `
            <h3>Drop Log</h3>
            <div class="drop-log-stats">
                <span>Total NPCs: ${this.dropData.size}</span>
                <span>Showing: ${filteredCount}</span>
                <span>Total Kills: ${Array.from(this.dropData.values()).reduce((sum, data) => sum + data.killCount, 0)}</span>
            </div>
        `;
        this.panelContent.appendChild(header);

        const controls = document.createElement('div');
        controls.className = 'drop-log-controls';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'drop-log-search';
        searchInput.placeholder = 'Search NPCs or items...';
        searchInput.value = this.searchQuery;
        searchInput.oninput = (e) => {
            this.searchQuery = (
                e.target as HTMLInputElement
            ).value.toLowerCase();
            this.updateVirtualList();
        };
        controls.appendChild(searchInput);

        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear Log';
        clearButton.className = 'drop-log-clear-btn';
        clearButton.onclick = () => this.clearLog();
        controls.appendChild(clearButton);

        this.panelContent.appendChild(controls);

        const npcList = document.createElement('div');
        npcList.className = 'drop-log-list';

        this.virtualScrollContainer = document.createElement('div');
        this.virtualScrollContainer.className = 'drop-log-virtual-container';

        this.virtualScrollContent = document.createElement('div');
        this.virtualScrollContent.className = 'drop-log-virtual-content';

        this.virtualScrollContainer.appendChild(this.virtualScrollContent);
        npcList.appendChild(this.virtualScrollContainer);

        this.virtualScrollContainer.onscroll = () => {
            this.scrollTop = this.virtualScrollContainer!.scrollTop;
            this.updateVirtualList();
        };

        this.panelContent.appendChild(npcList);

        this.updateVirtualList();
    }

    private clearLog(): void {
        this.dropData.clear();
        this.attackedNPCs.clear();
        this.npcDataCache.clear();
        this.pendingDeaths.clear();
        this.lastGroundItems.clear();
        this.groundItemTimestamps.clear();
        this.processedDeaths.clear();
        this.searchQuery = '';
        this.scrollTop = 0;
        this.updatePanelContent();
        this.clearDatabase();
    }

    private removeNPCFromLog(defId: number): void {
        if (this.dropData.has(defId)) {
            this.dropData.delete(defId);
            this.updatePanelContent();
            this.removeNPCFromDatabase(defId);
        }
    }

    private getFilteredData(): Array<[number, NPCKillData]> {
        const allData = Array.from(this.dropData.entries());

        if (!this.searchQuery) {
            return allData.sort(
                ([, a], [, b]) => b.lastUpdated - a.lastUpdated
            );
        }

        return allData
            .filter(([defId, killData]) => {
                if (killData.name.toLowerCase().includes(this.searchQuery)) {
                    return true;
                }

                for (const [itemId, dropData] of Object.entries(
                    killData.drops
                )) {
                    if (
                        dropData.name.toLowerCase().includes(this.searchQuery)
                    ) {
                        return true;
                    }
                }

                return false;
            })
            .sort(([, a], [, b]) => b.lastUpdated - a.lastUpdated);
    }

    private updateVirtualList(): void {
        if (!this.virtualScrollContent || !this.virtualScrollContainer) return;

        this.filteredData = this.getFilteredData();

        if (this.filteredData.length === 0) {
            this.virtualScrollContent.innerHTML = `
                <div class="drop-log-empty">
                    ${
                        this.dropData.size === 0
                            ? 'No kills recorded yet. Start fighting some NPCs!'
                            : 'No results found for your search.'
                    }
                </div>
            `;
            return;
        }

        const containerHeight = this.virtualScrollContainer.clientHeight;
        const totalHeight = this.filteredData.length * this.itemHeight;

        const startIndex = Math.max(
            0,
            Math.floor(this.scrollTop / this.itemHeight) - 1
        );
        const visibleCount = Math.ceil(containerHeight / this.itemHeight);
        const actualStartIndex = Math.max(
            0,
            Math.min(startIndex, this.filteredData.length - visibleCount - 3)
        );
        const actualEndIndex = Math.min(
            actualStartIndex + visibleCount + 3,
            this.filteredData.length
        );

        const spacer = document.createElement('div');
        spacer.className = 'drop-log-virtual-spacer';
        spacer.style.height = `${totalHeight}px`;

        const visibleContainer = document.createElement('div');
        visibleContainer.className = 'drop-log-virtual-items';
        visibleContainer.style.transform = `translateY(${actualStartIndex * this.itemHeight}px)`;

        for (let i = actualStartIndex; i < actualEndIndex; i++) {
            const [defId, killData] = this.filteredData[i];
            const npcEntry = this.createNPCEntry(defId, killData);
            visibleContainer.appendChild(npcEntry);
        }

        this.virtualScrollContent.innerHTML = '';
        this.virtualScrollContent.appendChild(spacer);
        this.virtualScrollContent.appendChild(visibleContainer);
    }

    private createNPCEntry(defId: number, killData: NPCKillData): HTMLElement {
        const npcEntry = document.createElement('div');
        npcEntry.className = 'drop-log-npc-entry';

        const npcHeader = document.createElement('div');
        npcHeader.className = 'drop-log-npc-header';
        npcHeader.innerHTML = `
            <span class="npc-name">${killData.name}</span>
            <span class="kill-count">${killData.killCount} kills</span>
        `;

        const removeButton = document.createElement('button');
        removeButton.className = 'drop-log-npc-remove';
        removeButton.textContent = '×';
        removeButton.title = `Remove ${killData.name} from drop log`;
        removeButton.onclick = (e) => {
            e.stopPropagation();
            this.removeNPCFromLog(defId);
        };
        npcHeader.appendChild(removeButton);

        npcEntry.appendChild(npcHeader);

        const dropsList = document.createElement('div');
        dropsList.className = 'drop-log-drops';

        const sortedDrops = Object.entries(killData.drops).sort(
            ([, a], [, b]) => b.quantity - a.quantity
        );

        for (const [itemId, dropData] of sortedDrops) {
            const dropItem = document.createElement('div');
            dropItem.className = 'drop-log-drop-item';

            const sprite = document.createElement('div');
            sprite.className = 'drop-log-item-sprite';
            try {
                const pos = (
                    document as any
                ).highlite?.gameHooks?.InventoryItemSpriteManager?.getCSSBackgroundPositionForItem(
                    parseInt(itemId)
                );
                if (pos) {
                    sprite.style.backgroundPosition = pos;
                }
            } catch (error) {
                console.error('Error getting item sprite', error);
            }

            const info = document.createElement('div');
            info.className = 'drop-log-item-info';
            info.innerHTML = `
                <span class="item-name">${dropData.name}</span>
                <span class="item-quantity">${dropData.quantity.toLocaleString()} total (${dropData.totalDropped} drops)</span>
            `;

            dropItem.appendChild(sprite);
            dropItem.appendChild(info);
            dropsList.appendChild(dropItem);
        }

        if (Object.keys(killData.drops).length === 0) {
            const noDrops = document.createElement('div');
            noDrops.className = 'drop-log-no-drops';
            noDrops.textContent = 'No drops recorded';
            dropsList.appendChild(noDrops);
        }

        npcEntry.appendChild(dropsList);
        return npcEntry;
    }

    private async ensureObjectStore(): Promise<boolean> {
        try {
            const dbManager = (document as any).highlite?.managers
                ?.DatabaseManager as DatabaseManager;
            if (!dbManager || !dbManager.database) return false;

            if (
                !dbManager.database.objectStoreNames.contains(
                    DropLog.DB_STORE_NAME
                )
            )
                return false;

            return true;
        } catch (error) {
            console.error('Error ensuring object store', error);
            return false;
        }
    }

    private async saveNPCToDatabase(
        defId: number,
        killData: NPCKillData
    ): Promise<void> {
        try {
            if (!(await this.ensureObjectStore())) return;

            const dbManager = (document as any).highlite?.managers
                ?.DatabaseManager as DatabaseManager;
            const dataToSave = {
                defId,
                name: killData.name,
                killCount: killData.killCount,
                drops: killData.drops,
                lastUpdated: killData.lastUpdated, // Use the actual lastUpdated from killData
            };

            await dbManager.database.put(
                DropLog.DB_STORE_NAME,
                dataToSave,
                defId
            );
        } catch (error) {
            console.error('Error saving NPC to database', error);
        }
    }

    private async loadFromDatabase(): Promise<void> {
        try {
            if (!(await this.ensureObjectStore())) return;

            const dbManager = (document as any).highlite?.managers
                ?.DatabaseManager as DatabaseManager;
            const allRecords = await dbManager.database.getAll(
                DropLog.DB_STORE_NAME
            );

            if (!allRecords || allRecords.length === 0) return;

            this.dropData.clear();

            for (const record of allRecords) {
                if (
                    record.defId &&
                    record.name &&
                    typeof record.killCount === 'number'
                ) {
                    this.log(
                        `Loading NPC ${record.name} (defId: ${record.defId}) with ${record.killCount} kills`
                    );
                    this.dropData.set(record.defId, {
                        name: record.name,
                        killCount: record.killCount,
                        drops: record.drops || {},
                        lastUpdated: record.lastUpdated || Date.now(),
                    });
                }
            }

            if (this.panelContent) {
                this.updatePanelContent();
            }
        } catch (error) {
            console.error('Error loading from database', error);
        }
    }

    private async removeNPCFromDatabase(defId: number): Promise<void> {
        try {
            if (!(await this.ensureObjectStore())) return;

            const dbManager = (document as any).highlite?.managers
                ?.DatabaseManager as DatabaseManager;
            await dbManager.database.delete(DropLog.DB_STORE_NAME, defId);
        } catch (error) {
            console.error('Error removing NPC from database', error);
        }
    }

    private async clearDatabase(): Promise<void> {
        try {
            if (!(await this.ensureObjectStore())) return;

            const dbManager = (document as any).highlite?.managers
                ?.DatabaseManager as DatabaseManager;
            await dbManager.database.clear(DropLog.DB_STORE_NAME);
        } catch (error) {
            console.error('Error clearing database', error);
        }
    }

    private addCSSStyles(): void {
        const style = document.createElement('style');
        style.setAttribute('data-drop-log', 'true');
        style.textContent = `
            /* Ensure panel takes full width and height */
            .drop-log-panel {
                width: 100% !important;
                height: 100% !important;
                display: flex;
                flex-direction: column;
            }

            .drop-log-header {
                padding: 10px;
                border-bottom: 1px solid #333;
                margin-bottom: 10px;
                flex-shrink: 0;
            }

            .drop-log-header h3 {
                margin: 0 0 8px 0;
                color: #fff;
                font-size: 16px;
            }

            .drop-log-stats {
                display: flex;
                gap: 15px;
                font-size: 12px;
                color: #aaa;
            }

            .drop-log-login-message {
                text-align: center;
                padding: 20px;
                color: #aaa;
                font-style: italic;
            }

            .drop-log-login-message p {
                margin: 8px 0;
                font-size: 14px;
            }

            .drop-log-controls {
                padding: 0 10px 10px 10px;
                border-bottom: 1px solid #333;
                margin-bottom: 10px;
                flex-shrink: 0;
                display: flex;
                gap: 10px;
                align-items: center;
                flex-wrap: wrap;
            }

            .drop-log-search {
                flex: 1;
                min-width: 150px;
                padding: 6px 10px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: #fff;
                font-size: 12px;
            }

            .drop-log-search::placeholder {
                color: #888;
            }

            .drop-log-search:focus {
                outline: none;
                border-color: #4a9eff;
                box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
            }

            .drop-log-clear-btn {
                background: #dc3545;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
            }

            .drop-log-clear-btn:hover {
                background: #c82333;
            }

            .drop-log-list {
                flex: 1;
                min-height: 0;
                position: relative;
            }

            .drop-log-virtual-container {
                height: 100%;
                overflow-y: auto;
                overflow-x: hidden;
                position: relative;
                scroll-behavior: smooth;
            }

            .drop-log-virtual-content {
                position: relative;
                min-height: 100%;
            }

            .drop-log-virtual-spacer {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                pointer-events: none;
                z-index: 1;
            }

            .drop-log-virtual-items {
                position: relative;
                z-index: 2;
            }



            .drop-log-npc-entry {
                margin-bottom: 15px;
                border: 1px solid #333;
                border-radius: 5px;
                background: rgba(0, 0, 0, 0.3);
            }

            .drop-log-npc-header {
                padding: 8px 35px 8px 10px;
                background: rgba(74, 158, 255, 0.1);
                border-bottom: 1px solid #333;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
            }

            .drop-log-npc-remove {
                position: absolute;
                top: 50%;
                right: 8px;
                transform: translateY(-50%);
                transform-origin: center;
                background: #dc3545;
                color: white;
                border: none;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                z-index: 10;
                transition: background-color 0.2s ease, transform 0.2s ease;
            }

            .drop-log-npc-remove:hover {
                background: #c82333;
                transform: translateY(-50%) scale(1.1);
            }

            .npc-name {
                font-weight: bold;
                color: #4a9eff;
                font-size: 14px;
            }

            .kill-count {
                color: #ffd700;
                font-size: 12px;
            }

            .drop-log-drops {
                padding: 8px;
            }

            .drop-log-drop-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 6px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .drop-log-drop-item:last-child {
                border-bottom: none;
            }

            .drop-log-item-sprite {
                background-position: 0rem 0rem;
                background-repeat: no-repeat;
                background-size: var(--hs-url-inventory-items-width) var(--hs-url-inventory-items-height);
                background-image: var(--hs-url-inventory-items);
                height: var(--hs-inventory-item-size);
                width: var(--hs-inventory-item-size);
                border: 1px solid #555;
                border-radius: 3px;
                flex-shrink: 0;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
            }

            .drop-log-item-info {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-width: 0;
                word-wrap: break-word;
            }

            .item-name {
                color: #fff;
                font-size: 13px;
                font-weight: bold;
            }

            .item-quantity {
                color: #aaa;
                font-size: 11px;
            }

            .drop-log-no-drops, .drop-log-empty {
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 20px;
            }
        `;
        document.head.appendChild(style);
    }

    private injectSpriteStyles(): void {
        if (!this.panelContent) return;

        try {
            const screenMask = document.getElementById('hs-screen-mask');
            if (!screenMask) return;

            const computedStyle = getComputedStyle(screenMask);
            const cssVariables = [
                '--hs-url-inventory-items',
                '--hs-url-inventory-items-outline',
                '--hs-url-inventory-items-width',
                '--hs-url-inventory-items-height',
                '--hs-inventory-item-size',
                '--hs-url-icons',
            ];

            let styleString = '';
            cssVariables.forEach((variable) => {
                const value = computedStyle.getPropertyValue(variable);
                if (value) {
                    styleString += `${variable}: ${value}; `;
                }
            });

            if (styleString) {
                this.panelContent.style.cssText += styleString;
            }
        } catch (error) {
            console.error('Error injecting sprite styles', error);
        }
    }

    private initializePlugin(): void {
        this.createPanel();
        if (!document.querySelector('style[data-drop-log]')) {
            this.addCSSStyles();
        }
        this.injectSpriteStyles();
    }

    private disablePlugin(): void {
        for (const entityId of this.npcHealthTrackers.keys()) {
            this.cleanupHealthTracker(entityId);
        }

        this.attackedNPCs.clear();
        this.npcDataCache.clear();
        this.npcHealthTrackers.clear();
        this.pendingDeaths.clear();
        this.lastGroundItems.clear();
        this.groundItemTimestamps.clear();
        this.processedDeaths.clear();
    }

    SocketManager_loggedIn(): void {
        this.isLoggedIn = true;
        if (!this.settings.enabled?.value) return;

        this.log('Logged in, loading drop data from database...');
        this.loadFromDatabase();
        if (this.panelContent) {
            this.updatePanelContent();
        }
    }

    SocketManager_handleLoggedOut(): void {
        this.isLoggedIn = false;

        for (const entityId of this.npcHealthTrackers.keys()) {
            this.cleanupHealthTracker(entityId);
        }

        this.attackedNPCs.clear();
        this.npcDataCache.clear();
        this.npcHealthTrackers.clear();
        this.pendingDeaths.clear();
        this.lastGroundItems.clear();
        this.groundItemTimestamps.clear();
        this.processedDeaths.clear();

        if (this.panelContent) {
            this.updatePanelContent();
        }
    }

    stop(): void {
        try {
            this.panelManager.removeMenuItem('📋');
        } catch (error) {}

        const style = document.querySelector('style[data-drop-log]');
        if (style) {
            style.remove();
        }
    }
}
