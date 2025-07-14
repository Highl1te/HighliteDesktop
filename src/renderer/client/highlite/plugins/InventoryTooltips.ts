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

        this.settings.bankTooltips = {
            text: 'Enable Bank Tooltips',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {
                if (this.settings.enable.value) {
                    this.start();
                }
            },
        } as any;

        this.settings.shopTooltips = {
            text: 'Enable Shop Tooltips',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {
                if (this.settings.enable.value) {
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
                if (this.settings.enable.value) {
                    this.addPluginStyle();
                }
            },
        } as any;
        this.settings.colorNegative = {
            text: 'Negative Bonus Color',
            type: SettingsTypes.color,
            value: '#ff7f7f',
            callback: () => {
                if (this.settings.enable.value) {
                    this.addPluginStyle();
                }
            },
        } as any;
        this.settings.colorOverheal = {
            text: 'Overheal Color',
            type: SettingsTypes.color,
            value: '#ffe97f',
            callback: () => {
                if (this.settings.enable.value) {
                    this.addPluginStyle();
                }
            },
        } as any;
        // Opacity setting for tooltip background
        this.settings.tooltipBgOpacity = {
            text: 'Tooltip Background Opacity',
            type: SettingsTypes.range,
            value: 98,
            callback: () => {
                if (this.settings.enable.value) {
                    this.addPluginStyle();
                }
            },
            validation: (value: number) => {
                return value >= 0 && value <= 100;
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
        // Build selectors based on settings
        const selectors: string[] = [];
        if (this.settings.enable.value)
            selectors.push('.hs-item-table--inventory .hs-item-table__cell');
        if (this.settings.enable.value && this.settings.bankTooltips.value)
            selectors.push('.hs-item-table--bank .hs-item-table__cell');
        if (this.settings.enable.value && this.settings.shopTooltips.value)
            selectors.push('.hs-item-table--shop .hs-item-table__cell');
        if (selectors.length === 0) return;
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
        if (bonuses.length > 0) {
            bonusText += `<div class="hs-ui-item-tooltip-section">`;
            for (const bonus of bonuses) {
                bonusText += `<div class="hs-ui-item-tooltip-effect"> • `;
                const equippedBonus = equippedEffects.find(
                    (e: any) => e._skill === bonus._skill
                );
                let diff: number;
                if (equippedBonus) {
                    diff = bonus._amount - equippedBonus._amount;
                } else {
                    diff = bonus._amount;
                }
                bonusText += `<span class="hlt-tooltip-bonus ${diff > 0 ? 'hlt-tooltip-positive' : diff < 0 ? 'hlt-tooltip-negative' : ''}">${diff > 0 ? '+' : ''}${diff}</span> ${this.getSkillName(bonus._skill)}`;
                bonusText += `</div>`;
            }

            // Show bonuses that are only on equipped item (not on hovered item) as a loss
            for (const equippedBonus of equippedEffects) {
                if (!hoveredSkills.has(equippedBonus._skill)) {
                    bonusText += `<div class="hs-ui-item-tooltip-effect"> • `;
                    // The hovered item does not have this bonus, so you lose it
                    const diff = -equippedBonus._amount;
                    bonusText += `<span class="hlt-tooltip-bonus ${diff < 0 ? 'hlt-tooltip-negative' : diff > 0 ? 'hlt-tooltip-positive' : ''}">${diff > 0 ? '+' : ''}${diff}</span> ${this.getSkillName(equippedBonus._skill)}<br>`;
                    bonusText += `</div>`;
                }
            }
            bonusText += `</div>`;
        }
        // Show all bonuses from hovered item, comparing to equipped

        // Edible effect display with heal color logic
        const consumableBonuses = itemDef._edibleEffects || [];
        let edibleText = '';
        if (consumableBonuses.length > 0) {
            const currentHp = mainPlayer._hitpoints?._currentLevel ?? 0;
            const maxHp = mainPlayer._hitpoints?._level ?? 0;
            bonusText += `<div class="hs-ui-item-tooltip-section">`;
            // Combine combat and non-combat skills into one lookup array
            const allSkills: any[] = [];
            // _combat._skills is usually first, then _skills._skills
            if (mainPlayer._combat?._skills) {
                for (let i = 0; i < mainPlayer._combat._skills.length; i++) {
                    allSkills[i] = mainPlayer._combat._skills[i];
                }
            }
            if (mainPlayer._skills?._skills) {
                for (let i = 0; i < mainPlayer._skills._skills.length; i++) {
                    if (mainPlayer._skills._skills[i]) {
                        allSkills[i] = mainPlayer._skills._skills[i];
                    }
                }
            }
            for (const bonus of consumableBonuses) {
                let value = bonus._amount;
                let valueDisplay = value;
                let colorClass = '';
                let isPercent = false;
                // If value is float, treat as percent of skill
                if (typeof value === 'number' && !Number.isInteger(value)) {
                    isPercent = true;
                    // Get current skill value
                    let skillValue = 0;
                    if (bonus._skill === 0) {
                        skillValue = currentHp;
                    } else {
                        // Try to get skill value from combined array
                        const skillObj = allSkills[bonus._skill];
                        skillValue = skillObj?._level ?? 1;
                    }
                    valueDisplay = Math.round(skillValue * value);
                }
                // Color logic
                if (value < 0) {
                    colorClass = 'hlt-tooltip-negative';
                } else if (bonus._skill === 0 && currentHp + value > maxHp) {
                    colorClass = 'hlt-tooltip-edible-heal-over';
                } else {
                    colorClass = 'hlt-tooltip-edible-heal-normal';
                }
                bonusText += `<div class="hs-ui-item-tooltip-effect"> • 
                <span class="hlt-tooltip-bonus ${colorClass}">${value < 0 ? '' : '+'}${isPercent ? Math.max(valueDisplay, 1) : value}${isPercent ? ' (' + Math.round(value * 100) + '%)' : ''}</span> ${this.getSkillName(bonus._skill)}</div>`;
            }
            bonusText += `</div>`;
        }
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'hs-ui-item-tooltip hlt-tooltip';
        this.tooltip.style.left = `${event.clientX + 10}px`;
        this.tooltip.style.top = `${event.clientY + 10}px`;
        this.tooltip.innerHTML = `
        <div class="hs-ui-item-tooltip-title"> <div class="hs-ui-item-tooltip-name">${itemDef._name}</div></div>
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
        if (this.tooltipStyle) {
            this.tooltipStyle.remove();
            this.tooltipStyle = null;
        }
        this.tooltipStyle = document.createElement('style');
        this.tooltipStyle.setAttribute('data-item-panel', 'true');
        // Use settings for colors and opacity
        const colorPositive = this.settings.colorPositive?.value || '#7fff7f';
        const colorNegative = this.settings.colorNegative?.value || '#ff7f7f';
        const colorOverheal = this.settings.colorOverheal?.value || '#ffe97f';
        const bgOpacity =
            (Number(this.settings.tooltipBgOpacity?.value) ?? 97) / 100;
        this.tooltipStyle.textContent = `
          .hlt-tooltip {
            position: fixed;
            display: block;
            min-width: 100px;
            background: linear-gradient(145deg, rgba(42, 42, 42, ${bgOpacity}), rgba(26, 26, 26, ${bgOpacity}));
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
            const tooltipRect = this.tooltip.getBoundingClientRect();
            const padding = 5;
            // Default: show to the left of the cursor
            let left = event.clientX - tooltipRect.width + padding;
            let top = event.clientY + padding;

            // Get viewport dimensions
            let gameClient = document
                .getElementById('game-container')!
                .getBoundingClientRect();
            const viewportHeight = gameClient.height - 20;

            // If tooltip would go off left edge, show to the right
            if (left < padding) {
                left = event.clientX + padding;
            }

            // If tooltip would go off bottom edge, show above
            if (top + tooltipRect.height > viewportHeight) {
                top = event.clientY - tooltipRect.height - padding;
            }

            // Prevent negative positions
            left = Math.max(left, padding);
            top = Math.max(top, padding);
            this.tooltip.style.left = `${left}px`;
            this.tooltip.style.top = `${top}px`;
        }
    }
}
