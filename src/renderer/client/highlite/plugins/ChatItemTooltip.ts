import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";

/**
 * ChatItemTooltip plugin
 * Detects occurrences of [###] in chat messages and turns them into clickable spans that
 */
export class ChatItemTooltip extends Plugin {
    pluginName = "Chat Item Tooltip";

    private processedIds: Set<number> = new Set();
    private tooltipEl: HTMLDivElement | null = null;
    private currentItemId: number | null = null;
    private isCtrlPressed: boolean = false;
    private inventoryOverlays: HTMLDivElement[] = [];
    private overlaysCreated: boolean = false;

    constructor() {
        super();
        
        this.settings.enabled = {
            text: "Enable Chat Item Tooltips",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {
                if (this.settings.enabled.value) {
                    this.initializePlugin();
                } else {
                    this.disablePlugin();
                }
            }
        } as any;

        this.settings.enableInventoryLinking = {
            text: "Enable Inventory Item Linking",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {}
        } as any;

        this.settings.showItemName = {
            text: "Show Item Names",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {}
        } as any;

        this.settings.showDebug = {
            text: "Tooltip Debug",
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {
                if (this.settings.showDebug.value) this.createDebug(); else this.removeDebug();
            }
        } as any;
    }

    start(): void {
        this.addCSSStyles();
        this.addEventListeners();
    }

    init(): void {
        this.log("ChatItemTooltip initialised");
    }

    SocketManager_loggedIn(): void {
        this.ensureTooltip();
    }

    GameLoop_draw() {
        if (!this.settings.enabled?.value) return;
        this.scanChat();
        this.updateDebug();
    }

    private scanChat() {
        const chatList: any[] = (document as any).highlite?.gameHooks?.HR?.Manager?.getController()?.ChatMenuController?._chatMenuQuadrant?.getChatMenu()?.getChatMessages();
        if (!chatList) return;

        for (const msgObj of chatList) {
            const id: number = msgObj._id;
            if (this.processedIds.has(id)) continue;
            this.processedIds.add(id);
            this.processMessage(msgObj);
        }
    }

    private processMessage(msgObj: any) {
        const container: HTMLElement = msgObj._container || msgObj._message?._span?.parentElement;
        if (!container) return;

        const regex = /\[(\d+)\]/g;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        const textNodes: Text[] = [];
        while (walker.nextNode()) {
            const tn = walker.currentNode as Text;
            if (regex.test(tn.data)) textNodes.push(tn);
        }

        textNodes.forEach(tn => {
            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            tn.data.replace(regex, (match, num: string, offset) => {
                if (offset > lastIndex) {
                    frag.appendChild(document.createTextNode(tn.data.slice(lastIndex, offset)));
                }

                const id = parseInt(num, 10);
                let displayText = match;
                
                try {
                    const itemDef = (document as any).highlite.gameHooks.ItemDefMap.ItemDefMap.get(id);
                    if (itemDef && itemDef.Name) {
                        displayText = `[${itemDef.Name}]`;
                    }
                } catch (error) {
                    this.log(`Error getting item name for ID ${id}: ${error}`);
                }

                const span = document.createElement('span');
                span.className = 'hs-item-link';
                span.dataset.itemId = num;
                span.textContent = displayText;
                span.style.cursor = 'pointer';
                span.style.color = '#4a9eff';
                span.style.textDecoration = 'underline';
                span.style.textDecorationStyle = 'dotted';
                
                span.addEventListener('mouseenter', (e) => this.showTooltip(span, e));
                span.addEventListener('mouseleave', () => this.hideTooltip());
                span.addEventListener('mousemove', (e) => this.updateTooltipPosition(e));
                frag.appendChild(span);

                lastIndex = offset + match.length;
                return match;
            });
            if (lastIndex < tn.data.length) {
                frag.appendChild(document.createTextNode(tn.data.slice(lastIndex)));
            }

            tn.parentNode?.replaceChild(frag, tn);
        });
    }

