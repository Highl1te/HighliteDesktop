import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';
import { getSkillName } from '../core/utilities/lookupUtils';

interface SkillXPData {
    skillId: number;
    previousXP: number;
    currentXP: number;
    skillName: string;
}

interface XPDrop {
    skillId: number;
    xpGained: number;
    skillName: string;
    timestamp: number;
    element: HTMLDivElement;
}

export class XPOrb extends Plugin {
    pluginName = 'XP Orb';
    author = 'JayArrowz';

    private xpOrbContainer: HTMLDivElement | null = null;
    private xpOrbElement: HTMLDivElement | null = null;
    private xpDropsContainer: HTMLDivElement | null = null;
    private totalXPDisplay: HTMLDivElement | null = null;
    private sessionXPDisplay: HTMLDivElement | null = null;

    private skillXPData: Map<number, SkillXPData> = new Map();
    private activeXPDrops: XPDrop[] = [];
    private isOrbOpen: boolean = true;
    private totalXP: number = 0;
    private sessionXP: number = 0;

    private readonly XP_DROP_DURATION = 3000; // 3 seconds
    private readonly XP_DROP_FADE_START = 2000; // Start fading after 2 seconds
    private readonly MAX_VISIBLE_DROPS = 5;

    constructor() {
        super();
        this.settings.enable = {
            text: 'Enable XP Orb',
            type: SettingsTypes.checkbox,
            value: false, // Default to false
            callback: () => this.toggleXPTracker(),
        };
        this.settings.xpDrops = {
            text: 'Show XP Drops',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {},
        };
        this.settings.showSessionXP = {
            text: 'Show Session XP',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.updateSessionXPVisibility(),
        };
        this.settings.resetSessionXP = {
            text: 'Reset Session XP',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {
                if (this.settings.resetSessionXP.value) {
                    this.resetSessionXP();
                    this.settings.resetSessionXP.value = false;
                }
            },
        };
    }

    init(): void {
        this.log('Initializing XP Orb');
    }

    start(): void {
        this.log('Started XP Orb');
        this.createXPTrackerUI();
    }

    stop(): void {
        this.log('Stopped XP Orb');
        this.saveSessionXPToDatabase();
        this.cleanup();
    }

    SocketManager_loggedIn(): void {
        this.log('Player logged in, setting up XP tracking');
        setTimeout(() => {
            this.loadSessionXPFromDatabase();
            this.setupXPTracking();
            this.createXPTrackerUI();
        }, 500);
    }

    SocketManager_handleLoggedOut(): void {
        this.log('Player logged out, cleaning up XP tracking');
        this.saveSessionXPToDatabase();
        this.cleanup();
    }

    GameLoop_update(): void {
        if (!this.settings.enable.value) return;
        this.updateXPDrops();
    }

    private createXPTrackerUI(): void {
        if (!this.settings.enable.value) return;

        this.cleanupUI();

        this.xpOrbContainer = document.createElement('div');
        this.xpOrbContainer.id = 'highlite-xp-tracker';
        this.xpOrbContainer.style.position = 'absolute';

        this.xpOrbContainer.style.top =
            'calc(var(--hs-compass-button-top) + var(--hs-action-menu-item-width) + 25px)';
        this.xpOrbContainer.style.right =
            'calc(var(--hs-compass-button-right) + 6px)';
        this.xpOrbContainer.style.zIndex = '9999';
        this.xpOrbContainer.style.fontFamily = 'Inter, sans-serif';
        this.xpOrbContainer.style.fontSize = '12px';
        this.xpOrbContainer.style.fontWeight = 'bold';
        this.xpOrbContainer.style.pointerEvents = 'auto';
        this.xpOrbContainer.style.userSelect = 'none';

        this.createXPOrb();
        this.createSessionXPDisplay();

        this.xpDropsContainer = document.createElement('div');
        this.xpDropsContainer.id = 'highlite-xp-drops';
        this.xpDropsContainer.style.position = 'absolute';
        this.xpDropsContainer.style.top = '0px';
        this.xpDropsContainer.style.left = '50%';
        this.xpDropsContainer.style.transform = 'translateX(-100%)';
        this.xpDropsContainer.style.width = '120px';
        this.xpDropsContainer.style.pointerEvents = 'none';
        this.xpDropsContainer.style.zIndex = '10000';

        this.xpOrbContainer.appendChild(this.xpDropsContainer);

        const gameScreen = document.getElementById('hs-screen-mask');
        if (gameScreen) {
            gameScreen.appendChild(this.xpOrbContainer);
        }

        this.updateTotalXP();
    }

