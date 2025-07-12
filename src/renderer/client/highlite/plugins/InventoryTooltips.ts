import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';
import { UIManager, UIManagerScope } from '../core/managers/highlite/uiManager';

export class InventoryTooltips extends Plugin {
    pluginName = 'Inventory Tooltips';
    author = 'Valsekamerplant';
    private uiManager = new UIManager();
    tooltipUI: HTMLElement | null = null;
    tooltip: HTMLElement | null = null;
    tooltipStyle: HTMLStyleElement | null = null;
    bonusArray;

    /**
     * Handler for mousemove events to update tooltip position to follow the mouse.
     */
    private mouseMoveHandler: ((event: MouseEvent) => void) | null = null;

    /**
     * Plugin setting to enable/disable inventory tooltips.
     */
    constructor() {
        super();

        this.settings.enabled = {
            text: 'Enable Chat Item Tooltips',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {
                if (this.settings.enabled.value) {
                    this.start();
                } else {
                    this.stop();
                }
            },
        } as any;
    }

    /**
     * Initializes the plugin (called once on load).
     */
    init(): void {
        this.log('InventoryTooltip initialised');
    }

    /**
     * Starts the plugin, adds styles and event listeners.
     */
    start() {
        this.addPluginStyle();
        this.bonusArray = this.gameLookups['Skills'];
        document.addEventListener('mouseenter', this.onMouseOver, true);
        document.addEventListener('mouseout', this.onMouseOut, true);
    }

    /**
     * Stops the plugin, removes event listeners and tooltip.
     */
    stop() {
        document.removeEventListener('mouseenter', this.onMouseOver, true);
        document.removeEventListener('mouseout', this.onMouseOut, true);
        this.removeTooltip();
    }

