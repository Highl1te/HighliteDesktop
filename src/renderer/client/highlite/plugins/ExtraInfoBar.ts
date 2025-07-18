import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { UIManager, UIManagerScope } from '../core/managers/highlite/uiManager';

export class ExtrAInfoBar extends Plugin {
    pluginName = 'Extra Info Bar';
    author = 'Valsekamerplant';
    private uiManager = new UIManager();
    infoBarUI: HTMLElement | null = null;
    infoBarWrapper: HTMLElement | null = null;
    infoBarStyle: HTMLStyleElement | null = null;
    isLoggedIn = false;
    restoreCycleStart: number | null = null; // ms timestamp of last restore packet
    restoreCycleLength = 60000;
    combatSkillIds = [0, 1, 2, 3, 4, 15];
    currentAmmo: number |null = null;
    activeSkillBoosts: {
        [skillId: number]: {
            expiresAt: number; // ms timestamp
            itemId: number; // what item caused this
            boostAmount: number; // optional: for display
        };
    } = {};

    lastUsedPotion: {
        itemId: number;
        impactedSkills: number[];
    } | null = null;

    /**
     * Plugin setting to enable/disable inventory tooltips.
     */
    constructor() {
        super();
    }

    /**
     * Initializes the plugin (called once on load).
     */
    init(): void {
        this.log('Extra Info Bar initialised');
    }

    /**
     * Starts the plugin, adds styles and event listeners.
     */
    start() {
        this.removeBar();
        this.log(
            'Extra Info Bar started',
            this.settings.enable.value,
            this.isLoggedIn,
            this.infoBarUI
        );
        if (this.settings.enable.value && this.isLoggedIn && !this.infoBarUI) {
            this.createBar();
        }
    }

    /**
     * Stops the plugin, removes event listeners and tooltip.
     */
    stop() {
        this.removeBar();
    }

    // Logged In
    SocketManager_loggedIn(...args): void {
        this.isLoggedIn = true;
        // If not enabled, return
        if (!this.settings.enable.value) {
            return;
        }
        this.removeBar();
        this.createBar();
    }
    // Logged Out
    SocketManager_handleLoggedOut(): void {
        this.isLoggedIn = false;
        this.removeBar();
    }
    //IMPROVEMENT color impacted stats
    SocketManager_handleForcedSkillCurrentLevelChangedPacket(...args) {
        this.log(args);
        const [skillId, newValue, wasSuccessful] = args[0];
        if (!wasSuccessful) return;

        if (
            this.lastUsedPotion &&
            this.lastUsedPotion.impactedSkills.includes(skillId)
        ) {
            let player = this.gameHooks.EntityManager.Instance._mainPlayer;
            let skillObj;
            if (this.combatSkillIds.includes(skillId)) {
                skillObj = player._combat._skills[skillId];
            } else {
                skillObj = player._skills._skills[skillId];
            }
            const boostAmount = Math.abs(
                skillObj._currentLevel - skillObj._level
            );
            this.log("the boost amount is",boostAmount )
            if (boostAmount > 0 && this.restoreCycleStart !== null) {
                const now = Date.now();
                const msIntoCycle =
                    (now - this.restoreCycleStart + this.restoreCycleLength) %
                    this.restoreCycleLength;
                const msLeftThisCycle = this.restoreCycleLength - msIntoCycle;
                const expiresAt =
                    now +
                    msLeftThisCycle +
                    this.restoreCycleLength * (boostAmount - 1);

                this.activeSkillBoosts[skillId] = {
                    expiresAt,
                    itemId: this.lastUsedPotion.itemId,
                    boostAmount: skillObj._currentLevel - skillObj._level, // can be positive or negative
                };
                this.log("the array values is",this.activeSkillBoosts[skillId] ) 
            }
            // Don't remove lastUsedPotion yet, we want all skills from this potion to be handled
            // Remove only after all expected skills are processed (optional improvement)
        }
    }

    async SocketManager_handleInvokedInventoryItemActionPacket(...args) {
        this.log(
            'SocketManager_handleInvokedInventoryItemActionPacket called with args:',
            args
        );
        if (!args[0][6] || args[0][0] == 19) return;
        this.log('Drawing icon for item:', args[0][3]);
        const itemId = args[0][3];
        const item = this.gameHooks.ItemDefMap.ItemDefMap.get(itemId);
        if (item._edibleEffects) {
            const impactedSkills = item._edibleEffects.map(
                skill => skill._skill
            );
            this.lastUsedPotion = { itemId, impactedSkills };
        } else {
            // Not a consumable—don't set up a timer
            this.lastUsedPotion = null;
        }
    }

    async SocketManager_handleRestoredStatsPacket(...args) {
        this.restoreCycleStart = Date.now();
        this.log("args", ...args)
    }