    private createXPOrb(): void {
        if (!this.xpOrbContainer) return;

        this.xpOrbElement = document.createElement('div');
        this.xpOrbElement.style.width = `35px`;
        this.xpOrbElement.style.height = `35px`;
        this.xpOrbElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.xpOrbElement.style.border = '2px solid #ffd700';
        this.xpOrbElement.style.borderRadius = '50%';
        this.xpOrbElement.style.display = 'flex';
        this.xpOrbElement.style.flexDirection = 'column';
        this.xpOrbElement.style.justifyContent = 'center';
        this.xpOrbElement.style.alignItems = 'center';
        this.xpOrbElement.style.cursor = 'pointer';
        this.xpOrbElement.style.transition = 'all 0.3s ease';
        this.xpOrbElement.style.position = 'relative';
        this.xpOrbElement.style.pointerEvents = 'auto';
        this.xpOrbElement.style.userSelect = 'none';

        this.totalXPDisplay = document.createElement('div');
        this.totalXPDisplay.style.color = '#ffd700';
        this.totalXPDisplay.style.textAlign = 'center';
        this.totalXPDisplay.style.fontSize = '10px';
        this.totalXPDisplay.style.lineHeight = '1.2';
        this.totalXPDisplay.style.wordWrap = 'break-word';
        this.totalXPDisplay.style.maxWidth = '90%';

        document.highlite.managers.UIManager.bindOnClickBlockHsMask(
            this.xpOrbElement,
            () => {
                this.toggleOrb();
            }
        );

        this.xpOrbElement.addEventListener('mouseenter', () => {
            if (this.xpOrbElement) {
                this.xpOrbElement.style.transform = 'scale(1.1)';
                this.xpOrbElement.style.boxShadow =
                    '0 0 20px rgba(255, 215, 0, 0.5)';
            }
        });

        this.xpOrbElement.addEventListener('mouseleave', () => {
            if (this.xpOrbElement) {
                this.xpOrbElement.style.transform = 'scale(1)';
                this.xpOrbElement.style.boxShadow = 'none';
            }
        });

        this.xpOrbElement.appendChild(this.totalXPDisplay);
        this.xpOrbContainer.appendChild(this.xpOrbElement);
    }

    private createSessionXPDisplay(): void {
        if (!this.xpOrbContainer) return;

        this.sessionXPDisplay = document.createElement('div');
        this.sessionXPDisplay.id = 'highlite-session-xp';
        this.sessionXPDisplay.style.position = 'absolute';
        this.sessionXPDisplay.style.right = '100%';
        this.sessionXPDisplay.style.top = '50%';
        this.sessionXPDisplay.style.transform = 'translateY(-50%)';
        this.sessionXPDisplay.style.marginRight = '10px';
        this.sessionXPDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.sessionXPDisplay.style.border = '2px solid #ffd700';
        this.sessionXPDisplay.style.borderRadius = '4px';
        this.sessionXPDisplay.style.padding = '4px 8px';
        this.sessionXPDisplay.style.fontFamily = 'Inter, sans-serif';
        this.sessionXPDisplay.style.fontSize = '10px';
        this.sessionXPDisplay.style.fontWeight = 'bold';
        this.sessionXPDisplay.style.color = '#ffd700';
        this.sessionXPDisplay.style.textAlign = 'center';
        this.sessionXPDisplay.style.whiteSpace = 'nowrap';
        this.sessionXPDisplay.style.pointerEvents = 'none';
        this.sessionXPDisplay.style.zIndex = '10001';
        this.sessionXPDisplay.innerHTML = `
            <div style="font-size: 8px; opacity: 0.8;">Total</div>
            <div>${this.formatNumber(this.sessionXP)} XP</div>
        `;

        this.xpOrbContainer.appendChild(this.sessionXPDisplay);
        this.updateSessionXPVisibility();
    }