    private addCSSStyles() {
        const style = document.createElement('style');
        style.setAttribute('data-chat-tooltip', 'true');
        style.textContent = `
            .hs-item-tooltip {
                background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
                border: 2px solid #4a9eff;
                border-radius: 8px;
                padding: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
                font-family: 'Arial', sans-serif;
                font-size: 12px;
                max-width: 250px;
                min-width: 200px;
            }
            
            .hs-inventory-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(74, 158, 255, 0.3);
                border: 2px solid #4a9eff;
                border-radius: 4px;
                cursor: pointer;
                z-index: 1000;
                display: none;
                pointer-events: none;
            }
            
            .hs-inventory-overlay.show {
                display: block;
                pointer-events: all;
            }
            
            .hs-inventory-overlay:hover {
                background: rgba(74, 158, 255, 0.5);
            }
            
            .hs-inventory-overlay::after {
                content: '🔗';
                position: absolute;
                top: 2px;
                right: 2px;
                font-size: 12px;
                color: #4a9eff;
                text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
            }
            
            .hs-item-tooltip-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
                gap: 8px;
            }
            
            .hs-item-tooltip-sprite {
                background-position: 0rem 0rem;
                background-repeat: no-repeat;
                background-size: var(--hs-url-inventory-items-width) var(--hs-url-inventory-items-height);
                background-image: var(--hs-url-inventory-items);
                height: var(--hs-inventory-item-size);
                width: var(--hs-inventory-item-size);
                border: 1px solid #555;
                border-radius: 4px;
                flex-shrink: 0;
            }
            
            .hs-item-tooltip-title {
                flex: 1;
            }
            
            .hs-item-tooltip-name {
                color: #ffffff;
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 2px;
            }
            
            .hs-item-tooltip-id {
                color: #888;
                font-size: 10px;
            }
            
            .hs-item-tooltip-description {
                color: #cccccc;
                font-style: italic;
                margin-bottom: 6px;
                line-height: 1.3;
            }
            
            .hs-item-tooltip-section {
                margin-bottom: 4px;
                font-size: 11px;
            }
            
            .hs-item-tooltip-label {
                color: #aaaaaa;
                font-weight: bold;
            }
            
            .hs-item-tooltip-value {
                color: #ffffff;
            }
            
            .hs-item-tooltip-cost {
                color: #ffd700;
                font-weight: bold;
            }
            
            .hs-item-tooltip-requirement {
                color: #ff6b6b;
                font-size: 10px;
            }
            
            .hs-item-tooltip-effect {
                color: #4ecdc4;
                font-size: 10px;
            }
            
            .hs-item-tooltip-tags {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
                margin-top: 6px;
            }
            
            .hs-item-tooltip-tag {
                background: #333;
                color: #ccc;
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 9px;
            }
            
            .hs-item-tooltip-tag.members {
                background: #4a9eff;
                color: white;
            }
            
            .hs-item-tooltip-tag.stackable {
                background: #2ecc71;
                color: white;
            }
            
            .hs-item-tooltip-tag.tradeable {
                background: #f39c12;
                color: white;
            }
            
            .hs-item-tooltip-tag.iou {
                background: #ffd700;
                color: black;
            }
            
            .hs-item-link:hover {
                color: #66b3ff !important;
                text-shadow: 0 0 2px #4a9eff;
            }
        `;
        document.head.appendChild(style);
    }

    private ensureTooltip() {
        if (this.tooltipEl) return;
        
        const screenMask = document.getElementById('hs-screen-mask');        
        this.tooltipEl = document.createElement('div');
        this.tooltipEl.className = 'hs-item-tooltip';
        this.tooltipEl.style.position = 'fixed';
        this.tooltipEl.style.pointerEvents = 'none';
        this.tooltipEl.style.zIndex = '20000';
        this.tooltipEl.style.display = 'none';
        
        const container = screenMask || document.body;
        container.appendChild(this.tooltipEl);
    }