    GameLoop_update(...args) {
        if (this.infoBarUI && this.settings.enable.value) {
            const player = this.gameHooks.EntityManager.Instance._mainPlayer;
            const ammoSlot = player._loadout._items[9];
            if (player && ammoSlot) {
                this.currentAmmo = ammoSlot._id
                this.drawIcon(this.currentAmmo, ammoSlot._amount, 9);
            } else {
                const iconElement = document.getElementById(`eib-item-9`);
                if (iconElement) {
                    this.removeIcon(iconElement);
                }
            }

            const now = Date.now();
            for (const skillId in this.activeSkillBoosts) {
                const boost = this.activeSkillBoosts[skillId];
                const msRemaining = boost.expiresAt - now;
                this.log(boost);
                if (msRemaining > 0) {
                    const secondsLeft = this.restoreCycleStart ? Math.ceil(msRemaining / 1000) : '?';
                    // Optionally: Add icon or color for negative effect (boostAmount < 0)
                    this.drawIcon(
                        boost.itemId,
                        boost.boostAmount,
                        `boost-timer-${skillId}`,
                        `${secondsLeft}`
                    );
                } else {
                    const iconElement = document.getElementById(
                        `eib-item-boost-timer-${skillId}`
                    );
                    if (iconElement) {
                        this.removeIcon(iconElement);
                    }
                    delete this.activeSkillBoosts[skillId];
                }
            }
        }
    }

    createBar() {
        if (this.infoBarUI) {
            this.removeBar();
        }
        this.infoBarUI = this.uiManager.createElement(
            UIManagerScope.ClientInternal
        );

        if (!this.infoBarUI) {
            this.log('Failed to create status UI element.');
            this.settings.enable.value = false;
            return;
        }
        this.infoBarWrapper = document.createElement('div');
        this.infoBarWrapper.className = 'eib-wrapper';
        this.infoBarUI?.appendChild(this.infoBarWrapper);
        this.addPluginStyle();
    }
    /**
     * Removes the tooltip and mousemove event listener.
     */
    removeBar() {
        if (this.infoBarUI) {
            this.infoBarUI.remove();
            this.infoBarUI = null;
        }
    }

    drawIcon(itemId, value, iconId, timerValue: string | null = null) {
        const existingIcon = document.getElementById(`eib-item-${iconId}`);
        if (!existingIcon) {
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'eib-item';
            iconWrapper.id = `eib-item-${iconId}`;
            const spriteDiv = document.createElement('div');
            spriteDiv.className = 'eib-item-sprite';
            try {
                const pos =
                    this.gameHooks.InventoryItemSpriteManager.getCSSBackgroundPositionForItem(
                        itemId
                    );
                if (pos) {
                    spriteDiv.style.backgroundPosition = pos;
                }
            } catch (error) {
                console.warn(
                    `Error getting item sprite for ID ${itemId}:`,
                    error
                );
            }
            iconWrapper.appendChild(spriteDiv);

            const timerDiv = document.createElement('div');
            timerDiv.className = 'eib-timer-value';
            iconWrapper.appendChild(timerDiv);

            if (!this.infoBarWrapper) {
                return;
            }
            this.infoBarWrapper.appendChild(iconWrapper);
            iconWrapper!.querySelector('.eib-item-sprite')!.innerHTML = value;
            iconWrapper!.querySelector('.eib-timer-value')!.innerHTML = timerValue ?? '';

        } else {
            existingIcon!.querySelector('.eib-item-sprite')!.innerHTML = value;
            existingIcon!.querySelector('.eib-timer-value')!.innerHTML = timerValue ?? '';
        }

        // TIMER BELOW ICON: Add/update the timer value absolutely positione
    }

    removeIcon(iconElement) {
        if (iconElement) {
            iconElement.remove();
        }
    }
    /**
     * Injects the plugin's tooltip CSS styles into the document head.
     */
    private addPluginStyle(): void {
        this.infoBarStyle = document.createElement('style');
        this.infoBarStyle.setAttribute('data-item-panel', 'true');
        this.infoBarStyle.textContent = `
            .eib-wrapper {
                position: absolute;
                pointerEvents = 'none';
                top: 6px;
                display: flex;
                right: 480px;
            }
            .eib-item {
                position: relative;
                height: var(--hs-inventory-item-size);
                width: var(--hs-inventory-item-size);
                border-radius: 4px;
                margin-right: 5px;
                line-height: 5rem;
                text-align: right;
                background-color: rgba(0, 0, 0, 0.5);
            }

            .eib-item-sprite {
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
            .eib-timer-value {
                position:absolute;
                line-height: 1rem;
                left:0;
                width:100%;
                text-align:center;
                font-size:0.8em;
                color:#FFD700;
                bottom: 0;
            }
        `;
        this.infoBarUI?.appendChild(this.infoBarStyle);
    }

    formatSeconds(secs: number): string {
        const min = Math.floor(secs / 60);
        const sec = secs % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    }
}