    private setupXPTracking(): void {
        try {
            const mainPlayer =
                document.highlite?.gameHooks?.EntityManager?.Instance
                    ?.MainPlayer;
            if (!mainPlayer) {
                return;
            }

            this.skillXPData.clear();

            const skills = mainPlayer.Skills?._skills;
            if (skills) {
                for (let i = 0; i < skills.length; i++) {
                    const skill = skills[i];
                    if (skill && skill._skill !== undefined) {
                        this.trackSkill(skill, getSkillName(skill._skill));
                    }
                }
            }

            const combatSkills = mainPlayer.Combat?.Skills;
            if (combatSkills) {
                for (let i = 0; i < combatSkills.length; i++) {
                    const skill = combatSkills[i];
                    if (skill && skill._skill !== undefined) {
                        this.trackSkill(skill, getSkillName(skill._skill));
                    }
                }
            }
        } catch (error) {}
    }

    private trackSkill(skill: any, skillName: string): void {
        const skillId = skill._skill;
        const currentXP = skill._xp || 0;
        this.skillXPData.set(skillId, {
            skillId,
            previousXP: currentXP,
            currentXP: currentXP,
            skillName,
        });

        try {
            if (
                skill.OnExpChangeListener &&
                typeof skill.OnExpChangeListener.add === 'function'
            ) {
                skill.OnExpChangeListener.add(
                    (changedSkill: any, totalXp: number) => {
                        this.onXPChange(skillId, totalXp, skillName);
                    }
                );
            }
        } catch (error) {}
    }

    private onXPChange(
        skillId: number,
        newTotalXP: number,
        skillName: string
    ): void {
        const skillData = this.skillXPData.get(skillId);
        if (!skillData) {
            this.skillXPData.set(skillId, {
                skillId,
                previousXP: 0,
                currentXP: newTotalXP,
                skillName,
            });
            return;
        }

        const xpGained = newTotalXP - skillData.currentXP;

        if (xpGained <= 0) {
            return;
        }

        skillData.previousXP = skillData.currentXP;
        skillData.currentXP = newTotalXP;

        this.sessionXP += xpGained;
        this.updateSessionXPDisplay();
        this.saveSessionXPToDatabase();

        this.updateTotalXP();

        if (this.settings.xpDrops.value && this.isOrbOpen) {
            this.showXPDrop(skillId, xpGained, skillName);
        }
    }