    private showTooltip(anchor: HTMLElement, event?: MouseEvent) {
        const idStr = anchor.dataset.itemId;
        if (!idStr) return;
        const id = parseInt(idStr, 10);
        if (isNaN(id)) return;

        this.currentItemId = id;

        let itemDef: any = null;
        try {
            itemDef = (document as any).highlite.gameHooks.ItemDefMap.ItemDefMap.get(id);
        } catch (error) {
            this.log(`Error getting item definition for ID ${id}: ${error}`);
        }

        if (!itemDef) {
            this.log(`No item definition found for ID ${id}`);
            return;
        }

        if (!this.tooltipEl) return;
        this.tooltipEl.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'hs-item-tooltip-header';

        const spriteDiv = document.createElement('div');
        spriteDiv.className = 'hs-item-tooltip-sprite';
        
        try {
            const pos = (document as any).highlite.gameHooks.ItemSpriteManager.getCSSBackgroundPositionForItem(id);
            if (pos) {
                spriteDiv.style.backgroundPosition = pos;
            }
        } catch (error) {
            this.log(`Error getting item sprite for ID ${id}: ${error}`);
        }
        
        header.appendChild(spriteDiv);

        const titleDiv = document.createElement('div');
        titleDiv.className = 'hs-item-tooltip-title';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'hs-item-tooltip-name';
        nameDiv.textContent = itemDef.NameCapitalized || itemDef.Name || `Item ${id}`;
        titleDiv.appendChild(nameDiv);

        const idDiv = document.createElement('div');
        idDiv.className = 'hs-item-tooltip-id';
        idDiv.textContent = `ID: ${id}`;
        titleDiv.appendChild(idDiv);

        header.appendChild(titleDiv);
        this.tooltipEl.appendChild(header);

        if (itemDef.Description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'hs-item-tooltip-description';
            descDiv.textContent = itemDef.Description;
            this.tooltipEl.appendChild(descDiv);
        }

        if (itemDef.Cost && itemDef.Cost > 0) {
            const costSection = document.createElement('div');
            costSection.className = 'hs-item-tooltip-section';
            costSection.innerHTML = `<span class="hs-item-tooltip-label">Cost:</span> <span class="hs-item-tooltip-cost">${itemDef.Cost.toLocaleString()} coins</span>`;
            this.tooltipEl.appendChild(costSection);
        }

        if (itemDef.EquippableRequirements && itemDef.EquippableRequirements.length > 0) {
            const reqSection = document.createElement('div');
            reqSection.className = 'hs-item-tooltip-section';
            reqSection.innerHTML = '<span class="hs-item-tooltip-label">Requirements:</span>';
            
            itemDef.EquippableRequirements.forEach((req: any) => {
                const reqDiv = document.createElement('div');
                reqDiv.className = 'hs-item-tooltip-requirement';
                reqDiv.textContent = `• Level ${req.Amount} ${this.getSkillName(req.Skill)}`;
                reqSection.appendChild(reqDiv);
            });
            
            this.tooltipEl.appendChild(reqSection);
        }

        if (itemDef.EquippableEffects && itemDef.EquippableEffects.length > 0) {
            const effectSection = document.createElement('div');
            effectSection.className = 'hs-item-tooltip-section';
            effectSection.innerHTML = '<span class="hs-item-tooltip-label">Effects:</span>';
            
            itemDef.EquippableEffects.forEach((effect: any) => {
                const effectDiv = document.createElement('div');
                effectDiv.className = 'hs-item-tooltip-effect';
                const sign = effect.Amount > 0 ? '+' : '';
                effectDiv.textContent = `• ${sign}${effect.Amount} ${this.getSkillName(effect.Skill)}`;
                effectSection.appendChild(effectDiv);
            });
            
            this.tooltipEl.appendChild(effectSection);
        }

        if (itemDef.WeaponSpeed && itemDef.WeaponSpeed > 0) {
            const speedSection = document.createElement('div');
            speedSection.className = 'hs-item-tooltip-section';
            speedSection.innerHTML = `<span class="hs-item-tooltip-label">Attack Speed:</span> <span class="hs-item-tooltip-value">${itemDef.WeaponSpeed}</span>`;
            this.tooltipEl.appendChild(speedSection);
        }

        if (itemDef.EquipmentType !== null && itemDef.EquipmentType !== undefined) {
            const typeSection = document.createElement('div');
            typeSection.className = 'hs-item-tooltip-section';
            typeSection.innerHTML = `<span class="hs-item-tooltip-label">Type:</span> <span class="hs-item-tooltip-value">${this.getEquipmentTypeName(itemDef.EquipmentType)}</span>`;
            this.tooltipEl.appendChild(typeSection);
        }

        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'hs-item-tooltip-tags';

        if (itemDef.IsMembers) {
            const tag = document.createElement('span');
            tag.className = 'hs-item-tooltip-tag members';
            tag.textContent = 'Members';
            tagsDiv.appendChild(tag);
        }

        if (itemDef.IsStackable) {
            const tag = document.createElement('span');
            tag.className = 'hs-item-tooltip-tag stackable';
            tag.textContent = 'Stackable';
            tagsDiv.appendChild(tag);
        }

        if (itemDef.IsTradeable) {
            const tag = document.createElement('span');
            tag.className = 'hs-item-tooltip-tag tradeable';
            tag.textContent = 'Tradeable';
            tagsDiv.appendChild(tag);
        }

        if (itemDef.CanIOU) {
            const tag = document.createElement('span');
            tag.className = 'hs-item-tooltip-tag iou';
            tag.textContent = 'IOU';
            tagsDiv.appendChild(tag);
        }

        if (tagsDiv.children.length > 0) {
            this.tooltipEl.appendChild(tagsDiv);
        }

        this.tooltipEl.style.display = 'block';
        
        if (event) {
            this.updateTooltipPosition(event);
        }
    }

