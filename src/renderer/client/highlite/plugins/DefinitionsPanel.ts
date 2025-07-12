import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { PanelManager } from '../core/managers/highlite/panelManager';
import {
    getEquipmentTypeName,
    getSkillName,
} from '../core/utilities/lookupUtils';

export class DefinitionsPanel extends Plugin {
    pluginName = 'Definitions Panel';
    author = 'Highlite';
    panelManager: PanelManager = new PanelManager();
    panelContent: HTMLElement | null = null;
    itemListContainer: HTMLDivElement | null = null;
    searchInput: HTMLInputElement | null = null;
    allItems: any[] = [];
    filteredItems: any[] = [];
    allNpcs: any[] = [];
    filteredNpcs: any[] = [];
    currentPage: number = 0;
    itemsPerPage: number = 50;
    selectedItemId: number | null = null;
    private itemsLoaded: boolean = false;
    private npcsLoaded: boolean = false;
    private modalOverlay: HTMLDivElement | null = null;
    private isLoggedIn: boolean = false;
    private currentView: 'items' | 'npcs' = 'items';
    private itemToggle: HTMLButtonElement | null = null;
    private npcToggle: HTMLButtonElement | null = null;
    private lootData: any = null;
    private spriteReferences: Map<string, number> = new Map(); // Track sprite URL usage count
    private spriteContexts: Map<string, Set<string>> = new Map(); // Track which contexts use each URL
    private activeSpriteUrls: Set<string> = new Set(); // Track URLs we've created

    init(): void {
        this.log('Definitions Panel initialized');

        // Add global reference for button onclick handlers
        (window as any).highliteItemPanel = this;
    }

    start(): void {
        this.log('Definitions Panel started');
        if (!this.settings.enable.value) {
            return;
        }

        // Create the panel
        this.createPanel();

        // Add CSS styles
        this.addStyles();
    }

    SocketManager_loggedIn(): void {
        // Mark as logged in
        this.isLoggedIn = true;

        // Inject styles into panel content only
        this.injectSpriteStyles(this.panelContent);

        // Load items and NPCs
        this.loadAllItems();
        this.loadAllNpcs();
        this.loadLootData();
    }

    SocketManager_handleLoggedOut(): void {
        // Mark as logged out
        this.isLoggedIn = false;

        // Close any open modal
        this.closeModal();

        // Clean up all sprite references
        this.cleanupAllSprites();

        // Reset loaded states
        this.itemsLoaded = false;
        this.npcsLoaded = false;

        // Clear data arrays
        this.allItems = [];
        this.filteredItems = [];
        this.allNpcs = [];
        this.filteredNpcs = [];
        this.lootData = null;

        // Reset pagination
        this.currentPage = 0;

        // Show loading state
        this.showLoadingState();

        // Update stats
        this.updateStats();
    }

    private createPanel(): void {
        try {
            // Request panel menu item
            const panelItems = this.panelManager.requestMenuItem(
                '📦',
                'Definitions'
            );
            if (!panelItems) {
                this.error('Failed to create Definition panel menu item');
                return;
            }

            // Get the panel content area
            this.panelContent = panelItems[1] as HTMLElement;

            // Set up the panel
            this.panelContent.className = 'item-definition-panel';
            this.panelContent.style.width = '100%';
            this.panelContent.style.height = '100%';
            this.panelContent.style.display = 'flex';
            this.panelContent.style.flexDirection = 'column';

            // Build the panel content
            this.buildPanelContent();
        } catch (error) {
            this.error(`Failed to create panel: ${error}`);
        }
    }

    private buildPanelContent(): void {
        if (!this.panelContent) return;

        this.panelContent.innerHTML = '';

        // Create header with toggle
        const header = document.createElement('div');
        header.className = 'item-panel-header';

        const titleSection = document.createElement('div');
        titleSection.className = 'header-title-section';
        titleSection.innerHTML = '<h3>Definitions</h3>';
        header.appendChild(titleSection);

        // Create toggle buttons
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'view-toggle-container';

        this.itemToggle = document.createElement('button');
        this.itemToggle.className = 'view-toggle-button active';
        this.itemToggle.textContent = 'Items';
        this.itemToggle.onclick = () => this.switchView('items');

        this.npcToggle = document.createElement('button');
        this.npcToggle.className = 'view-toggle-button';
        this.npcToggle.textContent = 'NPCs';
        this.npcToggle.onclick = () => this.switchView('npcs');

        toggleContainer.appendChild(this.itemToggle);
        toggleContainer.appendChild(this.npcToggle);
        header.appendChild(toggleContainer);

        // Stats section
        const statsSection = document.createElement('div');
        statsSection.className = 'item-panel-stats';
        statsSection.innerHTML = `
            <span>Total <span class="stat-type">Items</span>: <span id="total-items">0</span></span>
            <span>Showing: <span id="showing-items">0</span></span>
        `;
        header.appendChild(statsSection);

        this.panelContent.appendChild(header);

        // Create search bar
        const searchContainer = document.createElement('div');
        searchContainer.className = 'item-panel-search-container';
        this.panelContent.appendChild(searchContainer);

        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 'item-panel-search';
        this.searchInput.placeholder = 'Search items by name or ID...';
        this.searchInput.oninput = () => this.filterCurrent();
        searchContainer.appendChild(this.searchInput);

        // Create item list container wrapper
        const listWrapper = document.createElement('div');
        listWrapper.className = 'item-panel-list-wrapper';
        this.panelContent.appendChild(listWrapper);

        this.itemListContainer = document.createElement('div');
        this.itemListContainer.className = 'item-list-container';
        listWrapper.appendChild(this.itemListContainer);

        // Create pagination
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        listWrapper.appendChild(paginationContainer);

        // Show loading state initially
        this.showLoadingState();
    }

    private switchView(view: 'items' | 'npcs'): void {
        // Clean up sprites from previous view
        this.cleanupSidebarSprites();

        this.currentView = view;
        this.currentPage = 0;

        // Update toggle buttons
        if (this.itemToggle && this.npcToggle) {
            if (view === 'items') {
                this.itemToggle.classList.add('active');
                this.npcToggle.classList.remove('active');
            } else {
                this.itemToggle.classList.remove('active');
                this.npcToggle.classList.add('active');
            }
        }

        // Update search placeholder
        if (this.searchInput) {
            this.searchInput.placeholder =
                view === 'items'
                    ? 'Search items by name or ID...'
                    : 'Search NPCs by name or ID...';
            this.searchInput.value = '';
        }

        // Update stats label
        const statType = document.querySelector('.stat-type');
        if (statType) {
            statType.textContent = view === 'items' ? 'Items' : 'NPCs';
        }

        // Re-render the list
        this.filterCurrent();
    }

    private filterCurrent(): void {
        if (this.currentView === 'items') {
            this.filterItems();
        } else {
            this.filterNpcs();
        }
    }

    private injectSpriteStyles(element: HTMLElement | null): void {
        if (!element) return;

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
                '--hs-url-small-creature1',
                '--hs-url-medium-creature1',
                '--hs-url-large-creature1',
                '--hs-url-largest-creature1',
            ];

            let styleString = '';
            cssVariables.forEach(variable => {
                const value = computedStyle.getPropertyValue(variable);
                if (value) {
                    styleString += `${variable}: ${value}; `;
                }
            });