    /**
     * Mouse enter handler for inventory slots. Shows tooltip for hovered item.
     * @param event MouseEvent
     */
    onMouseOver = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target || typeof target.closest !== 'function') return;

        const itemEl = target.closest(
            '.hs-item-table--inventory .hs-item-table__cell'
        );
        if (!itemEl) return;
        // Get the slot ID from the element
        const slotIdStr = itemEl.getAttribute('data-slot');
        if (!slotIdStr) return;
        const slotId = parseInt(slotIdStr, 10);
        const inventoryItems =
            this.gameHooks.EntityManager.Instance.MainPlayer.Inventory.Items;
        const item = inventoryItems[slotId];
        if (!item) return;
        this.showTooltip(event, item._def);
    };

    /**
     * Mouse leave handler for inventory slots. Removes tooltip.
     * @param event MouseEvent
     */
    onMouseOut = (event: MouseEvent) => {
        this.removeTooltip();
    };

    /**
     * Creates and displays the tooltip for the hovered inventory item.
     * Tooltip follows the mouse and adapts position to stay on screen.
     * @param event MouseEvent
     * @param itemDef Item definition object
     */
    showTooltip(event: MouseEvent, itemDef: any) {
        this.removeTooltip();

        this.tooltipUI = this.uiManager.createElement(
            UIManagerScope.ClientInternal
        );
        this.addPluginStyle();
        const mainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;
        const bonuses = itemDef._equippableEffects || [];
        let bonusText = '';
        const mainPlayerEquip = mainPlayer._loadout._items || [];
        // Get currently equipped item for this equipment type
        const equippedItem = mainPlayerEquip[itemDef._equipmentType];
        const equippedEffects = equippedItem?._def._equippableEffects || [];

        // Track which skills are present in hovered item
        const hoveredSkills = new Set<number>(
            bonuses.map((b: any) => b._skill)
        );

        // Show all bonuses from hovered item, comparing to equipped
        for (const bonus of bonuses) {
            const equippedBonus = equippedEffects.find(
                (e: any) => e._skill === bonus._skill
            );
            let diff: number;
            if (equippedBonus) {
                diff = bonus._amount - equippedBonus._amount;
            } else {
                diff = bonus._amount;
            }
            bonusText += `${this.getSkillName(bonus._skill)}: <span class="hlt-tooltip-bonus ${diff > 0 ? 'hlt-tooltip-positive' : diff < 0 ? 'hlt-tooltip-negative' : ''}">${diff > 0 ? '+' : ''}${diff}</span><br>`;
        }

        // Show bonuses that are only on equipped item (not on hovered item) as a loss
        for (const equippedBonus of equippedEffects) {
            if (!hoveredSkills.has(equippedBonus._skill)) {
                // The hovered item does not have this bonus, so you lose it
                const diff = -equippedBonus._amount;
                bonusText += `${this.getSkillName(equippedBonus._skill)}: <span class="hlt-tooltip-bonus ${diff < 0 ? 'hlt-tooltip-negative' : diff > 0 ? 'hlt-tooltip-positive' : ''}">${diff}</span><br>`;
            }
        }

        // Edible effect display with heal color logic
        const consumableBonuses = itemDef._edibleEffects || [];
        let edibleText = '';
        if (consumableBonuses.length > 0) {
            const currentHp = mainPlayer._hitpoints?._currentLevel ?? 0;
            const maxHp = mainPlayer._hitpoints?._level ?? 0;
            for (const bonus of consumableBonuses) {
                bonusText += `${
                    bonus._skill === 0
                        ? 'Heals for'
                        : this.getSkillName(bonus._skill)
                }: <span class="hlt-tooltip-bonus ${
                    bonus._skill === 0 && currentHp + bonus._amount > maxHp
                        ? 'hlt-tooltip-edible-heal-over'
                        : 'hlt-tooltip-edible-heal-normal'
                }">${bonus._amount}</span><br>`;
            }
        }
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'hlt-tooltip';
        this.tooltip.style.left = `${event.clientX + 10}px`;
        this.tooltip.style.top = `${event.clientY + 10}px`;
        this.tooltip.innerHTML = `
        <strong class="hlt-tooltip-title">${itemDef._name}</strong>
        ${bonusText}
        ${edibleText}
    `;
        //document.body.appendChild(tooltip);
        this.tooltipUI?.appendChild(this.tooltip);

        // Initial position
        this.updateTooltipPosition(event);

        // Mouse move handler to follow the mouse
        this.mouseMoveHandler = (moveEvent: MouseEvent) => {
            this.updateTooltipPosition(moveEvent);
        };

        document.addEventListener('mousemove', this.mouseMoveHandler);
    }

    /**
     * Removes the tooltip and mousemove event listener.
     */
    removeTooltip() {
        if (this.mouseMoveHandler) {
            document.removeEventListener('mousemove', this.mouseMoveHandler);
            this.mouseMoveHandler = null;
        }

        if (this.tooltipUI) {
            this.tooltipUI.remove();
            this.tooltipUI = null;
        }
    }

    /**
     * Returns the skill name for a given skill ID.
     * @param skillId Skill ID
     * @returns Skill name or fallback string
     */
    getSkillName(skillId: number): string {
        return this.bonusArray[skillId] ?? `Skill ${skillId}`;
    }

    /**
     * Injects the plugin's tooltip CSS styles into the document head.
     */
    private addPluginStyle(): void {
        this.tooltipStyle = document.createElement('style');
        this.tooltipStyle.setAttribute('data-item-panel', 'true');
        this.tooltipStyle.textContent = `
          .hlt-tooltip {
            position: fixed;
            background: rgba(30, 30, 40, 0.97);
            color: #fff;
            padding: 8px 12px;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.5);
            z-index: 9999;
            font-family: inherit;
            pointer-events: none;
            max-width: 320px;
            font-size: 14px;
          }
          .hlt-tooltip-title {
            font-weight: bold;
            font-size: 15px;
            display: block;
          }
          .hlt-tooltip-bonus {
            font-weight: bold;
          }
          .hlt-tooltip-positive {
            color: #7fff7f;
          }
          .hlt-tooltip-negative {
            color: #ff7f7f;
          }
          .hlt-tooltip-edible {
            color: #ffe97f;
            font-size: 13px;
            font-style: italic;
          }
          .hlt-tooltip-edible-heal {
            font-weight: bold;
            margin-left: 6px;
          }
          .hlt-tooltip-edible-heal-normal {
            color: #7fff7f;
          }
          .hlt-tooltip-edible-heal-over {
            color: #ffe97f;
          }
        `;
        this.tooltipUI?.appendChild(this.tooltipStyle);
    }

    /**
     * Updates the tooltip position to follow the mouse and stay within the viewport.
     * @param event MouseEvent
     */
    private updateTooltipPosition(event: MouseEvent) {
        this.log(this.tooltip);
        if (this.tooltip) {
            console.log('Updating tooltip position');
            const tooltipRect = this.tooltip.getBoundingClientRect();
            const padding = 5;
            let left = event.clientX + padding;
            let top = event.clientY + padding;

            // Get viewport dimensions
            const viewportWidth = window.innerWidth - 24;
            const viewportHeight = window.innerHeight - 20;

            // If tooltip would go off right edge, show to the left
            if (left + tooltipRect.width > viewportWidth) {
                left = event.clientX - tooltipRect.width - padding;
            }

            // If tooltip would go off bottom edge, show above
            if (top + tooltipRect.height > viewportHeight) {
                top = event.clientY - tooltipRect.height - padding;
            }

            // Prevent negative positions
            left = Math.max(left, padding);
            top = Math.max(top, padding);
            console.log('Tooltip Position:', left, top);
            this.tooltip.style.left = `${left}px`;
            this.tooltip.style.top = `${top}px`;
        }
    }
}