    private getSkillName(skillId: number): string {
        return (document as any).highlite.gameLookups.Skills[skillId];
    }

    private getEquipmentTypeName(typeId: number): string {
        return (document as any).highlite.gameLookups.EquipmentTypes[typeId];
    }

    private updateTooltipPosition(event: MouseEvent) {
        if (!this.tooltipEl || this.tooltipEl.style.display === 'none') return;

        const tooltip = this.tooltipEl;
        const margin = 10;
        
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        let x = event.clientX + margin;
        let y = event.clientY - tooltipRect.height - margin;
        
        if (x + tooltipRect.width > viewportWidth) {
            x = event.clientX - tooltipRect.width - margin;
        }
        
        if (y < 0) {
            y = event.clientY + margin;
        }
        
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }

    private hideTooltip() {
        if (this.tooltipEl) {
            this.tooltipEl.style.display = 'none';
        }
        this.currentItemId = null;
    }

    stop(): void {
        if (this.tooltipEl && this.tooltipEl.parentElement) {
            this.tooltipEl.parentElement.removeChild(this.tooltipEl);
            this.tooltipEl = null;
        }
        this.removeDebug();
        this.cleanupInventoryOverlays();
    }

    private debugEl: HTMLDivElement | null = null;
    
    private createDebug() {
        if (this.debugEl) return;
        this.debugEl = document.createElement('div');
        Object.assign(this.debugEl.style, {
            position: 'fixed',
            bottom: '10px',
            left: '10px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#00ff00',
            padding: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            zIndex: '30000',
            borderRadius: '4px',
            border: '1px solid #333',
            maxWidth: '250px'
        });
        document.body.appendChild(this.debugEl);
    }
    
    private removeDebug() {
        if (this.debugEl) {
            this.debugEl.remove();
            this.debugEl = null;
        }
    }
    
    private updateDebug() {
        if (!this.debugEl) return;
        
        const chatList: any[] = (document as any).highlite?.gameHooks?.HR?.Manager?.getController()?.ChatMenuController?._chatMenuQuadrant?.getChatMenu()?.getChatMessages();
        
        let currentItemInfo = 'none';
        if (this.currentItemId) {
            try {
                const itemDef = (document as any).highlite?.gameHooks?.ItemDefMap?.ItemDefMap?.get(this.currentItemId);
                if (itemDef) {
                    currentItemInfo = `${this.currentItemId} (${itemDef.NameCapitalized || itemDef.Name})`;
                } else {
                    currentItemInfo = `${this.currentItemId} (not found)`;
                }
            } catch (error) {
                currentItemInfo = `${this.currentItemId} (error)`;
            }
        }
        
        let inventoryItemCount = 0;
        try {
            const inventoryItems = (document as any).highlite?.gameHooks?.EntityManager?.Instance?.MainPlayer?.Inventory?.Items;
            if (inventoryItems) {
                inventoryItemCount = inventoryItems.filter((item: any) => item && item._def).length;
            }
        } catch (error) {
        }
        
        const debugInfo = [
            `ChatItemTooltip Debug`,
            `Enabled: ${this.settings.enabled?.value}`,
            `Inventory Linking: ${this.settings.enableInventoryLinking?.value}`,
            `Ctrl Pressed: ${this.isCtrlPressed}`,
            `Overlays Created: ${this.overlaysCreated}`,
            `Inventory Items: ${inventoryItemCount}`,
            `Active Overlays: ${this.inventoryOverlays.length}`,
            `Chat Messages: ${chatList?.length || 0}`,
            `Processed IDs: ${this.processedIds.size}`,
            `Current Item: ${currentItemInfo}`,
            `Tooltip Visible: ${this.tooltipEl?.style.display !== 'none'}`,
            `Container: ${this.tooltipEl?.parentElement?.id || 'none'}`
        ].join('\n');
        
        this.debugEl.textContent = debugInfo;
    }

