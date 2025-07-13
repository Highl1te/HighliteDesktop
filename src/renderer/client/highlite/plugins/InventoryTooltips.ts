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
            text: 'Enable Inventory Tooltips',
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

        this.settings.bankTooltips = {
            text: 'Enable Bank Tooltips',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {
                if (this.settings.enabled.value) {
                    this.start();
                }
            },
        } as any;

        this.settings.shopTooltips = {
            text: 'Enable Shop Tooltips',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {
                if (this.settings.enabled.value) {
                    this.start();
                }
            },
        } as any;

        // Color settings for accessibility
        this.settings.colorPositive = {
            text: 'Positive Bonus Color',
            type: SettingsTypes.color,
            value: '#7fff7f',
            callback: () => {
                this.start();
            },
        } as any;
        this.settings.colorNegative = {
            text: 'Negative Bonus Color',
            type: SettingsTypes.color,
            value: '#ff7f7f',
            callback: () => {
                this.start();
            },
        } as any;
        this.settings.colorOverheal = {
            text: 'Overheal Color',
            type: SettingsTypes.color,
            value: '#ffe97f',
            callback: () => {
                this.start();
            },
        } as any;
        // Opacity setting for tooltip background
        this.settings.tooltipBgOpacity = {
            text: 'Tooltip Background Opacity',
            type: SettingsTypes.range,
            value: 98,
            callback: () => {
                this.addPluginStyle();
            },
            validation: (value: number) => {
                return value >= 0 && value <= 100;
            }
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

        // Build selectors based on settings
        const selectors: string[] = [];
        if (this.settings.enabled.value)
            selectors.push('.hs-item-table--inventory .hs-item-table__cell');
        if (this.settings.bankTooltips.value)
            selectors.push('.hs-item-table--bank .hs-item-table__cell');
        if (this.settings.shopTooltips.value)
            selectors.push('.hs-item-table--shop .hs-item-table__cell');
        const selector = selectors.join(', ');

        const itemEl = target.closest(selector);
        if (!itemEl) return;
        // Get the slot ID from the element
        const slotIdStr = itemEl.getAttribute('data-slot');
        if (!slotIdStr) return;
        const slotId = parseInt(slotIdStr, 10);

        // Determine source of items based on table type
        let item;
        if (itemEl.closest('.hs-item-table--inventory')) {
            const inventoryItems =
                this.gameHooks.EntityManager.Instance.MainPlayer.Inventory
                    .Items;
            item = inventoryItems[slotId];
        } else if (itemEl.closest('.hs-item-table--bank')) {
            const bankItems =
                this.gameHooks.EntityManager.Instance.MainPlayer._bankItems
                    ._items;
            item = bankItems[slotId];
        } else if (itemEl.closest('.hs-item-table--shop')) {
            const shopItems =
                this.gameHooks.EntityManager.Instance.MainPlayer._currentState
                    ._shopItems._items;
            item = shopItems[slotId];
        }
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
        if(this.tooltipStyle)   {
            this.tooltipStyle.remove();
            this.tooltipStyle = null;
        }
        this.tooltipStyle = document.createElement('style');
        this.tooltipStyle.setAttribute('data-item-panel', 'true');
        // Use settings for colors and opacity
        const colorPositive = this.settings.colorPositive?.value || '#7fff7f';
        const colorNegative = this.settings.colorNegative?.value || '#ff7f7f';
        const colorOverheal = this.settings.colorOverheal?.value || '#ffe97f';
        const bgOpacity = (Number(this.settings.tooltipBgOpacity?.value) ?? 97) / 100;
        this.tooltipStyle.textContent = `
          .hlt-tooltip {
            position: fixed;
            background: rgba(30, 30, 40, ${bgOpacity});
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
            color: ${colorPositive};
          }
          .hlt-tooltip-negative {
            color: ${colorNegative};
          }
          .hlt-tooltip-edible {
            color: ${colorOverheal};
            font-size: 13px;
            font-style: italic;
          }
          .hlt-tooltip-edible-heal {
            font-weight: bold;
            margin-left: 6px;
          }
          .hlt-tooltip-edible-heal-normal {
            color: ${colorPositive};
          }
          .hlt-tooltip-edible-heal-over {
            color: ${colorOverheal};
          }
        `;
        this.tooltipUI?.appendChild(this.tooltipStyle);
    }

    /**
     * Updates the tooltip position to follow the mouse and stay within the viewport.
     * @param event MouseEvent
     */
    private updateTooltipPosition(event: MouseEvent) {
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