            if (styleString) {
                element.style.cssText += styleString;
            }
        } catch (error) {
            this.error(`Error injecting sprite styles: ${error}`);
        }
    }

    private loadAllItems(): void {
        if (this.itemsLoaded) return; // Already loaded

        try {
            const itemDefMap =
                document.highlite?.gameHooks?.ItemDefMap?.ItemDefMap;
            if (!itemDefMap) {
                this.error('ItemDefMap not found');
                return;
            }

            this.allItems = [];
            itemDefMap.forEach((itemDef: any) => {
                if (itemDef) {
                    this.allItems.push(itemDef);
                }
            });

            this.allItems.sort((a, b) => a._id - b._id);
            this.filteredItems = [...this.allItems];

            // Mark as loaded
            this.itemsLoaded = true;

            // Update stats if items view is active
            if (this.currentView === 'items') {
                this.updateStats();
                this.renderItemList();
            }

            this.log(`Loaded ${this.allItems.length} items`);
        } catch (error) {
            this.error(`Failed to load items: ${error}`);
        }
    }

    private loadAllNpcs(): void {
        if (this.npcsLoaded) return; // Already loaded

        try {
            const npcDefMap =
                document.highlite?.gameHooks?.NpcDefinitionManager?._npcDefMap;
            if (!npcDefMap) {
                this.error('NpcDefMap not found');
                return;
            }

            this.allNpcs = [];
            npcDefMap.forEach((npcDef: any) => {
                if (npcDef) {
                    this.allNpcs.push(npcDef);
                }
            });

            this.allNpcs.sort((a, b) => a._id - b._id);
            this.filteredNpcs = [...this.allNpcs];

            // Mark as loaded
            this.npcsLoaded = true;

            // Update stats if NPCs view is active
            if (this.currentView === 'npcs') {
                this.updateStats();
                this.renderNpcList();
            }

            this.log(`Loaded ${this.allNpcs.length} NPCs`);
        } catch (error) {
            this.error(`Failed to load NPCs: ${error}`);
        }
    }

    private async loadLootData(): Promise<void> {
        try {
            this.log('Loading loot data...');
            const response = await fetch(
                'https://highspell.com:8887/static/npcloot.16.carbon'
            );
            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`
                );
            }
            this.lootData = await response.json();
            this.log('Loot data loaded successfully');
        } catch (error) {
            this.error(`Error loading loot data: ${error}`);
        }
    }

    private generateDropsSection(lootTableId: number, npcName: string): string {
        if (!this.lootData) {
            return `
                <div class="detail-section">
                    <h3>Drops</h3>
                    <p class="detail-note">Loot Table ID: ${lootTableId} (Loot data not loaded)</p>
                </div>
            `;
        }

        // Find the NPC's loot table
        const npcLootTable = this.lootData.npcLootTables?.find(
            (table: any) => table._id === lootTableId
        );

        if (!npcLootTable) {
            return `
                <div class="detail-section">
                    <h3>Drops</h3>
                    <p class="detail-note">Loot Table ID: ${lootTableId} (No loot data found)</p>
                </div>
            `;
        }

        let html = `
            <div class="detail-section">
                <h3>Drops</h3>
                <p class="detail-note">Loot Table ID: ${lootTableId}</p>
                <div class="drops-section-container">
        `;

        // Base Loot (always drops)
        if (npcLootTable.baseLoot && npcLootTable.baseLoot.length > 0) {
            html += `
                <div class="loot-subsection">
                    <h4>Guaranteed Drops</h4>
                    <div class="loot-grid">
            `;

            npcLootTable.baseLoot.forEach((item: any) => {
                html += this.generateLootItemHtml(item, '100%');
            });

            html += `
                    </div>
                </div>
            `;
        }

        // Regular Loot (chance-based)
        if (npcLootTable.loot && npcLootTable.loot.length > 0) {
            html += `
                <div class="loot-subsection">
                    <h4>Possible Drops</h4>
                    <div class="loot-grid">
            `;

            // Sort by odds (highest first)
            const sortedLoot = [...npcLootTable.loot].sort(
                (a, b) => (b.odds || 0) - (a.odds || 0)
            );

            sortedLoot.forEach((item: any) => {
                const percentage = item.odds
                    ? `${(item.odds * 100).toFixed(2)}%`
                    : 'Unknown';
                html += this.generateLootItemHtml(item, percentage);
            });

            html += `
                    </div>
                </div>
            `;
        }

        // Rare Loot Table
        if (
            npcLootTable.rareLootProbability &&
            npcLootTable.rareLootProbability > 0 &&
            this.lootData.rareLootTable
        ) {
            html += `
                <div class="loot-subsection">
                    <h4>Rare Drops (${(npcLootTable.rareLootProbability * 100).toFixed(2)}% chance to roll)</h4>
                    <div class="loot-grid">
            `;

            if (this.lootData.rareLootTable.loot) {
                const sortedRareLoot = [
                    ...this.lootData.rareLootTable.loot,
                ].sort((a, b) => (b.odds || 0) - (a.odds || 0));

                sortedRareLoot.forEach((item: any) => {
                    const basePercentage = item.odds ? item.odds * 100 : 0;
                    const actualPercentage =
                        basePercentage * npcLootTable.rareLootProbability;
                    const percentage = `${actualPercentage.toFixed(4)}%`;
                    html += this.generateLootItemHtml(item, percentage, true);
                });
            }

            html += `
                    </div>
                </div>
            `;
        }

        // Root Loot
        if (npcLootTable.rootLoot && this.lootData.rootLootTables) {
            const rootTable = this.lootData.rootLootTables.find(
                (table: any) => table._id === npcLootTable.rootLoot.tableId
            );
            if (rootTable) {
                html += `
                    <div class="loot-subsection">
                        <h4>Root Drops (${(npcLootTable.rootLoot.probability * 100).toFixed(2)}% chance to roll)</h4>
                        <p class="detail-note">${rootTable.desc || 'Root loot table'}</p>
                        <div class="loot-grid">
                `;

                if (rootTable.loot) {
                    const sortedRootLoot = [...rootTable.loot].sort(
                        (a, b) => (b.odds || 0) - (a.odds || 0)
                    );

                    sortedRootLoot.forEach((item: any) => {
                        const basePercentage = item.odds ? item.odds * 100 : 0;
                        const actualPercentage =
                            basePercentage * npcLootTable.rootLoot.probability;
                        const percentage = `${actualPercentage.toFixed(4)}%`;
                        html += this.generateLootItemHtml(
                            item,
                            percentage,
                            false,
                            true
                        );
                    });
                }

                html += `
                        </div>
                    </div>
                `;
            }
        }

        // Treasure Map
        if (npcLootTable.treasureMap) {
            html += `
                <div class="loot-subsection">
                    <h4>Treasure Map</h4>
                    <div class="loot-special">
                        <span class="treasure-map-info">
                            Level ${npcLootTable.treasureMap.level} Treasure Map - ${(npcLootTable.treasureMap.odds * 100).toFixed(4)}% chance
                        </span>
                    </div>
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

    private generateLootItemHtml(
        item: any,
        percentage: string,
        isRare: boolean = false,
        isRoot: boolean = false
    ): string {
        try {
            const itemDef =
                document.highlite?.gameHooks?.ItemDefMap?.ItemDefMap?.get(
                    item.itemId
                );
            const itemName =
                itemDef?._nameCapitalized ||
                itemDef?._name ||
                item.name ||
                `Item ${item.itemId}`;
            const itemPos =
                document.highlite?.gameHooks?.InventoryItemSpriteManager?.getCSSBackgroundPositionForItem(
                    item.itemId
                );
            const spriteStyle = itemPos
                ? `style="background-position: ${itemPos};"`
                : '';

            let cssClass = 'loot-item';
            if (isRare) cssClass += ' rare-loot';
            if (isRoot) cssClass += ' root-loot';
            if (item.isIOU) cssClass += ' iou-item';

            const amountText = item.amount > 1 ? `${item.amount}x` : '';
            const iouText = item.isIOU ? ' (IOU)' : '';

            return `
                <div class="${cssClass}" data-item-id="${item.itemId}">
                    <div class="loot-item-sprite" ${spriteStyle}></div>
                    <div class="loot-item-info">
                        <div class="loot-item-name">${itemName}</div>
                        <div class="loot-item-amount">${amountText}${iouText}</div>
                        <div class="loot-item-odds">${percentage}</div>
                    </div>
                </div>
            `;
        } catch (error) {
            return `
                <div class="loot-item" data-item-id="${item.itemId}">
                    <div class="loot-item-sprite"></div>
                    <div class="loot-item-info">
                        <div class="loot-item-name">${item.name || `Item ${item.itemId}`}</div>
                        <div class="loot-item-amount">${item.amount > 1 ? `${item.amount}x` : ''}${item.isIOU ? ' (IOU)' : ''}</div>
                        <div class="loot-item-odds">${percentage}</div>
                    </div>
                </div>
            `;
        }
    }

    private generateNpcDropsSection(itemId: number): string {
        if (!this.lootData || !this.allNpcs || this.allNpcs.length === 0) {
            return '';
        }

        const droppingNpcs: Array<{
            npc: any;
            dropInfo: {
                type: 'base' | 'regular' | 'rare' | 'root';
                percentage: string;
                amount: number;
                isIOU: boolean;
            }[];
        }> = [];

        // Check each NPC for drops of this item
        this.allNpcs.forEach(npc => {
            if (
                !npc._combat ||
                !npc._combat._lootTableId ||
                npc._combat._lootTableId === -1
            ) {
                return;
            }

            const npcLootTable = this.lootData.npcLootTables?.find(
                (table: any) => table._id === npc._combat._lootTableId
            );
            if (!npcLootTable) {
                return;
            }

            const dropInfo: any[] = [];

            // Check base loot (guaranteed drops)
            if (npcLootTable.baseLoot) {
                npcLootTable.baseLoot.forEach((item: any) => {
                    if (item.itemId === itemId) {
                        dropInfo.push({
                            type: 'base',
                            percentage: '100%',
                            amount: item.amount || 1,
                            isIOU: item.isIOU || false,
                        });
                    }
                });
            }

            // Check regular loot
            if (npcLootTable.loot) {
                npcLootTable.loot.forEach((item: any) => {
                    if (item.itemId === itemId) {
                        const percentage = item.odds
                            ? `${(item.odds * 100).toFixed(2)}%`
                            : 'Unknown';
                        dropInfo.push({
                            type: 'regular',
                            percentage,
                            amount: item.amount || 1,
                            isIOU: item.isIOU || false,
                        });
                    }
                });
            }

            // Check rare loot
            if (
                npcLootTable.rareLootProbability &&
                npcLootTable.rareLootProbability > 0 &&
                this.lootData.rareLootTable?.loot
            ) {
                this.lootData.rareLootTable.loot.forEach((item: any) => {
                    if (item.itemId === itemId) {
                        const basePercentage = item.odds ? item.odds * 100 : 0;
                        const actualPercentage =
                            basePercentage * npcLootTable.rareLootProbability;
                        dropInfo.push({
                            type: 'rare',
                            percentage: `${actualPercentage.toFixed(4)}%`,
                            amount: item.amount || 1,
                            isIOU: item.isIOU || false,
                        });
                    }
                });
            }

            // Check root loot
            if (npcLootTable.rootLoot && this.lootData.rootLootTables) {
                const rootTable = this.lootData.rootLootTables.find(
                    (table: any) => table._id === npcLootTable.rootLoot.tableId
                );
                if (rootTable?.loot) {
                    rootTable.loot.forEach((item: any) => {
                        if (item.itemId === itemId) {
                            const basePercentage = item.odds
                                ? item.odds * 100
                                : 0;
                            const actualPercentage =
                                basePercentage *
                                npcLootTable.rootLoot.probability;
                            dropInfo.push({
                                type: 'root',
                                percentage: `${actualPercentage.toFixed(4)}%`,
                                amount: item.amount || 1,
                                isIOU: item.isIOU || false,
                            });
                        }
                    });
                }
            }

            if (dropInfo.length > 0) {
                droppingNpcs.push({ npc, dropInfo });
            }
        });

        if (droppingNpcs.length === 0) {
            return '';
        }

        // Sort NPCs by best drop rate (highest percentage first)
        droppingNpcs.sort((a, b) => {
            const getBestRate = (drops: any[]) => {
                return Math.max(
                    ...drops.map(drop => {
                        if (drop.percentage === '100%') return 100;
                        return (
                            parseFloat(drop.percentage.replace('%', '')) || 0
                        );
                    })
                );
            };
            return getBestRate(b.dropInfo) - getBestRate(a.dropInfo);
        });

        // Return HTML structure only - sprites will be created after DOM insertion
        let html = `
            <div class="detail-section" id="npc-drops-section">
                <h3>Dropped By</h3>
                <p class="detail-note">NPCs that drop this item (${droppingNpcs.length} found)</p>
                <div class="npc-drops-container" id="npc-drops-container">
        `;

        droppingNpcs.forEach(({ npc, dropInfo }) => {
            const combatLevel = npc._combat?._combat?._combatLevel || '?';

            html += `
                <div class="npc-drop-item" data-npc-id="${npc._id}">
                    <div class="npc-drop-sprite-wrapper">
                        <div class="npc-drop-sprite" data-npc-sprite="${npc._id}"></div>
                        <div class="npc-drop-level-badge">${combatLevel}</div>
                    </div>
                    <div class="npc-drop-info">
                        <div class="npc-drop-name">${npc._nameCapitalized || npc._name || `NPC ${npc._id}`}</div>
                        <div class="npc-drop-details">
            `;

            // Show all drop types for this NPC
            dropInfo.forEach((drop, index) => {
                let typeLabel = '';
                let typeClass = '';
                switch (drop.type) {
                    case 'base':
                        typeLabel = 'Guaranteed';
                        typeClass = 'guaranteed';
                        break;
                    case 'regular':
                        typeLabel = 'Regular';
                        typeClass = 'regular';
                        break;
                    case 'rare':
                        typeLabel = 'Rare';
                        typeClass = 'rare';
                        break;
                    case 'root':
                        typeLabel = 'Root';
                        typeClass = 'root';
                        break;
                }

                const amountText = drop.amount > 1 ? `${drop.amount}x ` : '';
                const iouText = drop.isIOU ? ' (IOU)' : '';

                html += `
                    <div class="npc-drop-type ${typeClass}">
                        ${typeLabel}: ${amountText}${drop.percentage}${iouText}
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    private createNpcDropSprites(container: HTMLElement): void {
        if (!this.lootData || !this.allNpcs) return;

        const npcSpriteElements =
            container.querySelectorAll('[data-npc-sprite]');

        npcSpriteElements.forEach(spriteElement => {
            const npcId = parseInt(
                spriteElement.getAttribute('data-npc-sprite') || '0'
            );
            const npc = this.allNpcs.find(n => n._id === npcId);

            if (!npc) return;

            const typeInfo = this.getNpcTypeInfo(npc);

            if (typeInfo.isCreature && typeInfo.creatureType !== undefined) {
                // Creature NPCs - use scaled approach for drops
                const creatureType = typeInfo.creatureType;
                const creatureSpriteId = typeInfo.creatureSpriteId || 0;
                const sizeClass = this.getCreatureSizeClass(creatureType);

                // Set basic sprite properties
                spriteElement.className = `npc-drop-sprite npc-sprite-${sizeClass}`;
                (spriteElement as HTMLElement).dataset.creatureType =
                    creatureType.toString();

                // Create inner sprite content element for scaling
                const spriteContent = document.createElement('div');
                spriteContent.className = 'sprite-content';

                // Get sprite info from SpritesheetManager
                const spritesheetManager =
                    document.highlite?.gameHooks?.SpriteSheetManager?.Instance;
                const creatureSpritesheetInfo =
                    spritesheetManager?.CreatureSpritesheetInfo;

                if (
                    creatureSpritesheetInfo &&
                    creatureSpritesheetInfo[creatureType]
                ) {
                    const sheetIndex = 0;
                    const spriteInfo =
                        creatureSpritesheetInfo[creatureType][sheetIndex];

                    if (spriteInfo) {
                        // Set background from sprite info on the content element
                        spriteContent.style.backgroundImage = `url('${spriteInfo.SpritesheetURL}')`;
                        spriteContent.style.backgroundSize = 'auto';
                        spriteContent.style.backgroundRepeat = 'no-repeat';
                        spriteContent.style.imageRendering = 'pixelated';

                        // Calculate sprite position
                        const spriteFrameIndex = 15 * creatureSpriteId;
                        const spritePos = this.calculateSpritePositionFromId(
                            spriteFrameIndex,
                            creatureType
                        );
                        spriteContent.style.backgroundPosition = `-${spritePos.x}px -${spritePos.y}px`;

                        // Track sprite usage
                        (spriteElement as HTMLElement).setAttribute(
                            'data-sprite-modal',
                            'true'
                        );
                        this.trackSpriteUsage(
                            spriteElement as HTMLElement,
                            spriteInfo.SpritesheetURL,
                            'modal'
                        );
                    } else {
                        // Fallback to CSS approach
                        const spriteFrameIndex = 15 * creatureSpriteId;
                        const spritePos = this.calculateSpritePositionFromId(
                            spriteFrameIndex,
                            creatureType
                        );
                        spriteContent.style.backgroundPosition = `-${spritePos.x}px -${spritePos.y}px`;
                        spriteContent.style.backgroundRepeat = 'no-repeat';
                        spriteContent.style.imageRendering = 'pixelated';
                    }
                } else {
                    // Fallback to CSS approach
                    const spriteFrameIndex = 15 * creatureSpriteId;
                    const spritePos = this.calculateSpritePositionFromId(
                        spriteFrameIndex,
                        creatureType
                    );
                    spriteContent.style.backgroundPosition = `-${spritePos.x}px -${spritePos.y}px`;
                    spriteContent.style.backgroundRepeat = 'no-repeat';
                    spriteContent.style.imageRendering = 'pixelated';
                }

                // Clear any existing content and add the sprite content
                spriteElement.innerHTML = '';
                spriteElement.appendChild(spriteContent);
            } else if (typeInfo.isHuman) {
                // Human NPCs
                spriteElement.className = 'npc-drop-sprite npc-sprite-human';
                (spriteElement as HTMLElement).dataset.npcId =
                    npc._id.toString();

                // Try to access cached human sprite from SpritesheetManager
                const spritesheetManager =
                    document.highlite.gameHooks.SpriteSheetManager.Instance;
                const humanSpriteInfo =
                    spritesheetManager?.HumanNPCSpritesheetInfo?.get(npc._id);

                if (humanSpriteInfo && humanSpriteInfo.SpritesheetURL) {
                    // Use existing sprite URL
                    (spriteElement as HTMLElement).style.backgroundImage =
                        `url('${humanSpriteInfo.SpritesheetURL}')`;
                    (spriteElement as HTMLElement).style.backgroundPosition =
                        '-71px 0px';
                    (spriteElement as HTMLElement).style.backgroundSize =
                        'auto';

                    // Track sprite usage
                    (spriteElement as HTMLElement).setAttribute(
                        'data-sprite-modal',
                        'true'
                    );
                    this.trackSpriteUsage(
                        spriteElement as HTMLElement,
                        humanSpriteInfo.SpritesheetURL,
                        'modal'
                    );
                } else {
                    // No cached sprite, show placeholder initially
                    spriteElement.innerHTML = '👤';
                    (spriteElement as HTMLElement).style.backgroundColor =
                        '#f0f0f0';
                    (spriteElement as HTMLElement).style.display = 'flex';
                    (spriteElement as HTMLElement).style.alignItems = 'center';
                    (spriteElement as HTMLElement).style.justifyContent =
                        'center';
                    (spriteElement as HTMLElement).style.fontSize = '20px';
                    (spriteElement as HTMLElement).style.color = '#666';

                    // Request sprite generation through the game's system
                    this.requestHumanSprite(npc);

                    // Poll for the sprite
                    const pollInterval = setInterval(() => {
                        const spriteInfo =
                            spritesheetManager?.HumanNPCSpritesheetInfo?.get(
                                npc._id
                            );
                        if (spriteInfo && spriteInfo.SpritesheetURL) {
                            clearInterval(pollInterval);
                            const targetElement = container.querySelector(
                                `[data-npc-sprite="${npc._id}"]`
                            ) as HTMLElement;
                            if (targetElement) {
                                targetElement.innerHTML = '';
                                targetElement.style.backgroundImage = `url('${spriteInfo.SpritesheetURL}')`;
                                targetElement.style.backgroundPosition =
                                    '-70px 0px';
                                targetElement.style.backgroundSize = 'auto';
                                targetElement.style.backgroundColor =
                                    'transparent';
                                targetElement.setAttribute(
                                    'data-sprite-modal',
                                    'true'
                                );
                                // Track sprite usage
                                this.trackSpriteUsage(
                                    targetElement,
                                    spriteInfo.SpritesheetURL,
                                    'modal'
                                );
                            }
                        }
                    }, 100); // Poll every 100ms

                    // Stop polling after 5 seconds
                    setTimeout(() => clearInterval(pollInterval), 5000);
                }
            } else {
                // Unknown or simple NPCs
                spriteElement.className = 'npc-drop-sprite npc-sprite-unknown';
                spriteElement.innerHTML = '?';
            }
        });
    }

    private getNpcTypeInfo(npc: any): {
        isCreature: boolean;
        isHuman: boolean;
        creatureType?: number;
        creatureSpriteId?: number;
    } {
        // Check if has explicit creature appearance (like Rat)
        if (npc._creatureAppearance) {
            return {
                isCreature: true,
                isHuman: false,
                creatureType: npc._creatureAppearance._creatureType || 0,
                creatureSpriteId:
                    npc._creatureAppearance._creatureSpriteId || 0,
            };
        }

        // Check if this looks like a creature based on _creatureType
        if (
            npc._creatureType !== undefined &&
            npc._creatureType !== null &&
            npc._creatureType !== -1
        ) {
            // This is a creature NPC (creatureType >= 0)
            return {
                isCreature: true,
                isHuman: false,
                creatureType: npc._creatureType,
                creatureSpriteId: 0, // Default sprite ID if not specified
            };
        }

        // If creatureType is -1 (OM.none) or has human appearance, it's human
        if (
            npc._creatureType === -1 ||
            (npc._appearance &&
                (npc._appearance._hairId !== undefined ||
                    npc._appearance._bodyId !== undefined ||
                    npc._appearance._equippedItems))
        ) {
            return { isCreature: false, isHuman: true };
        }

        // Default: unknown
        return { isCreature: false, isHuman: false };
    }

    private updateStats(): void {
        const totalEl = document.getElementById('total-items');
        const showingEl = document.getElementById('showing-items');

        if (this.currentView === 'items') {
            if (totalEl) totalEl.textContent = this.allItems.length.toString();
            if (showingEl)
                showingEl.textContent = this.filteredItems.length.toString();
        } else {
            if (totalEl) totalEl.textContent = this.allNpcs.length.toString();
            if (showingEl)
                showingEl.textContent = this.filteredNpcs.length.toString();
        }
    }

    private filterItems(): void {
        if (!this.searchInput) return;

        const searchTerm = this.searchInput.value.toLowerCase().trim();

        if (!searchTerm) {
            this.filteredItems = [...this.allItems];
        } else {
            this.filteredItems = this.allItems.filter(item => {
                const idMatch = item._id.toString().includes(searchTerm);
                const nameMatch =
                    item._name?.toLowerCase().includes(searchTerm) ||
                    item._nameCapitalized?.toLowerCase().includes(searchTerm);
                return idMatch || nameMatch;
            });
        }

        this.currentPage = 0;
        this.updateStats();
        this.renderItemList();
    }

    private filterNpcs(): void {
        if (!this.searchInput) return;

        const searchTerm = this.searchInput.value.toLowerCase().trim();

        if (!searchTerm) {
            this.filteredNpcs = [...this.allNpcs];
        } else {
            this.filteredNpcs = this.allNpcs.filter(npc => {
                const idMatch = npc._id.toString().includes(searchTerm);
                const nameMatch =
                    npc._name?.toLowerCase().includes(searchTerm) ||
                    npc._nameCapitalized?.toLowerCase().includes(searchTerm);
                return idMatch || nameMatch;
            });
        }

        this.currentPage = 0;
        this.updateStats();
        this.renderNpcList();
    }

    private renderItemList(): void {
        if (!this.itemListContainer) return;

        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = Math.min(
            startIndex + this.itemsPerPage,
            this.filteredItems.length
        );
        const pageItems = this.filteredItems.slice(startIndex, endIndex);

        // Get item IDs that will be displayed in the new render (items don't need sprite preservation like NPCs)
        // Clean up sprites from previous render
        this.cleanupSidebarSprites();

        this.itemListContainer.innerHTML = '';

        pageItems.forEach(item => {
            const itemElement = this.createItemElement(item);
            if (this.itemListContainer) {
                this.itemListContainer.appendChild(itemElement);
            }
        });

        this.updatePagination();

        if (this.filteredItems.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'item-no-results';
            noResults.textContent = this.searchInput?.value
                ? 'No items found'
                : 'No items loaded';
            this.itemListContainer.appendChild(noResults);
        }
    }

    private renderNpcList(): void {
        if (!this.itemListContainer) return;

        // Only clean up sprites if the container is not empty (avoid cleaning during initial load)
        if (this.itemListContainer.children.length > 0) {
            const startIndex = this.currentPage * this.itemsPerPage;
            const endIndex = Math.min(
                startIndex + this.itemsPerPage,
                this.filteredNpcs.length
            );
            const pageNpcs = this.filteredNpcs.slice(startIndex, endIndex);

            // Get NPC IDs that will be displayed in the new render
            const newNpcIds = new Set(pageNpcs.map(npc => npc._id));

            // Clean up sprites from previous render, but preserve ones we'll reuse
            this.cleanupSidebarSprites(newNpcIds);
        }

        this.itemListContainer.innerHTML = '';

        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = Math.min(
            startIndex + this.itemsPerPage,
            this.filteredNpcs.length
        );
        const pageNpcs = this.filteredNpcs.slice(startIndex, endIndex);

        pageNpcs.forEach(npc => {
            const npcElement = this.createNpcElement(npc);
            if (this.itemListContainer) {
                this.itemListContainer.appendChild(npcElement);
            }
        });

        this.updatePagination();

        if (this.filteredNpcs.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'item-no-results';
            noResults.textContent = this.searchInput?.value
                ? 'No NPCs found'
                : 'No NPCs loaded';
            this.itemListContainer.appendChild(noResults);
        }
    }

    private createItemElement(item: any): HTMLDivElement {
        const itemEl = document.createElement('div');
        itemEl.className = 'item-list-item';
        itemEl.dataset.itemId = item._id.toString();

        // Item sprite
        const sprite = document.createElement('div');
        sprite.className = 'item-sprite';
        try {
            const pos =
                document.highlite?.gameHooks?.InventoryItemSpriteManager?.getCSSBackgroundPositionForItem(
                    parseInt(item._id.toString())
                );
            if (pos) {
                sprite.style.backgroundPosition = pos;
            }
        } catch (error) {
            // Silent fail, CSS will use default position
        }
        itemEl.appendChild(sprite);

        // Item info
        const info = document.createElement('div');
        info.className = 'item-info';

        const name = document.createElement('div');
        name.className = 'item-name';
        name.textContent =
            item._nameCapitalized || item._name || `Item ${item._id}`;
        info.appendChild(name);

        const id = document.createElement('div');
        id.className = 'item-id';
        id.textContent = `ID: ${item._id}`;
        info.appendChild(id);

        itemEl.appendChild(info);

        itemEl.onclick = () => {
            this.showItemModal(item._id);
        };

        return itemEl;
    }

    private createNpcElement(npc: any): HTMLDivElement {
        const npcEl = document.createElement('div');
        npcEl.className = 'item-list-item npc-list-item';
        npcEl.dataset.npcId = npc._id.toString();

        // NPC sprite wrapper (for badge overflow)
        const spriteWrapper = document.createElement('div');
        spriteWrapper.className = 'npc-sprite-wrapper';

        // NPC sprite container
        const spriteContainer = document.createElement('div');
        spriteContainer.className = 'npc-sprite-container';

        // Determine NPC type
        const typeInfo = this.getNpcTypeInfo(npc);

        const sprite = document.createElement('div');

        if (typeInfo.isCreature && typeInfo.creatureType !== undefined) {
            // Creature NPCs
            const creatureType = typeInfo.creatureType;
            const creatureSpriteId = typeInfo.creatureSpriteId || 0;
            const sizeClass = this.getCreatureSizeClass(creatureType);

            // Get sprite info from SpritesheetManager
            const spritesheetManager =
                document.highlite?.gameHooks?.SpriteSheetManager?.Instance;
            const creatureSpritesheetInfo =
                spritesheetManager?.CreatureSpritesheetInfo;

            if (
                creatureSpritesheetInfo &&
                creatureSpritesheetInfo[creatureType]
            ) {
                // Use sprite sheet 0 (first sheet) as default
                const sheetIndex = 0;
                const spriteInfo =
                    creatureSpritesheetInfo[creatureType][sheetIndex];

                if (spriteInfo) {
                    sprite.className = `npc-sprite npc-sprite-${sizeClass}`;
                    sprite.dataset.creatureType = creatureType.toString();

                    // Set sprite dimensions from sprite info
                    sprite.style.width = `${spriteInfo.SpriteWidth}px`;
                    sprite.style.height = `${spriteInfo.SpriteHeight}px`;
                    sprite.style.position = 'absolute';
                    sprite.style.left = '50%';
                    sprite.style.top = '50%';

                    // Scale sprites to fit in container
                    let scale = 1;
                    if (sizeClass === 'medium') scale = 0.7;
                    else if (sizeClass === 'large') scale = 0.5;
                    else if (sizeClass === 'largest') scale = 0.35;

                    sprite.style.transform = `translate(-50%, -50%) scale(${scale})`;

                    // Set background from sprite info
                    sprite.style.backgroundImage = `url('${spriteInfo.SpritesheetURL}')`;
                    sprite.style.backgroundSize = 'auto';

                    // Based on createNPCFromPacketData, the game uses: 15 * CreatureSpriteID
                    const spriteFrameIndex = 15 * creatureSpriteId;
                    const spritePos = this.calculateSpritePositionFromId(
                        spriteFrameIndex,
                        creatureType
                    );
                    sprite.style.backgroundPosition = `-${spritePos.x}px -${spritePos.y}px`;

                    // Track sprite usage
                    sprite.setAttribute('data-sprite-sidebar', 'true');
                    setTimeout(
                        () =>
                            this.trackSpriteUsage(
                                sprite,
                                spriteInfo.SpritesheetURL,
                                'sidebar'
                            ),
                        0
                    );
                } else {
                    // Fallback to CSS approach if sprite info not available
                    sprite.className = `npc-sprite npc-sprite-${sizeClass}`;
                    sprite.dataset.creatureType = creatureType.toString();
                    const spriteInfo = this.getCreatureSpriteInfo(creatureType);
                    sprite.style.width = `${spriteInfo.spriteWidth}px`;
                    sprite.style.height = `${spriteInfo.spriteHeight}px`;
                    sprite.style.position = 'absolute';
                    sprite.style.left = '50%';
                    sprite.style.top = '50%';
                    let scale = 1;
                    if (sizeClass === 'medium') scale = 0.7;
                    else if (sizeClass === 'large') scale = 0.5;
                    else if (sizeClass === 'largest') scale = 0.35;
                    sprite.style.transform = `translate(-50%, -50%) scale(${scale})`;
                    const spriteFrameIndex = 15 * creatureSpriteId;
                    const spritePos = this.calculateSpritePositionFromId(
                        spriteFrameIndex,
                        creatureType
                    );
                    sprite.style.backgroundPosition = `-${spritePos.x}px -${spritePos.y}px`;
                }
            } else {
                // Fallback to CSS approach if SpritesheetManager not available
                sprite.className = `npc-sprite npc-sprite-${sizeClass}`;
                sprite.dataset.creatureType = creatureType.toString();
                const spriteInfo = this.getCreatureSpriteInfo(creatureType);
                sprite.style.width = `${spriteInfo.spriteWidth}px`;
                sprite.style.height = `${spriteInfo.spriteHeight}px`;
                sprite.style.position = 'absolute';
                sprite.style.left = '50%';
                sprite.style.top = '50%';
                let scale = 1;
                if (sizeClass === 'medium') scale = 0.7;
                else if (sizeClass === 'large') scale = 0.5;
                else if (sizeClass === 'largest') scale = 0.35;
                sprite.style.transform = `translate(-50%, -50%) scale(${scale})`;
                const spriteFrameIndex = 15 * creatureSpriteId;
                const spritePos = this.calculateSpritePositionFromId(
                    spriteFrameIndex,
                    creatureType
                );
                sprite.style.backgroundPosition = `-${spritePos.x}px -${spritePos.y}px`;
            }
        } else if (typeInfo.isHuman) {
            // Human NPCs with customizable appearance
            sprite.className = 'npc-sprite npc-sprite-human';
            sprite.dataset.npcId = npc._id.toString();

            // Human sprites are 64x128
            sprite.style.width = '64px';
            sprite.style.height = '128px';
            sprite.style.position = 'absolute';
            sprite.style.left = '50%';
            sprite.style.top = '50%';
            sprite.style.transform = 'translate(-50%, -50%) scale(0.7)'; // Scale down to fit better

            // Try to access cached human sprite from SpritesheetManager
            const spritesheetManager =
                document.highlite.gameHooks.SpriteSheetManager.Instance;
            const humanSpriteInfo =
                spritesheetManager?.HumanNPCSpritesheetInfo?.get(npc._id);

            if (humanSpriteInfo && humanSpriteInfo.SpritesheetURL) {
                // Use existing sprite URL
                sprite.style.backgroundImage = `url('${humanSpriteInfo.SpritesheetURL}')`;
                // Human sprites are 64x128, facing south (direction offset 1)
                // Adjust Y position to show head area (positive Y moves down)
                sprite.style.backgroundPosition = '-65px 25px';
                sprite.style.backgroundSize = 'auto';

                // Track sprite usage
                sprite.setAttribute('data-sprite-sidebar', 'true');
                setTimeout(
                    () =>
                        this.trackSpriteUsage(
                            sprite,
                            humanSpriteInfo.SpritesheetURL,
                            'sidebar'
                        ),
                    0
                );
            } else {
                // No cached sprite, show placeholder initially
                sprite.innerHTML = '👤';
                sprite.style.backgroundColor = '#f0f0f0';
                sprite.style.display = 'flex';
                sprite.style.alignItems = 'center';
                sprite.style.justifyContent = 'center';
                sprite.style.fontSize = '24px';

                // Request sprite generation through the game's system
                this.requestHumanSprite(npc);

                // Poll for the sprite
                const pollInterval = setInterval(() => {
                    const spriteInfo =
                        spritesheetManager?.HumanNPCSpritesheetInfo?.get(
                            npc._id
                        );
                    if (spriteInfo && spriteInfo.SpritesheetURL) {
                        clearInterval(pollInterval);
                        const spriteElement = document.querySelector(
                            `.npc-sprite-human[data-npc-id="${npc._id}"]`
                        ) as HTMLElement;
                        if (spriteElement) {
                            spriteElement.innerHTML = '';
                            spriteElement.style.backgroundImage = `url('${spriteInfo.SpritesheetURL}')`;
                            spriteElement.style.backgroundPosition =
                                '-64px 25px';
                            spriteElement.style.backgroundSize = 'auto';
                            spriteElement.style.backgroundColor = 'transparent';
                            spriteElement.setAttribute(
                                'data-sprite-sidebar',
                                'true'
                            );
                            // Track sprite usage
                            this.trackSpriteUsage(
                                spriteElement,
                                spriteInfo.SpritesheetURL,
                                'sidebar'
                            );
                        }
                    }
                }, 100); // Poll every 100ms

                // Stop polling after 5 seconds
                setTimeout(() => clearInterval(pollInterval), 5000);
            }
        } else {
            // Unknown or simple NPCs
            sprite.className = 'npc-sprite npc-sprite-unknown';
            sprite.innerHTML = '?';
        }

        // Combat level badge
        if (npc._combat && npc._combat._combat) {
            const levelBadge = document.createElement('div');
            levelBadge.className = 'npc-level-badge';
            levelBadge.textContent = npc._combat._combat._combatLevel || '?';
            spriteWrapper.appendChild(levelBadge);
        }

        spriteContainer.appendChild(sprite);
        spriteWrapper.appendChild(spriteContainer);
        npcEl.appendChild(spriteWrapper);

        // NPC info
        const info = document.createElement('div');
        info.className = 'item-info';

        const name = document.createElement('div');
        name.className = 'item-name';
        name.textContent =
            npc._nameCapitalized || npc._name || `NPC ${npc._id}`;
        info.appendChild(name);

        const details = document.createElement('div');
        details.className = 'item-id';
        details.textContent = `ID: ${npc._id}`;
        if (npc._combat && npc._combat._combat) {
            details.textContent += ` • Level ${npc._combat._combat._combatLevel}`;
        }
        info.appendChild(details);

        npcEl.appendChild(info);

        npcEl.onclick = () => {
            this.showNpcModal(npc._id);
        };

        return npcEl;
    }

    private getCreatureSizeClass(creatureType: number): string {
        // Based on OM enum: small=0, medium=1, large=2, largest=3
        switch (creatureType) {
            case 0:
                return 'small';
            case 1:
                return 'medium';
            case 2:
                return 'large';
            case 3:
                return 'largest';
            default:
                return 'small'; // Default to small if unknown
        }
    }

    private getCreatureSpriteInfo(creatureType: number): {
        sizeClass: string;
        spriteWidth: number;
        spriteHeight: number;
        sheetWidth: number;
        sheetHeight: number;
    } {
        const sizeClass = this.getCreatureSizeClass(creatureType);

        // Based on the game's exact dimensions from sprite sheet info
        // Small creatures: 1920x192, 64x64 sprites, 30 columns, 3 rows
        const spriteDimensions = {
            small: {
                width: 64,
                height: 64,
                sheetWidth: 1920,
                sheetHeight: 192,
            },
            medium: {
                width: 64,
                height: 128,
                sheetWidth: 1920,
                sheetHeight: 512,
            },
            large: {
                width: 128,
                height: 128,
                sheetWidth: 1920,
                sheetHeight: 512,
            },
            largest: {
                width: 256,
                height: 184,
                sheetWidth: 2048,
                sheetHeight: 736,
            },
        };

        const dims =
            spriteDimensions[sizeClass as keyof typeof spriteDimensions];

        return {
            sizeClass,
            spriteWidth: dims.width,
            spriteHeight: dims.height,
            sheetWidth: dims.sheetWidth,
            sheetHeight: dims.sheetHeight,
        };
    }

    private calculateSpritePosition(creatureType: number): {
        x: number;
        y: number;
    } {
        const info = this.getCreatureSpriteInfo(creatureType);

        // Simplified calculation - in the actual game this would use proper sprite mappings
        // For now, just use a simple grid layout
        const spritesPerRow = info.sheetWidth / info.spriteWidth;
        const index = creatureType % 64; // Limit to reasonable range

        const col = index % spritesPerRow;
        const row = Math.floor(index / spritesPerRow);

        return {
            x: col * info.spriteWidth,
            y: row * info.spriteHeight,
        };
    }

    private calculateSpritePositionFromId(
        spriteId: number,
        creatureType: number,
        direction: number = 1
    ): { x: number; y: number } {
        // Based on _getCSSBackgroundPositionForCreatureDirection from the game code
        let spriteWidth = 0;
        let spriteHeight = 0;
        let sheetWidth = 0;

        // Get sprite dimensions based on creature size
        const sizeClass = this.getCreatureSizeClass(creatureType);
        switch (sizeClass) {
            case 'small':
                spriteWidth = 64;
                spriteHeight = 64;
                sheetWidth = 1920;
                break;
            case 'medium':
                spriteWidth = 64;
                spriteHeight = 128;
                sheetWidth = 1920;
                break;
            case 'large':
                spriteWidth = 128;
                spriteHeight = 128;
                sheetWidth = 1920;
                break;
            case 'largest':
                spriteWidth = 256;
                spriteHeight = 184;
                sheetWidth = 2048;
                break;
        }

        // Add direction offset (same as _getExtraSpriteIdOffsetForDirection)
        spriteId += direction; // For south direction, offset is 1

        // Calculate position
        const spritesPerRow = sheetWidth / spriteWidth;
        const row = Math.floor(spriteId / spritesPerRow);
        const col = spriteId % spritesPerRow;

        return {
            x: col * spriteWidth,
            y: row * spriteHeight,
        };
    }

    private requestHumanSprite(npc: any): void {
        try {
            if (!npc._appearance) return;

            const spritesheetManager =
                document.highlite.gameHooks.SpriteSheetManager.Instance;
            if (!spritesheetManager) return;

            // Get access to the game's tk class if available
            const appearanceUtils = document.highlite.gameHooks.AppearanceUtils;

            // Build appearance arrays using the game's format
            const appearanceIds = new Array(5);

            // YP enum values from the game
            const appearanceTypes =
                document.highlite.gameLookups['AppearanceTypes'];

            appearanceIds[appearanceTypes.Hair] =
                appearanceUtils.appearanceIdToAppearanceArray(
                    appearanceTypes.Hair,
                    npc._appearance._hairId ?? 0
                );
            appearanceIds[appearanceTypes.Beard] =
                appearanceUtils.appearanceIdToAppearanceArray(
                    appearanceTypes.Beard,
                    npc._appearance._beardId ?? 0
                );
            appearanceIds[appearanceTypes.Shirt] =
                appearanceUtils.appearanceIdToAppearanceArray(
                    appearanceTypes.Shirt,
                    npc._appearance._shirtId ?? 0
                );
            appearanceIds[appearanceTypes.Body] =
                appearanceUtils.appearanceIdToAppearanceArray(
                    appearanceTypes.Body,
                    npc._appearance._bodyId ?? 0
                );
            appearanceIds[appearanceTypes.Pants] =
                appearanceUtils.appearanceIdToAppearanceArray(
                    appearanceTypes.Pants,
                    npc._appearance._legsId ?? 0
                );

            // Build equipped items arrays
            let equippedItemIds: number[][] = [];

            if (npc._appearance._equippedItems) {
                // Try to map equipped items properly
                equippedItemIds = npc._appearance._equippedItems.map(
                    (item: any) =>
                        appearanceUtils.inventoryItemToEquippedItemsArray(item)
                );
            } else {
                // Create empty equipment array
                equippedItemIds = new Array(10);
                for (let i = 0; i < 10; i++) {
                    equippedItemIds[i] = [-1, -1, -1];
                }
            }

            // PF enum from the game
            const entityTypes = document.highlite.gameLookups['EntityTypes'];

            // Generate a unique entity ID for this request
            const entityId = 20000 + npc._id;

            // Call the game's sprite sheet generation
            spritesheetManager.loadHumanSpritesheet(
                entityTypes.NPC, // EntityType
                null, // Name (null for NPCs)
                entityId, // EntityID (unique)
                npc._id, // EntityTypeID (the NPC definition ID)
                appearanceIds, // AppearanceIDs
                equippedItemIds // EquippedItemIDs
            );
        } catch (error) {
            this.error(`Failed to request human sprite: ${error}`);
        }
    }

    // Sprite Reference Management
    private addSpriteReference(
        spriteUrl: string,
        context: 'sidebar' | 'modal'
    ): void {
        if (!spriteUrl) return;

        // Track the URL as one we've created
        this.activeSpriteUrls.add(spriteUrl);

        // Increment reference count
        const currentCount = this.spriteReferences.get(spriteUrl) || 0;
        this.spriteReferences.set(spriteUrl, currentCount + 1);

        // Store context information for this URL
        const existingContexts =
            this.spriteContexts.get(spriteUrl) || new Set<string>();
        existingContexts.add(context);
        this.spriteContexts.set(spriteUrl, existingContexts);

        // Add context attribute to track where it's used
        const contextAttr = `data-sprite-${context}`;
        const elements = document.querySelectorAll(`[style*="${spriteUrl}"]`);
        elements.forEach(el => {
            (el as HTMLElement).setAttribute(contextAttr, 'true');
        });
    }

    private removeSpriteReference(
        spriteUrl: string,
        context: 'sidebar' | 'modal'
    ): void {
        if (!spriteUrl || !this.spriteReferences.has(spriteUrl)) return;

        // Remove this context from the URL's context set
        const contexts = this.spriteContexts.get(spriteUrl);
        if (contexts) {
            contexts.delete(context);
            if (contexts.size === 0) {
                this.spriteContexts.delete(spriteUrl);
            }
        }

        const currentCount = this.spriteReferences.get(spriteUrl) || 0;
        const newCount = Math.max(0, currentCount - 1);

        if (newCount === 0) {
            // Double-check that the URL is not still being used anywhere in the DOM
            const stillInUse = this.isSpriteStillInUse(spriteUrl);
            if (stillInUse) {
                // Reset the reference count to 1 to prevent future revocation attempts
                this.spriteReferences.set(spriteUrl, 1);
                return;
            }

            // No more references, clean up the URL
            this.spriteReferences.delete(spriteUrl);
            this.spriteContexts.delete(spriteUrl);
            this.activeSpriteUrls.delete(spriteUrl);

            try {
                const blobLoader =
                    document.highlite?.gameHooks?.BlobLoader?.Instance;
                if (blobLoader && blobLoader.revokeObjectURL) {
                    this.log(`Revoking sprite URL: ${spriteUrl}`);
                    blobLoader.revokeObjectURL(spriteUrl);
                }

                // Remove from SpriteSheetManager caches (URL is definitely being revoked)
                this.removeFromSpriteSheetManagerCache(spriteUrl, true);
            } catch (error) {
                this.error(`Failed to revoke sprite URL: ${error}`);
            }
        } else {
            this.spriteReferences.set(spriteUrl, newCount);
        }
    }

    private cleanupSidebarSprites(preserveNpcIds?: Set<number>): void {
        // Find all sprites in sidebar and check which can be safely removed
        if (!this.itemListContainer) return;

        const spriteElements = this.itemListContainer.querySelectorAll(
            '[data-sprite-sidebar]'
        );

        spriteElements.forEach(el => {
            const style = (el as HTMLElement).style.backgroundImage;
            if (style && style.includes('blob:')) {
                const urlMatch = style.match(/url\("?(blob:[^"]+)"?\)/);
                if (urlMatch) {
                    const spriteUrl = urlMatch[1];

                    // Check if this sprite belongs to an NPC we want to preserve
                    let shouldPreserve = false;
                    if (preserveNpcIds) {
                        // Look for data-npc-id on the sprite element or its parent NPC element
                        let npcId = (el as HTMLElement).getAttribute(
                            'data-npc-id'
                        );
                        if (!npcId) {
                            const npcElement = (el as HTMLElement).closest(
                                '[data-npc-id]'
                            );
                            if (npcElement) {
                                npcId = npcElement.getAttribute('data-npc-id');
                            }
                        }
                        if (npcId && preserveNpcIds.has(parseInt(npcId))) {
                            shouldPreserve = true;
                        }
                    }

                    // Check if this URL is still being used in the modal
                    const stillUsedInModal =
                        this.isSpriteUsedInModal(spriteUrl);

                    if (stillUsedInModal || shouldPreserve) {
                        this.log(
                            `Preserving sprite URL ${stillUsedInModal ? '(used in modal)' : '(preserved NPC)'}: ${spriteUrl}`
                        );
                        // Remove the context from our tracking but keep the reference count
                        const contexts = this.spriteContexts.get(spriteUrl);
                        if (contexts) {
                            contexts.delete('sidebar');
                            if (contexts.size === 0) {
                                this.spriteContexts.delete(spriteUrl);
                            }
                        }
                        // Remove the context attribute
                        (el as HTMLElement).removeAttribute(
                            'data-sprite-sidebar'
                        );
                    } else {
                        // Safe to remove the reference
                        this.removeSpriteReference(spriteUrl, 'sidebar');
                    }
                }
            }
        });
    }

    private cleanupModalSprites(): void {
        // Find all sprites in modal and remove their references
        if (!this.modalOverlay) return;

        const spriteElements = this.modalOverlay.querySelectorAll(
            '[data-sprite-modal]'
        );
        spriteElements.forEach(el => {
            const style = (el as HTMLElement).style.backgroundImage;
            if (style && style.includes('blob:')) {
                const urlMatch = style.match(/url\("?(blob:[^"]+)"?\)/);
                if (urlMatch) {
                    this.removeSpriteReference(urlMatch[1], 'modal');
                }
            }
        });
    }

    private cleanupAllSprites(): void {
        // Clean up all sprite references
        for (const spriteUrl of this.activeSpriteUrls) {
            try {
                const blobLoader =
                    document.highlite?.gameHooks?.BlobLoader?.Instance;
                if (blobLoader && blobLoader.revokeObjectURL) {
                    this.log(`Revoking sprite URL: ${spriteUrl}`);
                    blobLoader.revokeObjectURL(spriteUrl);
                }

                // Remove from SpriteSheetManager caches (force removal since we're cleaning up everything)
                this.removeFromSpriteSheetManagerCache(spriteUrl, true);
            } catch (error) {
                this.error(`Failed to revoke sprite URL: ${error}`);
            }
        }

        this.spriteReferences.clear();
        this.spriteContexts.clear();
        this.activeSpriteUrls.clear();
    }

    private trackSpriteUsage(
        element: HTMLElement,
        spriteUrl: string,
        context: 'sidebar' | 'modal'
    ): void {
        if (!spriteUrl) return;

        // Add reference tracking
        this.addSpriteReference(spriteUrl, context);

        // Mark element with context
        element.setAttribute(`data-sprite-${context}`, 'true');
    }

    private isSpriteUsedInModal(spriteUrl: string): boolean {
        if (!this.modalOverlay) return false;

        // Check all elements in modal for this sprite URL (not just those with data-sprite-modal)
        const allModalElements = this.modalOverlay.querySelectorAll('*');
        for (const el of allModalElements) {
            const style = (el as HTMLElement).style.backgroundImage;
            if (style && style.includes(spriteUrl)) {
                return true;
            }
        }

        return false;
    }

    private isSpriteStillInUse(spriteUrl: string): boolean {
        // Check entire document for this sprite URL
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            const style = (el as HTMLElement).style.backgroundImage;
            if (style && style.includes(spriteUrl)) {
                return true;
            }
        }
        return false;
    }

    private removeFromSpriteSheetManagerCache(
        spriteUrl: string,
        forceRemove: boolean = false
    ): void {
        try {
            const spritesheetManager =
                document.highlite?.gameHooks?.SpriteSheetManager?.Instance;
            if (!spritesheetManager) return;

            // Only remove cache entries if this URL is no longer referenced anywhere OR if forced
            if (!forceRemove) {
                // Check if any other sprites are still using this URL
                const stillInUse =
                    this.activeSpriteUrls.has(spriteUrl) ||
                    this.spriteReferences.has(spriteUrl);

                if (stillInUse) {
                    return;
                }
            }

            // Check human NPC cache - remove ALL entries with this URL since it's being revoked
            if (spritesheetManager._humanNPCSpritesheetInfo) {
                const humanCache = spritesheetManager._humanNPCSpritesheetInfo;
                const keysToRemove: number[] = [];

                for (const [key, spriteInfo] of humanCache.entries()) {
                    if (spriteInfo && spriteInfo.SpritesheetURL === spriteUrl) {
                        keysToRemove.push(key);
                    }
                }

                keysToRemove.forEach(key => {
                    this.log(
                        `Removing NPC ${key} from human sprite cache (URL being revoked)`
                    );
                    humanCache.delete(key);
                });
            }

            // Check player cache - remove ALL entries with this URL since it's being revoked
            if (spritesheetManager._playerSpritesheetInfo) {
                const playerCache = spritesheetManager._playerSpritesheetInfo;
                const keysToRemove: string[] = [];

                for (const [key, spriteInfo] of playerCache.entries()) {
                    if (spriteInfo && spriteInfo.SpritesheetURL === spriteUrl) {
                        keysToRemove.push(key);
                    }
                }

                keysToRemove.forEach(key => {
                    this.log(
                        `Removing player ${key} from player sprite cache (URL being revoked)`
                    );
                    playerCache.delete(key);
                });
            }
        } catch (error) {
            this.error(
                `Failed to remove sprite from SpriteSheetManager cache: ${error}`
            );
        }
    }

    private showLoadingState(): void {
        if (!this.itemListContainer) return;

        this.itemListContainer.innerHTML = `
            <div class="item-loading">
                <p>Loading definitions...</p>
                <p class="item-loading-hint">Please log in to view items</p>
            </div>
        `;
    }

    private updatePagination(): void {
        const paginationContainer = this.panelContent?.querySelector(
            '.pagination-container'
        );
        if (!paginationContainer) return;

        paginationContainer.innerHTML = '';

        const currentList =
            this.currentView === 'items'
                ? this.filteredItems
                : this.filteredNpcs;
        const totalPages = Math.ceil(currentList.length / this.itemsPerPage);

        if (totalPages <= 1) return;

        // Previous button
        const prevButton = document.createElement('button');
        prevButton.className = 'pagination-button';
        prevButton.textContent = '◀';
        prevButton.disabled = this.currentPage === 0;
        prevButton.onclick = () => {
            if (this.currentPage > 0) {
                this.currentPage--;
                if (this.currentView === 'items') {
                    this.renderItemList();
                } else {
                    this.renderNpcList();
                }
            }
        };
        paginationContainer.appendChild(prevButton);

        // Page info
        const pageInfo = document.createElement('span');
        pageInfo.className = 'pagination-info';
        pageInfo.textContent = `${this.currentPage + 1} / ${totalPages}`;
        paginationContainer.appendChild(pageInfo);

        // Next button
        const nextButton = document.createElement('button');
        nextButton.className = 'pagination-button';
        nextButton.textContent = '▶';
        nextButton.disabled = this.currentPage >= totalPages - 1;
        nextButton.onclick = () => {
            if (this.currentPage < totalPages - 1) {
                this.currentPage++;
                if (this.currentView === 'items') {
                    this.renderItemList();
                } else {
                    this.renderNpcList();
                }
            }
        };
        paginationContainer.appendChild(nextButton);
    }

    private showItemModal(itemId: number): void {
        // Remove any existing modal
        this.closeModal();

        // Create modal overlay
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'item-modal-overlay';

        // Create modal container
        const modalContainer = document.createElement('div');
        modalContainer.className = 'item-modal-container';

        // Get UIManager for event binding
        const uiManager = document.highlite?.managers?.UIManager;

        // Close modal when clicking overlay
        if (uiManager) {
            uiManager.bindOnClickBlockHsMask(this.modalOverlay, (e: Event) => {
                if (e.target === this.modalOverlay) {
                    this.closeModal();
                }
            });
        } else {
            // Fallback if UIManager not available
            this.modalOverlay.onclick = e => {
                if (e.target === this.modalOverlay) {
                    this.closeModal();
                }
            };
        }

        // Prevent scroll events from propagating to game canvas
        const preventScroll = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // Add scroll prevention to overlay
        this.modalOverlay.addEventListener('wheel', preventScroll, {
            passive: false,
        });
        this.modalOverlay.addEventListener('touchmove', preventScroll, {
            passive: false,
        });

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'item-modal-close';
        closeButton.innerHTML = '×';

        if (uiManager) {
            uiManager.bindOnClickBlockHsMask(closeButton, () => {
                this.closeModal();
            });
        } else {
            closeButton.onclick = () => this.closeModal();
        }

        modalContainer.appendChild(closeButton);

        // Add content
        const modalContent = document.createElement('div');
        modalContent.className = 'item-modal-content';

        modalContent.addEventListener(
            'wheel',
            (e: WheelEvent) => {
                e.stopPropagation();
                const target = e.target as HTMLElement;
                const scrollableContainer = target.closest(
                    '.npc-drops-container, .drops-section-container'
                );

                if (scrollableContainer) {
                    const { scrollTop, scrollHeight, clientHeight } =
                        scrollableContainer;
                    const delta = e.deltaY;

                    if (delta < 0 && scrollTop === 0) {
                        e.preventDefault();
                    } else if (
                        delta > 0 &&
                        scrollTop + clientHeight >= scrollHeight - 1
                    ) {
                        e.preventDefault();
                    }
                    return;
                }

                const { scrollTop, scrollHeight, clientHeight } = modalContent;
                const delta = e.deltaY;
                if (delta < 0 && scrollTop === 0) {
                    e.preventDefault();
                } else if (
                    delta > 0 &&
                    scrollTop + clientHeight >= scrollHeight - 1
                ) {
                    e.preventDefault();
                }
            },
            { passive: false }
        );

        modalContent.addEventListener(
            'touchmove',
            (e: TouchEvent) => {
                e.stopPropagation();
            },
            { passive: false }
        );

        this.loadItemDetailsIntoModal(modalContent, itemId);

        modalContainer.appendChild(modalContent);
        this.modalOverlay.appendChild(modalContainer);

        const container = this.isLoggedIn
            ? document.getElementById('hs-screen-mask')
            : document.body;
        if (container) {
            container.appendChild(this.modalOverlay);
        } else {
            document.body.appendChild(this.modalOverlay);
        }

        const escapeHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    private closeModal(): void {
        if (this.modalOverlay) {
            // Clean up sprites used in modal before removing
            this.cleanupModalSprites();
            this.modalOverlay.remove();
            this.modalOverlay = null;
        }
    }

    private loadItemDetailsIntoModal(
        container: HTMLElement,
        itemId: number
    ): void {
        try {
            const itemDef =
                document.highlite?.gameHooks?.ItemDefMap?.ItemDefMap?.get(
                    itemId
                );
            if (!itemDef) {
                container.innerHTML =
                    "<p class='detail-error'>Item not found</p>";
                return;
            }

            let spritePosition = '';
            const pos =
                document.highlite?.gameHooks?.InventoryItemSpriteManager?.getCSSBackgroundPositionForItem(
                    itemId
                );
            if (pos) {
                spritePosition = `style="background-position: ${pos};"`;
            }

            let html = `
                <div class="detail-header">
                    <div class="detail-sprite-large" ${spritePosition}></div>
                    <div class="detail-title">
                        <h2>${itemDef._nameCapitalized || itemDef._name || `Item ${itemId}`}</h2>
                        <p class="detail-id">ID: ${itemId}</p>
                    </div>
                </div>
            `;

            // Description
            if (itemDef._description) {
                html += `
                    <div class="detail-section">
                        <h3>Description</h3>
                        <p>${itemDef._description}</p>
                    </div>
                `;
            }

            // Cost
            if (itemDef._cost && itemDef._cost > 0) {
                html += `
                    <div class="detail-section">
                        <h3>Cost</h3>
                        <p class="detail-cost">${itemDef._cost.toLocaleString()} coins</p>
                    </div>
                `;
            }

            // Requirements
            if (
                itemDef._equippableRequirements &&
                itemDef._equippableRequirements.length > 0
            ) {
                html += `
                    <div class="detail-section">
                        <h3>Requirements</h3>
                        <div class="detail-list">
                `;
                itemDef._equippableRequirements.forEach((req: any) => {
                    html += `<div class="detail-list-item">• Level ${req._amount} ${getSkillName(req._skill)}</div>`;
                });
                html += `
                        </div>
                    </div>
                `;
            }

            // Equippable Effects
            if (
                itemDef._equippableEffects &&
                itemDef._equippableEffects.length > 0
            ) {
                html += `
                    <div class="detail-section">
                        <h3>Equipment Effects</h3>
                        <div class="detail-list">
                `;
                itemDef._equippableEffects.forEach((effect: any) => {
                    const sign = effect._amount > 0 ? '+' : '';
                    html += `<div class="detail-list-item effect-positive">• ${sign}${effect._amount} ${getSkillName(effect._skill)}</div>`;
                });
                html += `
                        </div>
                    </div>
                `;
            }

            // Edible Effects
            if (itemDef._edibleEffects && itemDef._edibleEffects.length > 0) {
                html += `
                    <div class="detail-section">
                        <h3>Edible Effects</h3>
                        <div class="detail-list">
                `;
                itemDef._edibleEffects.forEach((effect: any) => {
                    const sign = effect._amount > 0 ? '+' : '';
                    html += `<div class="detail-list-item effect-positive">• ${sign}${effect._amount} ${getSkillName(effect._skill)}</div>`;
                });
                html += `
                        </div>
                    </div>
                `;
            }

            // Experience from obtaining
            if (
                itemDef._expFromObtaining &&
                itemDef._expFromObtaining._skill !== undefined &&
                itemDef._expFromObtaining._amount > 0
            ) {
                html += `
                    <div class="detail-section">
                        <h3>Experience Gained</h3>
                        <div class="detail-list">
                            <div class="detail-list-item">• ${itemDef._expFromObtaining._amount} ${getSkillName(itemDef._expFromObtaining._skill)} XP</div>
                        </div>
                    </div>
                `;
            }

            // Recipe
            if (
                itemDef._recipe &&
                itemDef._recipe._ingredients &&
                itemDef._recipe._ingredients.length > 0
            ) {
                html += `
                    <div class="detail-section">
                        <h3>Recipe</h3>
                        <div class="recipe-grid">
                `;
                itemDef._recipe._ingredients.forEach((ingredient: any) => {
                    try {
                        const ingredientDef =
                            document.highlite?.gameHooks?.ItemDefMap?.ItemDefMap?.get(
                                ingredient._itemId
                            );
                        const ingredientName =
                            ingredientDef?._nameCapitalized ||
                            ingredientDef?._name ||
                            `Item ${ingredient._itemId}`;
                        const ingredientPos =
                            document.highlite?.gameHooks?.InventoryItemSpriteManager?.getCSSBackgroundPositionForItem(
                                ingredient._itemId
                            );
                        const spriteStyle = ingredientPos
                            ? `style="background-position: ${ingredientPos};"`
                            : '';

                        html += `
                            <div class="recipe-item" data-item-id="${ingredient._itemId}">
                                <div class="recipe-item-sprite" ${spriteStyle}></div>
                                <div class="recipe-item-info">
                                    <div class="recipe-item-name">${ingredientName}</div>
                                    <div class="recipe-item-amount">${ingredient._amount}x</div>
                                </div>
                            </div>
                        `;
                    } catch {
                        html += `
                            <div class="recipe-item" data-item-id="${ingredient._itemId}">
                                <div class="recipe-item-sprite"></div>
                                <div class="recipe-item-info">
                                    <div class="recipe-item-name">Item ${ingredient._itemId}</div>
                                    <div class="recipe-item-amount">${ingredient._amount}x</div>
                                </div>
                            </div>
                        `;
                    }
                });
                html += `
                        </div>
                    </div>
                `;
            }

            // Edible Result
            if (itemDef._edibleResult) {
                html += `
                    <div class="detail-section">
                        <h3>After Eating</h3>
                        <div class="recipe-grid">
                `;
                try {
                    const resultDef =
                        document.highlite?.gameHooks?.ItemDefMap?.ItemDefMap?.get(
                            itemDef._edibleResult._itemId
                        );
                    const resultName =
                        resultDef?._nameCapitalized ||
                        resultDef?._name ||
                        `Item ${itemDef._edibleResult._itemId}`;
                    const resultPos =
                        document.highlite?.gameHooks?.InventoryItemSpriteManager?.getCSSBackgroundPositionForItem(
                            itemDef._edibleResult._itemId
                        );
                    const spriteStyle = resultPos
                        ? `style="background-position: ${resultPos};"`
                        : '';

                    html += `
                        <div class="recipe-item" data-item-id="${itemDef._edibleResult._itemId}">
                            <div class="recipe-item-sprite" ${spriteStyle}></div>
                            <div class="recipe-item-info">
                                <div class="recipe-item-name">${resultName}</div>
                                <div class="recipe-item-amount">${itemDef._edibleResult._amount}x</div>
                            </div>
                        </div>
                    `;
                } catch {
                    html += `
                        <div class="recipe-item" data-item-id="${itemDef._edibleResult._itemId}">
                            <div class="recipe-item-sprite"></div>
                            <div class="recipe-item-info">
                                <div class="recipe-item-name">Item ${itemDef._edibleResult._itemId}</div>
                                <div class="recipe-item-amount">${itemDef._edibleResult._amount}x</div>
                            </div>
                        </div>
                    `;
                }
                html += `
                        </div>
                    </div>
                `;
            }

            // Properties
            html += `
                <div class="detail-section">
                    <h3>Properties</h3>
                    <div class="detail-properties">
            `;

            // Value/General Price
            if (itemDef._generalPrice !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Value:</span>
                        <span class="property-value gold">${itemDef._generalPrice.toLocaleString()} gp</span>
                    </div>
                `;
            }

            // Equipment Type
            if (
                itemDef._equipmentType !== null &&
                itemDef._equipmentType !== undefined
            ) {
                html += `
                    <div class="property">
                        <span class="property-label">Type:</span>
                        <span class="property-value">${getEquipmentTypeName(itemDef._equipmentType)}</span>
                    </div>
                `;
            }

            // Weapon Speed
            if (itemDef._weaponSpeed && itemDef._weaponSpeed > 0) {
                html += `
                    <div class="property">
                        <span class="property-label">Attack Speed:</span>
                        <span class="property-value">${itemDef._weaponSpeed}</span>
                    </div>
                `;
            }

            // Weight
            if (itemDef._weight !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Weight:</span>
                        <span class="property-value">${itemDef._weight} kg</span>
                    </div>
                `;
            }

            // Metal Type
            if (
                itemDef._metalType !== null &&
                itemDef._metalType !== undefined
            ) {
                const metalTypes = [
                    'Bronze',
                    'Iron',
                    'Steel',
                    'Palladium',
                    'Gold',
                    'Coronium',
                    'Celadium',
                ];
                const metalName =
                    metalTypes[itemDef._metalType] ||
                    `Metal ${itemDef._metalType}`;
                html += `
                    <div class="property">
                        <span class="property-label">Metal Type:</span>
                        <span class="property-value">${metalName}</span>
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;

            // Tags
            let tags: string[] = [];
            if (itemDef._isMembers !== undefined && itemDef._isMembers)
                tags.push('<span class="detail-tag members">Members</span>');
            if (
                itemDef._membersObjectBool !== undefined &&
                itemDef._membersObjectBool
            )
                tags.push('<span class="detail-tag members">Members</span>');
            if (itemDef._isStackable !== undefined && itemDef._isStackable)
                tags.push(
                    '<span class="detail-tag stackable">Stackable</span>'
                );
            if (itemDef._stackable !== undefined && itemDef._stackable)
                tags.push(
                    '<span class="detail-tag stackable">Stackable</span>'
                );
            if (itemDef._isTradeable !== undefined && itemDef._isTradeable)
                tags.push(
                    '<span class="detail-tag tradeable">Tradeable</span>'
                );
            if (itemDef._canBeNoted !== undefined && itemDef._canBeNoted)
                tags.push('<span class="detail-tag noteable">Noteable</span>');
            if (itemDef._canIOU !== undefined && itemDef._canIOU)
                tags.push('<span class="detail-tag iou">IOU</span>');

            if (tags.length > 0) {
                html += `
                    <div class="detail-tags">
                        ${[...new Set(tags)].join('')}
                    </div>
                `;
            }

            // NPCs that drop this item
            html += this.generateNpcDropsSection(itemId);

            // Actions
            html += `
                <div class="detail-section">
                    <h3>Actions</h3>
                    <div class="detail-actions">
                        <button class="action-button" onclick="window.highliteItemPanel.copyItemId(${itemId})">Copy ID</button>
                        <button class="action-button" onclick="window.highliteItemPanel.copyItemLink(${itemId})">Copy Chat Link</button>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Create NPC sprites after DOM insertion
            this.createNpcDropSprites(container);

            // Bind click events to recipe items and NPC drop items
            const recipeItems = container.querySelectorAll('.recipe-item');
            const npcDropItems = container.querySelectorAll('.npc-drop-item');
            const uiManager = document.highlite?.managers?.UIManager;

            recipeItems.forEach(item => {
                const itemId = item.getAttribute('data-item-id');
                if (itemId && uiManager) {
                    uiManager.bindOnClickBlockHsMask(
                        item as HTMLElement,
                        () => {
                            this.showItemModal(parseInt(itemId));
                        }
                    );
                } else if (itemId) {
                    // Fallback
                    (item as HTMLElement).onclick = () => {
                        this.showItemModal(parseInt(itemId));
                    };
                }
            });

            npcDropItems.forEach(npcItem => {
                const npcId = npcItem.getAttribute('data-npc-id');
                if (npcId && uiManager) {
                    uiManager.bindOnClickBlockHsMask(
                        npcItem as HTMLElement,
                        () => {
                            this.showNpcModal(parseInt(npcId));
                        }
                    );
                } else if (npcId) {
                    (npcItem as HTMLElement).onclick = () => {
                        this.showNpcModal(parseInt(npcId));
                    };
                }
            });
        } catch (error) {
            this.error(`Failed to show item details: ${error}`);
            container.innerHTML =
                "<p class='detail-error'>Error loading item details</p>";
        }
    }

    private showNpcModal(npcId: number): void {
        // Remove any existing modal
        this.closeModal();

        // Create modal overlay
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'item-modal-overlay';

        // Create modal container
        const modalContainer = document.createElement('div');
        modalContainer.className = 'item-modal-container';

        // Get UIManager for event binding
        const uiManager = document.highlite?.managers?.UIManager;

        // Close modal when clicking overlay
        if (uiManager) {
            uiManager.bindOnClickBlockHsMask(this.modalOverlay, (e: Event) => {
                if (e.target === this.modalOverlay) {
                    this.closeModal();
                }
            });
        } else {
            // Fallback if UIManager not available
            this.modalOverlay.onclick = e => {
                if (e.target === this.modalOverlay) {
                    this.closeModal();
                }
            };
        }

        // Prevent scroll events from propagating to game canvas
        const preventScroll = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // Add scroll prevention to overlay
        this.modalOverlay.addEventListener('wheel', preventScroll, {
            passive: false,
        });
        this.modalOverlay.addEventListener('touchmove', preventScroll, {
            passive: false,
        });

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'item-modal-close';
        closeButton.innerHTML = '×';

        if (uiManager) {
            uiManager.bindOnClickBlockHsMask(closeButton, () => {
                this.closeModal();
            });
        } else {
            closeButton.onclick = () => this.closeModal();
        }

        modalContainer.appendChild(closeButton);

        // Add content
        const modalContent = document.createElement('div');
        modalContent.className = 'item-modal-content';

        // Allow scrolling within modal content but prevent propagation
        modalContent.addEventListener(
            'wheel',
            (e: WheelEvent) => {
                e.stopPropagation();

                // Check if we're scrolling within a specific scrollable container
                const target = e.target as HTMLElement;
                const scrollableContainer = target.closest(
                    '.npc-drops-container, .drops-section-container'
                );

                if (scrollableContainer) {
                    // Allow scrolling within scrollable containers
                    const { scrollTop, scrollHeight, clientHeight } =
                        scrollableContainer;
                    const delta = e.deltaY;

                    // At top and scrolling up
                    if (delta < 0 && scrollTop === 0) {
                        e.preventDefault();
                    }
                    // At bottom and scrolling down
                    else if (
                        delta > 0 &&
                        scrollTop + clientHeight >= scrollHeight - 1
                    ) {
                        e.preventDefault();
                    }
                    return;
                }

                // For main modal content, prevent scroll if at boundaries
                const { scrollTop, scrollHeight, clientHeight } = modalContent;
                const delta = e.deltaY;

                // At top and scrolling up
                if (delta < 0 && scrollTop === 0) {
                    e.preventDefault();
                }
                // At bottom and scrolling down
                else if (
                    delta > 0 &&
                    scrollTop + clientHeight >= scrollHeight - 1
                ) {
                    e.preventDefault();
                }
            },
            { passive: false }
        );

        // Prevent touch scrolling from propagating
        modalContent.addEventListener(
            'touchmove',
            (e: TouchEvent) => {
                e.stopPropagation();
            },
            { passive: false }
        );

        // Load NPC details into modal
        this.loadNpcDetailsIntoModal(modalContent, npcId);

        modalContainer.appendChild(modalContent);
        this.modalOverlay.appendChild(modalContainer);

        // Append to hs-screen-mask if logged in, otherwise to body
        const container = this.isLoggedIn
            ? document.getElementById('hs-screen-mask')
            : document.body;
        if (container) {
            container.appendChild(this.modalOverlay);
        } else {
            document.body.appendChild(this.modalOverlay);
        }

        // Add escape key handler
        const escapeHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    private loadNpcDetailsIntoModal(
        container: HTMLElement,
        npcId: number
    ): void {
        try {
            const npcDef =
                document.highlite?.gameHooks?.NpcDefinitionManager?.getDefById(
                    npcId
                );
            if (!npcDef) {
                container.innerHTML =
                    "<p class='detail-error'>NPC not found</p>";
                return;
            }

            // Determine NPC type and display
            const typeInfo = this.getNpcTypeInfo(npcDef);

            let spriteHtml = '';
            if (
                typeInfo.isCreature &&
                typeInfo.creatureType !== undefined &&
                typeInfo.creatureSpriteId !== undefined
            ) {
                const creatureType = typeInfo.creatureType;
                const creatureSpriteId = typeInfo.creatureSpriteId;
                const sizeClass = this.getCreatureSizeClass(creatureType);

                // Get sprite info from SpritesheetManager
                const spritesheetManager =
                    document.highlite?.gameHooks?.SpriteSheetManager?.Instance;
                const creatureSpritesheetInfo =
                    spritesheetManager?.CreatureSpritesheetInfo;

                if (
                    creatureSpritesheetInfo &&
                    creatureSpritesheetInfo[creatureType]
                ) {
                    const sheetIndex = 0; // Use first sheet
                    const spriteInfo =
                        creatureSpritesheetInfo[creatureType][sheetIndex];

                    if (spriteInfo) {
                        const spriteFrameIndex = 15 * creatureSpriteId;
                        const spritePos = this.calculateSpritePositionFromId(
                            spriteFrameIndex,
                            creatureType
                        );
                        spriteHtml = `<div class="npc-sprite-modal npc-sprite-${sizeClass}" data-creature-type="${creatureType}" style="background-image: url('${spriteInfo.SpritesheetURL}'); background-position: -${spritePos.x}px -${spritePos.y}px; width: ${spriteInfo.SpriteWidth}px; height: ${spriteInfo.SpriteHeight}px;" data-sprite-modal="true"></div>`;
                        // Track sprite usage after DOM insertion
                        setTimeout(
                            () =>
                                this.trackSpriteUsage(
                                    document.querySelector(
                                        `[data-creature-type="${creatureType}"]`
                                    ) as HTMLElement,
                                    spriteInfo.SpritesheetURL,
                                    'modal'
                                ),
                            0
                        );
                    } else {
                        // Fallback
                        const spriteFrameIndex = 15 * creatureSpriteId;
                        const spritePos = this.calculateSpritePositionFromId(
                            spriteFrameIndex,
                            creatureType
                        );
                        spriteHtml = `<div class="npc-sprite-modal npc-sprite-${sizeClass}" data-creature-type="${creatureType}" style="background-position: -${spritePos.x}px -${spritePos.y}px;"></div>`;
                    }
                } else {
                    // Fallback
                    const spriteFrameIndex = 15 * creatureSpriteId;
                    const spritePos = this.calculateSpritePositionFromId(
                        spriteFrameIndex,
                        creatureType
                    );
                    spriteHtml = `<div class="npc-sprite-modal npc-sprite-${sizeClass}" data-creature-type="${creatureType}" style="background-position: -${spritePos.x}px -${spritePos.y}px;"></div>`;
                }
            } else if (typeInfo.isHuman) {
                // Try to get cached human sprite
                const spritesheetManager =
                    document.highlite.gameHooks.SpriteSheetManager.Instance;
                const humanSpriteInfo =
                    spritesheetManager?.HumanNPCSpritesheetInfo?.get(
                        npcDef._id
                    );

                if (humanSpriteInfo && humanSpriteInfo.SpritesheetURL) {
                    // Use existing sprite URL
                    spriteHtml = `<div class="npc-sprite-modal npc-sprite-human" style="background-image: url('${humanSpriteInfo.SpritesheetURL}'); background-position: -64px 0px; background-size: auto;" data-sprite-modal="true"></div>`;
                    // Track sprite usage after DOM insertion
                    setTimeout(
                        () =>
                            this.trackSpriteUsage(
                                document.querySelector(
                                    '.npc-sprite-modal.npc-sprite-human'
                                ) as HTMLElement,
                                humanSpriteInfo.SpritesheetURL,
                                'modal'
                            ),
                        0
                    );
                } else {
                    // Show placeholder initially
                    spriteHtml = `<div class="npc-sprite-modal npc-sprite-human" data-npc-id="${npcDef._id}" style="background-color: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 36px;">👤</div>`;

                    // Request sprite generation through the game's system
                    this.requestHumanSprite(npcDef);

                    // Poll for the sprite
                    const pollInterval = setInterval(() => {
                        const spriteInfo =
                            spritesheetManager?.HumanNPCSpritesheetInfo?.get(
                                npcDef._id
                            );
                        if (spriteInfo && spriteInfo.SpritesheetURL) {
                            clearInterval(pollInterval);
                            const spriteElement = document.querySelector(
                                `.npc-sprite-modal[data-npc-id="${npcDef._id}"]`
                            ) as HTMLElement;
                            if (spriteElement) {
                                spriteElement.innerHTML = '';
                                spriteElement.style.backgroundImage = `url('${spriteInfo.SpritesheetURL}')`;
                                spriteElement.style.backgroundPosition =
                                    '-64px 0px';
                                spriteElement.style.backgroundSize = 'auto';
                                spriteElement.style.backgroundColor =
                                    'transparent';
                                spriteElement.setAttribute(
                                    'data-sprite-modal',
                                    'true'
                                );
                                // Track sprite usage
                                this.trackSpriteUsage(
                                    spriteElement,
                                    spriteInfo.SpritesheetURL,
                                    'modal'
                                );
                            }
                        }
                    }, 100); // Poll every 100ms

                    // Stop polling after 5 seconds
                    setTimeout(() => clearInterval(pollInterval), 5000);
                }
            } else {
                spriteHtml =
                    '<div class="npc-sprite-modal npc-sprite-unknown">?</div>';
            }

            let html = `
                <div class="detail-header">
                    ${spriteHtml}
                    <div class="detail-title">
                        <h2>${npcDef._nameCapitalized || npcDef._name || `NPC ${npcId}`}</h2>
                        <p class="detail-id">ID: ${npcId}</p>
                        ${
                            npcDef._combat &&
                            npcDef._combat._combat &&
                            npcDef._combat._combat._combatLevel
                                ? `<p class="detail-level">Level: ${npcDef._combat._combat._combatLevel}</p>`
                                : ''
                        }
                    </div>
                </div>
            `;

            // Description
            if (npcDef._description) {
                html += `
                    <div class="detail-section">
                        <h3>Description</h3>
                        <p>${npcDef._description}</p>
                    </div>
                `;
            }

            // Combat Stats
            if (npcDef._combat && npcDef._combat._combat) {
                const combat = npcDef._combat._combat;
                html += `
                    <div class="detail-section">
                        <h3>Combat Stats</h3>
                        <div class="detail-properties">
                            <div class="property">
                                <span class="property-label">Combat Level:</span>
                                <span class="property-value">${combat._combatLevel || 'Unknown'}</span>
                            </div>
                `;

                // Skills
                if (combat._skills && combat._skills.length > 0) {
                    const skillNames = [
                        'Melee',
                        'Ranged',
                        'Defence',
                        'Magic',
                        'Prayer',
                    ];
                    const skills = combat._skills.filter(
                        (s: any) => s && s._skill !== undefined
                    );

                    skills.forEach((skill: any) => {
                        if (skill._skill < skillNames.length) {
                            html += `
                                <div class="property">
                                    <span class="property-label">${skillNames[skill._skill]}:</span>
                                    <span class="property-value">${skill._currentLevel || skill._level || 1}</span>
                                </div>
                            `;
                        }
                    });
                }

                html += `
                        </div>
                    </div>
                `;
            }

            // Behavior
            html += `
                <div class="detail-section">
                    <h3>Behavior</h3>
                    <div class="detail-properties">
            `;

            if (npcDef._isAggressive !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Aggressive:</span>
                        <span class="property-value ${npcDef._isAggressive ? 'yes' : 'no'}">${npcDef._isAggressive ? 'Yes' : 'No'}</span>
                    </div>
                `;
            }

            if (npcDef._isAlwaysAggro !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Always Aggressive:</span>
                        <span class="property-value ${npcDef._isAlwaysAggro ? 'yes' : 'no'}">${npcDef._isAlwaysAggro ? 'Yes' : 'No'}</span>
                    </div>
                `;
            }

            if (npcDef._aggroRadius !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Aggro Radius:</span>
                        <span class="property-value">${npcDef._aggroRadius} tiles</span>
                    </div>
                `;
            }

            if (npcDef._moveEagerness !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Move Eagerness:</span>
                        <span class="property-value">${npcDef._moveEagerness}</span>
                    </div>
                `;
            }

            if (npcDef._weaponSpeed !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Attack Speed:</span>
                        <span class="property-value">${npcDef._weaponSpeed}</span>
                    </div>
                `;
            }

            if (npcDef._movementSpeed !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Movement Speed:</span>
                        <span class="property-value">${npcDef._movementSpeed}</span>
                    </div>
                `;
            }

            if (npcDef._respawnLength !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Respawn Time:</span>
                        <span class="property-value">${npcDef._respawnLength} ticks</span>
                    </div>
                `;
            }

            if (
                npcDef._combat &&
                npcDef._combat._combat &&
                npcDef._combat._combat._autoRetaliate !== undefined
            ) {
                html += `
                    <div class="property">
                        <span class="property-label">Auto Retaliate:</span>
                        <span class="property-value ${npcDef._combat._combat._autoRetaliate ? 'yes' : 'no'}">${npcDef._combat._combat._autoRetaliate ? 'Yes' : 'No'}</span>
                    </div>
                `;
            }

            if (
                npcDef._combat &&
                npcDef._combat._combat &&
                npcDef._combat._combat._combatStyle !== undefined
            ) {
                const combatStyles = ['Melee', 'Ranged', 'Magic'];
                const styleName =
                    combatStyles[npcDef._combat._combat._combatStyle] ||
                    `Style ${npcDef._combat._combat._combatStyle}`;
                html += `
                    <div class="property">
                        <span class="property-label">Combat Style:</span>
                        <span class="property-value">${styleName}</span>
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;

            // Equipment Bonuses
            if (npcDef._combat && npcDef._combat._combat) {
                const combat = npcDef._combat._combat;
                const hasEquipmentBonuses =
                    combat._equipmentAccuracyBonus !== undefined ||
                    combat._equipmentStrengthBonus !== undefined ||
                    combat._equipmentDefenseBonus !== undefined ||
                    combat._equipmentMagicBonus !== undefined ||
                    combat._equipmentRangeBonus !== undefined;

                if (hasEquipmentBonuses) {
                    html += `
                        <div class="detail-section">
                            <h3>Equipment Bonuses</h3>
                            <div class="detail-properties">
                    `;

                    if (combat._equipmentAccuracyBonus !== undefined) {
                        html += `
                            <div class="property">
                                <span class="property-label">Accuracy Bonus:</span>
                                <span class="property-value">+${combat._equipmentAccuracyBonus}</span>
                            </div>
                        `;
                    }

                    if (combat._equipmentStrengthBonus !== undefined) {
                        html += `
                            <div class="property">
                                <span class="property-label">Strength Bonus:</span>
                                <span class="property-value">+${combat._equipmentStrengthBonus}</span>
                            </div>
                        `;
                    }

                    if (combat._equipmentDefenseBonus !== undefined) {
                        html += `
                            <div class="property">
                                <span class="property-label">Defense Bonus:</span>
                                <span class="property-value">+${combat._equipmentDefenseBonus}</span>
                            </div>
                        `;
                    }

                    if (combat._equipmentMagicBonus !== undefined) {
                        html += `
                            <div class="property">
                                <span class="property-label">Magic Bonus:</span>
                                <span class="property-value">+${combat._equipmentMagicBonus}</span>
                            </div>
                        `;
                    }

                    if (combat._equipmentRangeBonus !== undefined) {
                        html += `
                            <div class="property">
                                <span class="property-label">Range Bonus:</span>
                                <span class="property-value">+${combat._equipmentRangeBonus}</span>
                            </div>
                        `;
                    }

                    html += `
                            </div>
                        </div>
                    `;
                }
            }

            // Spells
            if (
                npcDef._combat &&
                npcDef._combat._spellIds &&
                npcDef._combat._spellIds.length > 0
            ) {
                html += `
                    <div class="detail-section">
                        <h3>Magic Abilities</h3>
                        <div class="detail-list">
                `;
                npcDef._combat._spellIds.forEach((spellId: number) => {
                    try {
                        const spellDef =
                            document.highlite?.gameHooks?.SpellDefinitionManager?.getDefById(
                                spellId
                            );
                        const spellName = spellDef?.Name || `Unknown Spell`;
                        html += `<div class="detail-list-item">• ${spellName} (ID: ${spellId})</div>`;
                    } catch {
                        html += `<div class="detail-list-item">• Spell ID: ${spellId}</div>`;
                    }
                });
                html += `
                        </div>
                    </div>
                `;
            }

            // General Properties
            html += `
                <div class="detail-section">
                    <h3>General Properties</h3>
                    <div class="detail-properties">
            `;

            if (npcDef._canShop !== undefined) {
                html += `
                    <div class="property">
                        <span class="property-label">Can Shop:</span>
                        <span class="property-value ${npcDef._canShop ? 'yes' : 'no'}">${npcDef._canShop ? 'Yes' : 'No'}</span>
                    </div>
                `;
            }

            if (
                npcDef._pickpocketId !== undefined &&
                npcDef._pickpocketId !== -1
            ) {
                html += `
                    <div class="property">
                        <span class="property-label">Pickpocket ID:</span>
                        <span class="property-value">${npcDef._pickpocketId}</span>
                    </div>
                `;
            }

            if (npcDef._creatureType !== undefined) {
                const creatureTypeNames = {
                    '-1': 'Human',
                    '0': 'Small Creature',
                    '1': 'Medium Creature',
                    '2': 'Large Creature',
                    '3': 'Largest Creature',
                };
                const typeName =
                    creatureTypeNames[
                        npcDef._creatureType as keyof typeof creatureTypeNames
                    ] || `Type ${npcDef._creatureType}`;
                html += `
                    <div class="property">
                        <span class="property-label">Entity Type:</span>
                        <span class="property-value">${typeName}</span>
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;

            // Equipment (for humans)
            if (npcDef._appearance && npcDef._appearance._equippedItems) {
                const equippedItems = npcDef._appearance._equippedItems.filter(
                    (item: any) => item && item._id
                );
                if (equippedItems.length > 0) {
                    html += `
                        <div class="detail-section">
                            <h3>Equipment</h3>
                            <div class="recipe-grid">
                    `;

                    equippedItems.forEach((item: any) => {
                        try {
                            const itemDef =
                                document.highlite?.gameHooks?.ItemDefMap?.ItemDefMap?.get(
                                    item._id
                                );
                            const itemName =
                                itemDef?._nameCapitalized ||
                                itemDef?._name ||
                                `Item ${item._id}`;
                            const itemPos =
                                document.highlite?.gameHooks?.InventoryItemSpriteManager?.getCSSBackgroundPositionForItem(
                                    item._id
                                );
                            const spriteStyle = itemPos
                                ? `style="background-position: ${itemPos};"`
                                : '';

                            html += `
                                <div class="recipe-item" data-item-id="${item._id}">
                                    <div class="recipe-item-sprite" ${spriteStyle}></div>
                                    <div class="recipe-item-info">
                                        <div class="recipe-item-name">${itemName}</div>
                                        <div class="recipe-item-amount">${item._amount}x</div>
                                    </div>
                                </div>
                            `;
                        } catch {
                            html += `
                                <div class="recipe-item" data-item-id="${item._id}">
                                    <div class="recipe-item-sprite"></div>
                                    <div class="recipe-item-info">
                                        <div class="recipe-item-name">Item ${item._id}</div>
                                        <div class="recipe-item-amount">${item._amount}x</div>
                                    </div>
                                </div>
                            `;
                        }
                    });

                    html += `
                            </div>
                        </div>
                    `;
                }
            }

            // Loot Table
            if (
                npcDef._combat &&
                npcDef._combat._lootTableId !== undefined &&
                npcDef._combat._lootTableId !== -1
            ) {
                html += this.generateDropsSection(
                    npcDef._combat._lootTableId,
                    npcDef._name || `NPC ${npcId}`
                );
            }

            // Creature Appearance (for creatures)
            // if (npcDef._creatureAppearance) {
            //     html += `
            //         <div class="detail-section">
            //             <h3>Creature Info</h3>
            //             <div class="detail-properties">
            //                 <div class="property">
            //                     <span class="property-label">Creature Type:</span>
            //                     <span class="property-value">${this.getCreatureSizeClass(npcDef._creatureAppearance._creatureType)}</span>
            //                 </div>
            //                 <div class="property">
            //                     <span class="property-label">Sprite ID:</span>
            //                     <span class="property-value">${npcDef._creatureAppearance._creatureSpriteId}</span>
            //                 </div>
            //                 <div class="property">
            //                     <span class="property-label">Width:</span>
            //                     <span class="property-value">${npcDef._creatureAppearance._width} tiles</span>
            //                 </div>
            //                 <div class="property">
            //                     <span class="property-label">Height:</span>
            //                     <span class="property-value">${npcDef._creatureAppearance._height} tiles</span>
            //                 </div>
            //                 <div class="property">
            //                     <span class="property-label">Animation Speed:</span>
            //                     <span class="property-value">${npcDef._creatureAppearance._animationSpeed}x</span>
            //                 </div>
            //             </div>
            //         </div>
            //     `;
            // }

            // Human Appearance (for humans)
            // if (npcDef._appearance) {
            //     html += `
            //         <div class="detail-section">
            //             <h3>Appearance</h3>
            //             <div class="detail-properties">
            //     `;

            //     if (npcDef._appearance._hairId !== undefined) {
            //         html += `
            //             <div class="property">
            //                 <span class="property-label">Hair ID:</span>
            //                 <span class="property-value">${npcDef._appearance._hairId}</span>
            //             </div>
            //         `;
            //     }

            //     if (npcDef._appearance._beardId !== undefined) {
            //         html += `
            //             <div class="property">
            //                 <span class="property-label">Beard ID:</span>
            //                 <span class="property-value">${npcDef._appearance._beardId}</span>
            //             </div>
            //         `;
            //     }

            //     if (npcDef._appearance._shirtId !== undefined) {
            //         html += `
            //             <div class="property">
            //                 <span class="property-label">Shirt ID:</span>
            //                 <span class="property-value">${npcDef._appearance._shirtId}</span>
            //             </div>
            //         `;
            //     }

            //     if (npcDef._appearance._bodyId !== undefined) {
            //         html += `
            //             <div class="property">
            //                 <span class="property-label">Body ID:</span>
            //                 <span class="property-value">${npcDef._appearance._bodyId}</span>
            //             </div>
            //         `;
            //     }

            //     if (npcDef._appearance._legsId !== undefined) {
            //         html += `
            //             <div class="property">
            //                 <span class="property-label">Legs ID:</span>
            //                 <span class="property-value">${npcDef._appearance._legsId}</span>
            //             </div>
            //         `;
            //     }

            //     html += `
            //             </div>
            //         </div>
            //     `;

            //     // Equipment (for humans)
            //     if (npcDef._appearance._equippedItems) {
            //         const equippedItems = npcDef._appearance._equippedItems.filter((item: any) => item && item._id);
            //         if (equippedItems.length > 0) {
            //             html += `
            //                 <div class="detail-section">
            //                     <h3>Equipment</h3>
            //                     <div class="recipe-grid">
            //             `;

            //             equippedItems.forEach((item: any) => {
            //                 try {
            //                     const itemDef = document.highlite?.gameHooks?.ItemDefMap?.ItemDefMap?.get(item._id);
            //                     const itemName = itemDef?._nameCapitalized || itemDef?._name || `Item ${item._id}`;
            //                     const itemPos = document.highlite?.gameHooks?.InventoryItemSpriteManager?.getCSSBackgroundPositionForItem(item._id);
            //                     const spriteStyle = itemPos ? `style="background-position: ${itemPos};"` : '';

            //                     html += `
            //                         <div class="recipe-item" data-item-id="${item._id}">
            //                             <div class="recipe-item-sprite" ${spriteStyle}></div>
            //                             <div class="recipe-item-info">
            //                                 <div class="recipe-item-name">${itemName}</div>
            //                                 <div class="recipe-item-amount">${item._amount}x</div>
            //                             </div>
            //                         </div>
            //                     `;
            //                 } catch {
            //                     html += `
            //                         <div class="recipe-item" data-item-id="${item._id}">
            //                             <div class="recipe-item-sprite"></div>
            //                             <div class="recipe-item-info">
            //                                 <div class="recipe-item-name">Item ${item._id}</div>
            //                                 <div class="recipe-item-amount">${item._amount}x</div>
            //                             </div>
            //                         </div>
            //                     `;
            //                 }
            //             });

            //             html += `
            //                     </div>
            //                 </div>
            //             `;
            //         }
            //     }
            // }

            // Tags
            let tags: string[] = [];
            if (npcDef._canShop)
                tags.push('<span class="detail-tag shopkeeper">Shop</span>');
            if (npcDef._pickpocketId !== -1)
                tags.push(
                    '<span class="detail-tag pickpocket">Pickpocket</span>'
                );
            if (npcDef._isAlwaysAggro)
                tags.push(
                    '<span class="detail-tag aggressive">Always Aggressive</span>'
                );
            if (npcDef._isAggressive)
                tags.push(
                    '<span class="detail-tag aggressive">Aggressive</span>'
                );
            if (
                npcDef._combat &&
                npcDef._combat._spellIds &&
                npcDef._combat._spellIds.length > 0
            )
                tags.push('<span class="detail-tag magic">Magic User</span>');
            if (npcDef._creatureAppearance)
                tags.push('<span class="detail-tag creature">Creature</span>');
            if (npcDef._appearance)
                tags.push('<span class="detail-tag human">Human</span>');
            if (npcDef._combat && npcDef._combat._combat)
                tags.push('<span class="detail-tag combat">Combat</span>');
            if (!npcDef._combat)
                tags.push('<span class="detail-tag peaceful">Peaceful</span>');

            if (tags.length > 0) {
                html += `
                    <div class="detail-tags">
                        ${tags.join('')}
                    </div>
                `;
            }

            // Actions
            html += `
                <div class="detail-section">
                    <h3>Actions</h3>
                    <div class="detail-actions">
                        <button class="action-button" onclick="window.highliteItemPanel.copyNpcId(${npcId})">Copy ID</button>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Bind click events to equipped items and loot items
            const itemElements = container.querySelectorAll(
                '.recipe-item, .loot-item'
            );
            const uiManager = document.highlite?.managers?.UIManager;

            itemElements.forEach(item => {
                const itemId = item.getAttribute('data-item-id');
                if (itemId && uiManager) {
                    uiManager.bindOnClickBlockHsMask(
                        item as HTMLElement,
                        () => {
                            this.showItemModal(parseInt(itemId));
                        }
                    );
                } else if (itemId) {
                    // Fallback
                    (item as HTMLElement).onclick = () => {
                        this.showItemModal(parseInt(itemId));
                    };
                }
            });
        } catch (error) {
            this.error(`Failed to show NPC details: ${error}`);
            container.innerHTML =
                "<p class='detail-error'>Error loading NPC details</p>";
        }
    }

    // Public methods for button actions
    public copyItemId(itemId: number): void {
        navigator.clipboard.writeText(itemId.toString());
        this.log(`Copied item ID: ${itemId}`);
    }

    public copyItemLink(itemId: number): void {
        navigator.clipboard.writeText(`[${itemId}]`);
        this.log(`Copied item link: [${itemId}]`);
    }

    public copyNpcId(npcId: number): void {
        navigator.clipboard.writeText(npcId.toString());
        this.log(`Copied NPC ID: ${npcId}`);
    }

    private addStyles(): void {
        const style = document.createElement('style');
        style.setAttribute('data-item-panel', 'true');
        style.textContent = `
            /* Panel Container */
            .item-definition-panel {
                width: 100% !important;
                height: 100% !important;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            /* Header */
            .item-panel-header {
                padding: 12px 15px;
                border-bottom: 1px solid #333;
                flex-shrink: 0;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .header-title-section {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .item-panel-header h3 {
                margin: 0;
                color: #fff;
                font-size: 18px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* View Toggle */
            .view-toggle-container {
                display: flex;
                gap: 8px;
                background: rgba(0, 0, 0, 0.3);
                padding: 4px;
                border-radius: 6px;
            }
            
            .view-toggle-button {
                padding: 6px 16px;
                background: transparent;
                border: 1px solid transparent;
                border-radius: 4px;
                color: #aaa;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                white-space: nowrap;
            }
            
            .view-toggle-button:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.1);
            }
            
            .view-toggle-button.active {
                background: rgba(74, 158, 255, 0.3);
                border-color: #4a9eff;
                color: #fff;
            }
            
            .item-panel-stats {
                display: flex;
                gap: 20px;
                font-size: 13px;
                color: #aaa;
                flex-wrap: wrap;
            }
            
            .stat-type {
                color: #4a9eff;
                font-weight: 600;
            }
            
            /* Search */
            .item-panel-search-container {
                padding: 12px 15px;
                border-bottom: 1px solid #333;
                flex-shrink: 0;
            }
            
            .item-panel-search {
                width: 100%;
                padding: 10px 15px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .item-panel-search::placeholder {
                color: #888;
            }
            
            .item-panel-search:focus {
                outline: none;
                border-color: #4a9eff;
                box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
            }
            
            /* List Wrapper */
            .item-panel-list-wrapper {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-height: 0;
                overflow: hidden;
            }
            
            /* Scrollbars */
            .item-list-container::-webkit-scrollbar {
                width: 10px;
            }
            
            .item-list-container::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            
            .item-list-container::-webkit-scrollbar-thumb {
                background: #4a9eff;
                border-radius: 4px;
            }
            
            .item-list-container::-webkit-scrollbar-thumb:hover {
                background: #66b3ff;
            }
            
            /* Item List */
            .item-list-container {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 15px;
                box-sizing: border-box;
            }

            .item-list-item {
                display: flex;
                align-items: center;
                padding: 12px 15px;
                margin-bottom: 10px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid transparent;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                box-sizing: border-box;
                width: 100%;
                overflow: hidden;
            }
            
            .item-list-item:hover {
                background: rgba(74, 158, 255, 0.2);
                border-color: #4a9eff;
                transform: translateX(3px);
            }
            
            .item-sprite {
                width: var(--hs-inventory-item-size);
                height: var(--hs-inventory-item-size);
                background-position: 0rem 0rem;
                background-repeat: no-repeat;
                background-size: calc(var(--hs-url-inventory-items-width)) calc(var(--hs-url-inventory-items-height));
                background-image: var(--hs-url-inventory-items);
                border: 2px solid #555;
                border-radius: 8px;
                margin-right: 15px;
                flex-shrink: 0;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }
            
            .item-list-item:hover .item-sprite {
                border-color: #4a9eff;
            }
            
            /* NPC Sprites for Modal */
            .npc-sprite-modal {
                background-repeat: no-repeat;
                background-size: auto;
                border: 3px solid #4a9eff;
                border-radius: 12px;
                margin-right: 25px;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
                flex-shrink: 0;
                box-shadow: 0 4px 8px rgba(74, 158, 255, 0.3);
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            /* Fallback styles when SpritesheetManager not available */
            .npc-sprite-modal.npc-sprite-small {
                background-image: var(--hs-url-small-creature1);
                width: 64px;
                height: 64px;
            }
            
            .npc-sprite-modal.npc-sprite-medium {
                background-image: var(--hs-url-medium-creature1);
                width: 64px;
                height: 128px;
            }
            
            .npc-sprite-modal.npc-sprite-large {
                background-image: var(--hs-url-large-creature1);
                width: 128px;
                height: 128px;
            }
            
            .npc-sprite-modal.npc-sprite-largest {
                background-image: var(--hs-url-largest-creature1);
                width: 256px;
                height: 184px;
            }
            
            .npc-sprite-modal.npc-sprite-human {
                width: 64px;
                height: 128px;
            }
            
            .npc-sprite-modal.npc-sprite-unknown {
                width: 80px;
                height: 80px;
                background: rgba(255, 255, 255, 0.1);
                font-size: 48px;
                color: #666;
            }
            
            /* NPC Sprites for List */
            .npc-sprite-container {
                position: relative;
                width: var(--hs-inventory-item-size);
                height: var(--hs-inventory-item-size);
                flex-shrink: 0;
                border: 2px solid #555;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                overflow: hidden;
            }
            
            /* Wrapper to allow badge overflow */
            .npc-sprite-wrapper {
                position: relative;
                display: inline-block;
                margin-right: 15px;
            }
            
            .item-list-item:hover .npc-sprite-container {
                border-color: #4a9eff;
            }
            
            .npc-sprite {
                background-repeat: no-repeat;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
                font-size: 24px;
            }
            
            /* NPC sprite sizes based on creature type - fallback when SpritesheetManager not available */
            .npc-sprite-small {
                background-image: var(--hs-url-small-creature1);
                background-size: auto;
            }
            
            .npc-sprite-medium {
                background-image: var(--hs-url-medium-creature1);
                background-size: auto;
            }
            
            .npc-sprite-large {
                background-image: var(--hs-url-large-creature1);
                background-size: auto;
            }
            
            .npc-sprite-largest {
                background-image: var(--hs-url-largest-creature1);
                background-size: auto;
            }
            
            /* Human NPCs and unknown types */
            .npc-sprite-human,
            .npc-sprite-unknown {
                background: #f0f0f0;
                background-image: none;
                color: #333;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                position: relative;
            }
            
            .npc-level-badge {
                position: absolute;
                top: -8px;
                right: -8px;
                background: #ff4444;
                color: white;
                font-size: 11px;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 10px;
                border: 2px solid rgba(0, 0, 0, 0.5);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
                z-index: 10;
            }
            

            
            /* Info section */
            .item-info {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            
            .item-name {
                color: white;
                font-size: 16px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 4px;
            }
            
            .item-id {
                color: #999;
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .item-no-results, .item-loading {
                text-align: center;
                color: #666;
                padding: 30px;
                font-style: italic;
            }
            
            .item-loading p {
                margin: 10px 0;
                font-size: 16px;
            }
            
            .item-loading-hint {
                font-size: 14px !important;
                color: #555 !important;
            }
            
            /* Pagination */
            .pagination-container {
                padding: 12px;
                border-top: 1px solid #333;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 12px;
                flex-shrink: 0;
                background: rgba(0, 0, 0, 0.3);
            }
            
            .pagination-button {
                padding: 6px 12px;
                background: rgba(74, 158, 255, 0.2);
                border: 1px solid #4a9eff;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            
            .pagination-button:hover:not(:disabled) {
                background: rgba(74, 158, 255, 0.4);
            }
            
            .pagination-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .pagination-info {
                color: white;
                font-size: 14px;
                white-space: nowrap;
            }
            
            /* Modal Styles */
            .item-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(4px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .item-modal-container {
                background: rgba(16, 16, 16, 0.95);
                border: 2px solid #4a9eff;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(74, 158, 255, 0.5);
                width: 90%;
                max-width: 700px;
                max-height: 90vh;
                overflow: hidden;
                position: relative;
                animation: slideIn 0.3s ease-out;
            }
            
            @keyframes slideIn {
                from { 
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .item-modal-close {
                position: absolute;
                top: 15px;
                right: 15px;
                width: 36px;
                height: 36px;
                background: #ff4444;
                border: none;
                border-radius: 50%;
                color: white;
                font-size: 24px;
                font-weight: bold;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                z-index: 10;
                line-height: 1;
            }
            
            .item-modal-close:hover {
                background: #ff6666;
                transform: scale(1.1);
            }
            
            .item-modal-content {
                padding: 30px;
                overflow-y: auto;
                max-height: 90vh;
                color: white;
            }
            
            /* Modal scrollbar */
            .item-modal-content::-webkit-scrollbar {
                width: 10px;
            }
            
            .item-modal-content::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            
            .item-modal-content::-webkit-scrollbar-thumb {
                background: #4a9eff;
                border-radius: 4px;
            }
            
            .item-modal-content::-webkit-scrollbar-thumb:hover {
                background: #66b3ff;
            }
            
            /* Detail styles */
            .detail-error {
                color: #888;
                text-align: center;
                padding: 30px;
                font-size: 16px;
            }
            
            .detail-header {
                display: flex;
                align-items: flex-start;
                margin-bottom: 25px;
                padding-bottom: 25px;
                border-bottom: 1px solid #333;
            }
            
            .detail-sprite-large {
                width: var(--hs-inventory-item-size);
                height: var(--hs-inventory-item-size);
                background-position: 0rem 0rem;
                background-repeat: no-repeat;
                background-size: calc(var(--hs-url-inventory-items-width)) calc(var(--hs-url-inventory-items-height));
                background-image: var(--hs-url-inventory-items);
                border: 3px solid #4a9eff;
                border-radius: 12px;
                margin-right: 25px;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
                flex-shrink: 0;
                box-shadow: 0 4px 8px rgba(74, 158, 255, 0.3);
            }
            
            .detail-title {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            
            .detail-title h2 {
                margin: 0;
                color: white;
                font-size: 28px;
                margin-bottom: 8px;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .detail-id {
                color: #aaa;
                font-size: 18px;
                margin: 0;
            }
            
            .detail-level {
                color: #4a9eff;
                font-size: 16px;
                margin: 4px 0 0 0;
                font-weight: 600;
            }
            
            .detail-section {
                margin-bottom: 25px;
                background: rgba(255, 255, 255, 0.02);
                padding: 20px;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.05);
                overflow: hidden;
            }
            
            .detail-section h3 {
                color: #4a9eff;
                font-size: 20px;
                margin: 0 0 15px 0;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-weight: 600;
            }
            
            .detail-section p {
                margin: 0;
                line-height: 1.7;
                color: #ddd;
                word-wrap: break-word;
                font-size: 15px;
            }
            
            .detail-note {
                color: #aaa;
                font-style: italic;
            }
            
            .detail-cost {
                color: #ffd700 !important;
                font-size: 18px !important;
                font-weight: 600;
            }
            
            .detail-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .detail-list-item {
                color: #ddd;
                font-size: 15px;
                line-height: 1.5;
            }
            
            .detail-list-item.effect-positive {
                color: #4ecdc4;
            }
            
            /* Recipe Grid */
            .recipe-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 12px;
                margin-top: 10px;
            }
            
            .recipe-item {
                display: flex;
                align-items: center;
                padding: 10px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                overflow: hidden;
            }
            
            .recipe-item:hover {
                background: rgba(74, 158, 255, 0.2);
                border-color: #4a9eff;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(74, 158, 255, 0.3);
            }
            
            .recipe-item-sprite {
                width: calc(var(--hs-inventory-item-size));
                height: calc(var(--hs-inventory-item-size));
                background-position: 0rem 0rem;
                background-repeat: no-repeat;
                background-size: calc(var(--hs-url-inventory-items-width)) calc(var(--hs-url-inventory-items-height));
                background-image: var(--hs-url-inventory-items);
                border: 2px solid #555;
                border-radius: 6px;
                margin-right: 12px;
                flex-shrink: 0;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
            }
            
            .recipe-item:hover .recipe-item-sprite {
                border-color: #4a9eff;
            }
            
            .recipe-item-info {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            
            .recipe-item-name {
                color: white;
                font-size: 14px;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 2px;
            }
            
            .recipe-item-amount {
                color: #aaa;
                font-size: 13px;
                font-weight: 600;
            }
            
            /* Properties Grid */
            .detail-properties {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }
            
            .property {
                display: flex;
                justify-content: space-between;
                padding: 10px 15px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.08);
                overflow: hidden;
            }
            
            .property:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(74, 158, 255, 0.3);
            }
            
            .property-label {
                color: #999;
                font-size: 15px;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-right: 10px;
            }
            
            .property-value {
                color: white;
                font-size: 15px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .property-value.gold {
                color: #ffd700;
            }
            
            .property-value.yes {
                color: #4ecdc4;
            }
            
            .property-value.no {
                color: #ff6b6b;
            }
            
            /* Tags */
            .detail-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-bottom: 25px;
                padding: 15px;
                background: rgba(255, 255, 255, 0.02);
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .detail-tag {
                padding: 6px 14px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border: 1px solid;
            }
            
            .detail-tag.members {
                background: rgba(255, 165, 0, 0.2);
                color: #ffa500;
                border-color: rgba(255, 165, 0, 0.4);
            }
            
            .detail-tag.stackable {
                background: rgba(76, 175, 80, 0.2);
                color: #4caf50;
                border-color: rgba(76, 175, 80, 0.4);
            }
            
            .detail-tag.tradeable {
                background: rgba(33, 150, 243, 0.2);
                color: #2196f3;
                border-color: rgba(33, 150, 243, 0.4);
            }
            
            .detail-tag.noteable {
                background: rgba(156, 39, 176, 0.2);
                color: #9c27b0;
                border-color: rgba(156, 39, 176, 0.4);
            }
            
            .detail-tag.iou {
                background: rgba(244, 67, 54, 0.2);
                color: #f44336;
                border-color: rgba(244, 67, 54, 0.4);
            }
            
            .detail-tag.shopkeeper {
                background: rgba(255, 235, 59, 0.2);
                color: #ffeb3b;
                border-color: rgba(255, 235, 59, 0.4);
            }
            
            .detail-tag.pickpocket {
                background: rgba(121, 85, 72, 0.2);
                color: #8d6e63;
                border-color: rgba(121, 85, 72, 0.4);
            }
            
            .detail-tag.aggressive {
                background: rgba(229, 57, 53, 0.2);
                color: #e53935;
                border-color: rgba(229, 57, 53, 0.4);
            }
            
            .detail-tag.magic {
                background: rgba(156, 39, 176, 0.2);
                color: #9c27b0;
                border-color: rgba(156, 39, 176, 0.4);
            }
            
            .detail-tag.creature {
                background: rgba(121, 85, 72, 0.2);
                color: #8d6e63;
                border-color: rgba(121, 85, 72, 0.4);
            }
            
            .detail-tag.human {
                background: rgba(33, 150, 243, 0.2);
                color: #2196f3;
                border-color: rgba(33, 150, 243, 0.4);
            }
            
            .detail-tag.combat {
                background: rgba(255, 87, 34, 0.2);
                color: #ff5722;
                border-color: rgba(255, 87, 34, 0.4);
            }
            
            .detail-tag.peaceful {
                background: rgba(76, 175, 80, 0.2);
                color: #4caf50;
                border-color: rgba(76, 175, 80, 0.4);
            }
            
            /* Actions */
            .detail-actions {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            
            .action-button {
                padding: 12px 24px;
                background: rgba(74, 158, 255, 0.2);
                border: 2px solid #4a9eff;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                font-size: 16px;
                font-weight: 500;
                transition: all 0.2s;
                white-space: nowrap;
            }
            
            .action-button:hover {
                background: rgba(74, 158, 255, 0.4);
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(74, 158, 255, 0.3);
            }
            
            .action-button:active {
                transform: translateY(0);
                box-shadow: 0 2px 4px rgba(74, 158, 255, 0.3);
            }

            /* Loot Display Styles */
            .loot-subsection {
                margin-top: 20px;
            }

            .loot-subsection h4 {
                margin: 0 0 10px 0;
                color: #4a9eff;
                font-size: 16px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .loot-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                gap: 12px;
                margin-top: 12px;
            }

            .loot-item {
                display: flex;
                align-items: center;
                padding: 12px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                overflow: hidden;
            }

            .loot-item:hover {
                background: rgba(74, 158, 255, 0.2);
                border-color: #4a9eff;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(74, 158, 255, 0.3);
            }

            .loot-item.rare-loot {
                border-color: #ff6b35;
                background: rgba(255, 107, 53, 0.1);
            }

            .loot-item.rare-loot:hover {
                background: rgba(255, 107, 53, 0.2);
                border-color: #ff8c42;
                box-shadow: 0 4px 8px rgba(255, 107, 53, 0.3);
            }

            .loot-item.root-loot {
                border-color: #8bc34a;
                background: rgba(139, 195, 74, 0.1);
            }

            .loot-item.root-loot:hover {
                background: rgba(139, 195, 74, 0.2);
                border-color: #9ccc65;
                box-shadow: 0 4px 8px rgba(139, 195, 74, 0.3);
            }

            .loot-item.iou-item {
                border-left: 4px solid #ffc107;
            }

            .loot-item-sprite {
                width: calc(var(--hs-inventory-item-size));
                height: calc(var(--hs-inventory-item-size));
                background-position: 0rem 0rem;
                background-repeat: no-repeat;
                background-size: calc(var(--hs-url-inventory-items-width)) calc(var(--hs-url-inventory-items-height));
                background-image: var(--hs-url-inventory-items);
                border: 2px solid #555;
                border-radius: 6px;
                margin-right: 12px;
                flex-shrink: 0;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
            }

            .loot-item:hover .loot-item-sprite {
                border-color: #4a9eff;
            }

            .loot-item.rare-loot:hover .loot-item-sprite {
                border-color: #ff8c42;
            }

            .loot-item.root-loot:hover .loot-item-sprite {
                border-color: #9ccc65;
            }

            .loot-item-info {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }

            .loot-item-name {
                color: white;
                font-size: 14px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 3px;
            }

            .loot-item-amount {
                color: #4a9eff;
                font-size: 12px;
                font-weight: 500;
                margin-bottom: 3px;
            }

            .loot-item-odds {
                color: #ffc107;
                font-size: 12px;
                font-weight: 600;
            }

            .loot-special {
                padding: 15px;
                background: rgba(255, 193, 7, 0.1);
                border: 1px solid #ffc107;
                border-radius: 8px;
                margin-top: 12px;
            }

            .treasure-map-info {
                color: #ffc107;
                font-weight: 600;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .treasure-map-info::before {
                content: "🗺️";
                font-size: 16px;
            }

            /* NPC Drops Section (for item modals) */
            .npc-drops-container {
                max-height: 300px;
                overflow-y: auto;
                overflow-x: hidden;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.2);
                margin-top: 12px;
                padding: 12px;
            }

            .npc-drops-container::-webkit-scrollbar {
                width: 12px;
            }

            .npc-drops-container::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                margin: 2px;
            }

            .npc-drops-container::-webkit-scrollbar-thumb {
                background: #4a9eff;
                border-radius: 6px;
                border: 2px solid rgba(16, 16, 16, 0.95);
            }

            .npc-drops-container::-webkit-scrollbar-thumb:hover {
                background: #66b3ff;
            }

            /* Loot Drops Section (for NPC modals) - Main container for all drops */
            .drops-section-container {
                max-height: 400px;
                overflow-y: auto;
                overflow-x: hidden;
                padding-right: 8px;
                margin-top: 12px;
            }

            .drops-section-container::-webkit-scrollbar {
                width: 12px;
            }

            .drops-section-container::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                margin: 2px;
            }

            .drops-section-container::-webkit-scrollbar-thumb {
                background: #4a9eff;
                border-radius: 6px;
                border: 2px solid rgba(16, 16, 16, 0.95);
            }

            .drops-section-container::-webkit-scrollbar-thumb:hover {
                background: #66b3ff;
            }

            /* Remove individual loot grid scrolling */
            .loot-grid {
                max-height: none !important;
                overflow: visible !important;
            }

            .npc-drop-item {
                display: flex;
                align-items: center;
                padding: 12px;
                margin-bottom: 10px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                overflow: hidden;
            }

            .npc-drop-item:last-child {
                margin-bottom: 0;
            }

            .npc-drop-item:hover {
                background: rgba(74, 158, 255, 0.2);
                border-color: #4a9eff;
                transform: translateX(3px);
                box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);
            }

            .npc-drop-sprite-wrapper {
                position: relative;
                margin-right: 15px;
                flex-shrink: 0;
            }

            .npc-drop-sprite {
                width: 48px;
                height: 48px;
                border: 2px solid #555;
                border-radius: 6px;
                background-repeat: no-repeat;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                overflow: hidden;
                position: relative;
            }

            /* Scaled sprite containers for different creature sizes in drops */
            .npc-drop-sprite.npc-sprite-small .sprite-content {
                width: 64px;
                height: 64px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.75);
                transform-origin: center center;
            }

            .npc-drop-sprite.npc-sprite-medium .sprite-content {
                width: 64px;
                height: 128px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.375);
                transform-origin: center center;
            }

            .npc-drop-sprite.npc-sprite-large .sprite-content {
                width: 128px;
                height: 128px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.375);
                transform-origin: center center;
            }

            .npc-drop-sprite.npc-sprite-largest .sprite-content {
                width: 256px;
                height: 184px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.1875);
                transform-origin: center center;
            }

            .npc-drop-sprite.npc-sprite-small {
                background-image: var(--hs-url-small-creature1);
            }

            .npc-drop-sprite.npc-sprite-medium {
                background-image: var(--hs-url-medium-creature1);
            }

            .npc-drop-sprite.npc-sprite-large {
                background-image: var(--hs-url-large-creature1);
            }

            .npc-drop-sprite.npc-sprite-largest {
                background-image: var(--hs-url-largest-creature1);
            }

            .npc-drop-sprite.npc-sprite-human {
                background-color: #f0f0f0;
                color: #666;
            }

            .npc-drop-sprite.npc-sprite-unknown {
                background-color: rgba(255, 255, 255, 0.1);
                color: #999;
                font-size: 24px;
            }

            .npc-drop-item:hover .npc-drop-sprite {
                border-color: #4a9eff;
            }

            .npc-drop-level-badge {
                position: absolute;
                top: -6px;
                right: -6px;
                background: #4a9eff;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                border: 2px solid rgba(16, 16, 16, 0.95);
                z-index: 10;
            }

            .npc-drop-info {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }

            .npc-drop-name {
                color: white;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 6px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .npc-drop-details {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            .npc-drop-type {
                font-size: 13px;
                font-weight: 500;
                padding: 2px 6px;
                border-radius: 4px;
                display: inline-block;
                max-width: fit-content;
            }

            .npc-drop-type.guaranteed {
                background: rgba(76, 175, 80, 0.2);
                color: #4caf50;
                border: 1px solid rgba(76, 175, 80, 0.4);
            }

            .npc-drop-type.regular {
                background: rgba(33, 150, 243, 0.2);
                color: #2196f3;
                border: 1px solid rgba(33, 150, 243, 0.4);
            }

            .npc-drop-type.rare {
                background: rgba(255, 107, 53, 0.2);
                color: #ff6b35;
                border: 1px solid rgba(255, 107, 53, 0.4);
            }

            .npc-drop-type.root {
                background: rgba(139, 195, 74, 0.2);
                color: #8bc34a;
                border: 1px solid rgba(139, 195, 74, 0.4);
            }
        `;
        document.head.appendChild(style);
    }

    stop(): void {
        this.log('Definitions Panel stopped');

        // Close any open modal
        this.closeModal();

        // Clean up all sprite references
        this.cleanupAllSprites();

        // Remove menu item
        this.panelManager.removeMenuItem('📦');

        // Remove styles
        const style = document.querySelector('style[data-item-panel]');
        if (style) {
            style.remove();
        }

        // Remove global reference
        if ((window as any).highliteItemPanel === this) {
            delete (window as any).highliteItemPanel;
        }

        // Clear all data arrays
        this.allItems = [];
        this.filteredItems = [];
        this.allNpcs = [];
        this.filteredNpcs = [];
        this.lootData = null;

        // Reset states
        this.itemsLoaded = false;
        this.npcsLoaded = false;
        this.isLoggedIn = false;
        this.currentPage = 0;
        this.selectedItemId = null;
        this.currentView = 'items';

        // Clear DOM references
        this.panelContent = null;
        this.itemListContainer = null;
        this.searchInput = null;
        this.modalOverlay = null;
        this.itemToggle = null;
        this.npcToggle = null;

        // Clear sprite tracking maps
        this.spriteReferences.clear();
        this.spriteContexts.clear();
        this.activeSpriteUrls.clear();
    }
}