    private addEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Control' && this.settings.enableInventoryLinking?.value && !this.isCtrlPressed) {
                this.isCtrlPressed = true;
                this.showInventoryOverlays();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control' && this.isCtrlPressed) {
                this.isCtrlPressed = false;
                this.hideInventoryOverlays();
            }
        });
    }

    private showInventoryOverlays() {
        if (this.overlaysCreated) return;
        
        this.overlaysCreated = true;
        
        const inventoryCells = document.querySelectorAll('.hs-item-table__cell[data-slot]');
        
        inventoryCells.forEach((cell) => {
            const slotAttr = cell.getAttribute('data-slot');
            if (slotAttr === null) return;
            
            const slotIndex = parseInt(slotAttr, 10);
            if (isNaN(slotIndex)) return;
            
            try {
                const inventoryItems = (document as any).highlite.gameHooks.EntityManager.Instance.MainPlayer.Inventory.Items;
                const item = inventoryItems[slotIndex];
                
                if (item && item._def) {
                    this.createInventoryOverlay(cell as HTMLElement, slotIndex);
                }
            } catch (error) {
            }
        });
    }

    private hideInventoryOverlays() {
        this.cleanupInventoryOverlays();
        this.overlaysCreated = false;
    }

    private createInventoryOverlay(inventoryCell: HTMLElement, slotIndex: number) {
        const overlay = document.createElement('div');
        overlay.className = 'hs-inventory-overlay show';
        
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.zIndex = '1000';
        
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleInventoryItemClick(slotIndex);
        });
                
        const cellStyle = getComputedStyle(inventoryCell);
        if (cellStyle.position === 'static') {
            inventoryCell.style.position = 'relative';
        }
        
        inventoryCell.appendChild(overlay);
        this.inventoryOverlays.push(overlay);
    }

    private handleInventoryItemClick(slotIndex: number) {
        try {
            const inventoryItems = (document as any).highlite.gameHooks.EntityManager.Instance.MainPlayer.Inventory.Items;
            
            const item = inventoryItems[slotIndex];
            
            if (!item || !item._def) {
                return;
            }
            
            const itemId = item._def._id;            
            this.addItemToChatInput(itemId);
        } catch (error) {
        }
    }

    private addItemToChatInput(itemId: number) {
        try {
            const chatController = (document as any).highlite.gameHooks.HR.Manager.getController().ChatMenuController;            
            const chatInput = chatController._chatMenuQuadrant.getChatMenu().getChatInputMenu().getChatInput();            
            const currentValue = chatInput.getInputValue();            
            const newValue = currentValue + (currentValue ? ' ' : '') + `[${itemId}]`;            
            chatInput.setInputValue(newValue);
        } catch (error) {
            this.log(`Error adding item to chat input: ${error}`);
            if (error instanceof Error) {
                this.log(`Error stack:`, error.stack);
            }
        }
    }

    private cleanupInventoryOverlays() {
        this.inventoryOverlays.forEach(overlay => {
            if (overlay && overlay.parentElement) {
                overlay.parentElement.removeChild(overlay);
            }
        });
        this.inventoryOverlays = [];
    }

    private initializePlugin() {
        this.processedIds.clear();
        this.ensureTooltip();
        if (!document.querySelector('style[data-chat-tooltip]')) {
            this.addCSSStyles();
        }
    }

    private disablePlugin() {
        this.hideTooltip();
        this.hideInventoryOverlays();
        this.removeDebug();
    }
} 