    private showXPDrop(
        skillId: number,
        xpGained: number,
        skillName: string
    ): void {
        if (!this.xpDropsContainer) {
            return;
        }

        if (!this.settings.enable.value) {
            return;
        }

        while (this.activeXPDrops.length >= this.MAX_VISIBLE_DROPS) {
            const oldestDrop = this.activeXPDrops.shift();
            if (oldestDrop) {
                oldestDrop.element.remove();
            }
        }

        const dropElement = document.createElement('div');
        dropElement.style.display = 'flex';
        dropElement.style.alignItems = 'center';
        dropElement.style.justifyContent = 'center';
        dropElement.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        dropElement.style.border = 'none';
        dropElement.style.borderRadius = '3px';
        dropElement.style.padding = '2px 6px';
        dropElement.style.marginBottom = '2px';
        dropElement.style.transition = 'all 0.8s ease-out';
        dropElement.style.opacity = '0';
        dropElement.style.transform = 'translateY(-20px) scale(0.8)';
        dropElement.style.width = 'fit-content';
        dropElement.style.minWidth = '60px';

        const iconElement = document.createElement('div');
        iconElement.style.marginRight = '4px';
        iconElement.style.flexShrink = '0';
        iconElement.classList.add(
            'hs-icon-background',
            'hs-stat-menu-item__icon',
            `hs-stat-menu-item__icon--${skillName.toLowerCase()}`
        );

        const xpText = document.createElement('span');
        xpText.style.color = '#00ff00';
        xpText.style.fontSize = '10px';
        xpText.style.fontWeight = 'bold';
        xpText.style.textShadow =
            '2px 2px 4px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.8)';
        xpText.style.whiteSpace = 'nowrap';
        xpText.textContent = `+${xpGained.toLocaleString()}`;

        dropElement.appendChild(iconElement);
        dropElement.appendChild(xpText);

        const dropIndex = this.activeXPDrops.length;
        dropElement.style.position = 'absolute';
        dropElement.style.top = `${dropIndex * 25}px`;
        dropElement.style.left = '50%';
        dropElement.style.transform =
            'translateX(-50%) translateY(-20px) scale(0.8)';

        this.xpDropsContainer.appendChild(dropElement);

        setTimeout(() => {
            dropElement.style.opacity = '1';
            dropElement.style.transform = `translateX(-50%) translateY(${dropIndex * 25 + 40}px) scale(1)`;
        }, 50);

        const xpDrop: XPDrop = {
            skillId,
            xpGained,
            skillName,
            timestamp: Date.now(),
            element: dropElement,
        };
        this.activeXPDrops.push(xpDrop);
    }

    private updateXPDrops(): void {
        const now = Date.now();
        const dropsToRemove: number[] = [];

        this.activeXPDrops.forEach((drop, index) => {
            const age = now - drop.timestamp;

            if (age > this.XP_DROP_DURATION) {
                drop.element.remove();
                dropsToRemove.push(index);
            } else if (age > this.XP_DROP_FADE_START) {
                const fadeProgress =
                    (age - this.XP_DROP_FADE_START) /
                    (this.XP_DROP_DURATION - this.XP_DROP_FADE_START);
                const opacity = 1 - fadeProgress;
                const extraY = fadeProgress * 20;
                const scale = 1 - fadeProgress * 0.2;

                drop.element.style.opacity = Math.max(0, opacity).toString();
                drop.element.style.transform = `translateX(-50%) translateY(${index * 25 + 40 + extraY}px) scale(${scale})`;
            }
        });

        dropsToRemove.reverse().forEach(index => {
            this.activeXPDrops.splice(index, 1);
        });
    }

    private updateTotalXP(): void {
        this.totalXP = 0;
        this.skillXPData.forEach(skillData => {
            this.totalXP += skillData.currentXP;
        });

        this.updateTotalXPDisplay();
    }

    private updateTotalXPDisplay(): void {
        if (!this.totalXPDisplay) return;

        if (this.isOrbOpen) {
            this.totalXPDisplay.innerHTML = `<div>XP</div>`;
            this.totalXPDisplay.style.display = 'block';
        } else {
            this.totalXPDisplay.innerHTML = `<div>•</div>`;
            this.totalXPDisplay.style.display = 'block';
        }
    }

    private toggleOrb(): void {
        this.isOrbOpen = !this.isOrbOpen;

        if (this.xpOrbElement) {
            if (this.isOrbOpen) {
                this.xpOrbElement.style.width = `35px`;
                this.xpOrbElement.style.height = `35px`;
            } else {
                this.xpOrbElement.style.width = '20px';
                this.xpOrbElement.style.height = '20px';
            }
        }

        if (this.xpDropsContainer) {
            this.xpDropsContainer.style.display = this.isOrbOpen
                ? 'block'
                : 'none';
        }

        if (!this.isOrbOpen) {
            this.activeXPDrops.forEach(drop => drop.element.remove());
            this.activeXPDrops = [];
        }

        this.updateTotalXPDisplay();
        this.updateSessionXPVisibility();
    }

    private toggleXPTracker(): void {
        if (this.settings.enable.value) {
            this.createXPTrackerUI();
            const mainPlayer =
                document.highlite?.gameHooks?.EntityManager?.Instance
                    ?.MainPlayer;
            if (mainPlayer) {
                this.setupXPTracking();
            }
        } else {
            this.cleanup();
        }
    }

    private formatNumber(num: number): string {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        }
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num.toString();
    }

    private updateSessionXPDisplay(): void {
        if (!this.sessionXPDisplay) return;

        this.sessionXPDisplay.innerHTML = `
            <div style="font-size: 8px; opacity: 0.8;">Total</div>
            <div>${this.formatNumber(this.sessionXP)} XP</div>
        `;
    }

    private updateSessionXPVisibility(): void {
        if (!this.sessionXPDisplay) return;
        this.sessionXPDisplay.style.display =
            this.isOrbOpen && this.settings.showSessionXP.value
                ? 'block'
                : 'none';
    }

    private async saveSessionXPToDatabase(): Promise<void> {
        try {
            const dbManager = document.highlite?.managers?.DatabaseManager;
            if (!dbManager || !dbManager.database) return;

            const sessionData = {
                sessionXP: this.sessionXP,
                lastUpdated: Date.now(),
            };

            await dbManager.database.put(
                'settings',
                sessionData,
                `${this.pluginName}_sessionXP`
            );
        } catch (error) {
            console.error('Error saving session XP to database:', error);
        }
    }

    private async loadSessionXPFromDatabase(): Promise<void> {
        try {
            const dbManager = document.highlite?.managers?.DatabaseManager;
            if (!dbManager || !dbManager.database) return;

            const sessionData = await dbManager.database.get(
                'settings',
                `${this.pluginName}_sessionXP`
            );

            if (sessionData && typeof sessionData.sessionXP === 'number') {
                this.sessionXP = sessionData.sessionXP;
                this.updateSessionXPDisplay();
                this.log(`Loaded session XP from database: ${this.sessionXP}`);
            }
        } catch (error) {
            console.error('Error loading session XP from database:', error);
        }
    }

    private async resetSessionXP(): Promise<void> {
        try {
            this.sessionXP = 0;
            this.updateSessionXPDisplay();
            await this.saveSessionXPToDatabase();
            this.log('Session XP reset to 0');
        } catch (error) {
            console.error('Error resetting session XP:', error);
        }
    }

    private cleanupUI(): void {
        if (this.xpOrbContainer && this.xpOrbContainer.parentNode) {
            this.xpOrbContainer.parentNode.removeChild(this.xpOrbContainer);
        }

        this.activeXPDrops.forEach(drop => {
            if (drop.element && drop.element.parentNode) {
                drop.element.parentNode.removeChild(drop.element);
            }
        });

        this.xpOrbContainer = null;
        this.xpOrbElement = null;
        this.xpDropsContainer = null;
        this.totalXPDisplay = null;
        this.sessionXPDisplay = null;
        this.activeXPDrops = [];
    }

    private cleanup(): void {
        this.log('cleanup called - clearing all data');
        if (this.xpOrbContainer && this.xpOrbContainer.parentNode) {
            this.xpOrbContainer.parentNode.removeChild(this.xpOrbContainer);
        }

        this.activeXPDrops.forEach(drop => {
            if (drop.element && drop.element.parentNode) {
                drop.element.parentNode.removeChild(drop.element);
            }
        });

        this.xpOrbContainer = null;
        this.xpOrbElement = null;
        this.xpDropsContainer = null;
        this.totalXPDisplay = null;
        this.sessionXPDisplay = null;
        this.activeXPDrops = [];
        this.skillXPData.clear();
        this.totalXP = 0;
    }
}
