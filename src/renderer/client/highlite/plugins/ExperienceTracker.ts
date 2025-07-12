import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { abbreviateValue } from '../core/utilities/abbreviateValue';
import { PanelManager } from '../core/managers/highlite/panelManager';

interface XPWindow {
    xpGained: number;
    actions: number;
    windowStart: number;
}

interface SkillTracker {
    trackerElement: HTMLElement;
    trackedActions: number;
    trackedXPGained: number;
    trackerXPGainedWindows: XPWindow[];
    previousXP: number;
    inXPPerHourMode?: boolean;
    domElements?: {
        skillXPGainedValue: HTMLElement;
        skillXPLeftValue: HTMLElement;
        skillXPPerHourValue: HTMLElement;
        skillActionsLeftValue: HTMLElement;
        skillActionsLeftLabel: HTMLElement;
        xpProgress: HTMLElement;
        currentLevelSpan: HTMLElement;
        nextLevelSpan: HTMLElement;
        xpProgressSpan: HTMLElement;
    };
}

interface Skill {
    _skill: number;
    _level: number;
    _xp: number;
}

export class ExperienceTracker extends Plugin {
    pluginName = 'Experience Tracker';
    author = 'Highlite';
    panelManager: PanelManager = new PanelManager();
    panelContent: HTMLElement | undefined = undefined;

    levelToXP = {
        1: 0,
        2: 99,
        3: 210,
        4: 333,
        5: 470,
        6: 622,
        7: 791,
        8: 978,
        9: 1185,
        10: 1414,
        11: 1667,
        12: 1947,
        13: 2256,
        14: 2598,
        15: 2976,
        16: 3393,
        17: 3854,
        18: 4363,
        19: 4925,
        20: 5546,
        21: 6232,
        22: 6989,
        23: 7825,
        24: 8749,
        25: 9769,
        26: 10896,
        27: 12141,
        28: 13516,
        29: 15035,
        30: 16713,
        31: 18567,
        32: 20616,
        33: 22880,
        34: 25382,
        35: 28147,
        36: 31202,
        37: 34579,
        38: 38311,
        39: 42436,
        40: 46996,
        41: 52037,
        42: 57609,
        43: 63769,
        44: 70579,
        45: 78108,
        46: 86433,
        47: 95637,
        48: 105814,
        49: 117067,
        50: 129510,
        51: 143269,
        52: 158484,
        53: 175309,
        54: 193915,
        55: 214491,
        56: 237246,
        57: 262410,
        58: 290240,
        59: 321018,
        60: 355057,
        61: 392703,
        62: 434338,
        63: 480386,
        64: 531315,
        65: 587643,
        66: 649943,
        67: 718848,
        68: 795059,
        69: 879351,
        70: 972582,
        71: 1075701,
        72: 1189756,
        73: 1315908,
        74: 1455440,
        75: 1609773,
        76: 1780476,
        77: 1969287,
        78: 2178128,
        79: 2409124,
        80: 2664626,
        81: 2947234,
        82: 3259825,
        83: 3605580,
        84: 3988019,
        85: 4411034,
        86: 4878932,
        87: 5396475,
        88: 5968931,
        89: 6602127,
        90: 7302510,
        91: 8077208,
        92: 8934109,
        93: 9881935,
        94: 10930335,
        95: 12089982,
        96: 13372681,
        97: 14791491,
        98: 16360855,
        99: 18096750,
        100: 20016848,
    };

    skillToIcon = {
        hitpoints: '💖',
        accuracy: '🎯',
        strength: '💪',
        defense: '🛡️',
        magic: '🔮',
        range: '🏹',
        fishing: '🎣',
        mining: '⛏️',
        smithing: '🔨',
        cooking: '🍳',
        forestry: '🌳',
        crafting: '🧵',
        harvesting: '🌾',
        crime: '🥷',
        enchanting: '✨',
        potionmaking: '🧪',
    };

    skillTrackers: {
        [skillName: string]: SkillTracker;
    } = {};

    private readonly WINDOW_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
    private readonly MAX_WINDOWS = 12; // 12 windows = 60 minutes total
    private readonly MINUTES_PER_HOUR = 60;
    private readonly MINUTES_PER_WINDOW = 5;

    start(): void {
        if (!this.settings.enable.value) {
            return;
        }
        this.panelContent = this.panelManager.requestMenuItem(
            '📊',
            'Experience Tracker'
        )[1];
        if (!this.panelContent) {
            this.log(`Failed to create Experience Tracker panel`);
            return;
        }
        this.panelContent.style.display = 'block';
        this.panelContent.style.flexDirection = 'column';
        this.panelContent.style.width = '100%';
        this.panelContent.style.height = '-webkit-fill-available';

        this.log(`Started`);
    }

    SocketManager_loggedIn() {
        const resourceSkills =
            this.gameHooks.EntityManager.Instance.MainPlayer.Skills._skills;
        resourceSkills.forEach(skill => {
            this.createSkillListing(skill);
        });

        const combatSkills =
            this.gameHooks.EntityManager.Instance.MainPlayer.Combat._skills;
        combatSkills.forEach(skill => {
            this.createSkillListing(skill);
        });
    }

    createSkillListing(skill: Skill): void {
        const skillName: string = this.gameLookups['Skills'][skill._skill];
        if (this.skillTrackers[skillName]) {
            return; // Skill tracker already exists
        }
        const skillIcon = this.skillToIcon[skillName];

        const skillTracker = document.createElement('div');
        skillTracker.style.display = 'flex';
        skillTracker.style.flexDirection = 'column';
        skillTracker.style.margin = '5px';
        skillTracker.style.backgroundColor = 'rgba(0, 0, 0, 0.25)';
        skillTracker.style.padding = '5px';
        skillTracker.style.borderRadius = '10px';

        const skillHeader = document.createElement('div');
        skillHeader.style.display = 'flex';
        skillHeader.style.flexDirection = 'row';
        skillHeader.style.padding = '5px 0px';
        skillHeader.style.alignItems = 'center';
        skillTracker.appendChild(skillHeader);

        const skillIconElement = document.createElement('div');
        skillIconElement.textContent = skillIcon;

        skillIconElement.style.fontSize = '30px';
        skillIconElement.style.backgroundColor = '#80808069';
        skillIconElement.style.borderRadius = '360px';
        skillIconElement.style.padding = '5px';
        skillIconElement.style.textShadow = '0.0625rem 0.0625rem 0 black';
        skillIconElement.style.marginRight = '5px';
        skillIconElement.style.textWrapMode = 'nowrap';
        skillHeader.appendChild(skillIconElement);

        const xpDetails = document.createElement('div');
        xpDetails.style.display = 'flex';
        xpDetails.style.flexDirection = 'row';
        xpDetails.style.width = '100%';
        xpDetails.style.textWrapMode = 'nowrap';
        xpDetails.style.justifyContent = 'space-around';
        skillHeader.appendChild(xpDetails);

        const xpDetailsLeft = document.createElement('div');
        xpDetailsLeft.style.display = 'flex';
        xpDetailsLeft.style.flexDirection = 'column';

        const skillXPGained = document.createElement('div');
        skillXPGained.id = `skillXPGained`;
        skillXPGained.style.fontSize = '12px';

        const skillXPGainedLabel = document.createElement('div');
        const skillXPGainedValue = document.createElement('div');
        skillXPGainedValue.id = `skillXPGainedValue`;
        skillXPGainedLabel.textContent = `XP Gained:`;
        skillXPGainedLabel.style.color = '#ccc';
        skillXPGained.appendChild(skillXPGainedLabel);
        skillXPGained.appendChild(skillXPGainedValue);

        const skillXPLeft = document.createElement('div');
        skillXPLeft.id = `skillXPLeft`;
        skillXPLeft.style.fontSize = '12px';

        const skillXPLeftLabel = document.createElement('div');
        const skillXPLeftValue = document.createElement('div');
        skillXPLeftValue.id = `skillXPLeftValue`;
        skillXPLeftLabel.textContent = `XP Left:`;
        skillXPLeftLabel.style.color = '#ccc';
        skillXPLeft.appendChild(skillXPLeftLabel);
        skillXPLeft.appendChild(skillXPLeftValue);

        // Append to XP Details Left
        xpDetailsLeft.appendChild(skillXPGained);
        xpDetailsLeft.appendChild(skillXPLeft);

        // Right Side of XP Details
        const xpDetailsRight = document.createElement('div');
        xpDetailsRight.style.display = 'flex';
        xpDetailsRight.style.flexDirection = 'column';

        const skillXPPerHour = document.createElement('div');
        skillXPPerHour.id = `skillXPPerHour`;
        skillXPPerHour.style.fontSize = '12px';
        const skillXPPerHourLabel = document.createElement('div');
        const skillXPPerHourValue = document.createElement('div');
        skillXPPerHourValue.id = `skillXPPerHourValue`;
        skillXPPerHourLabel.textContent = `XP/Action:`;
        skillXPPerHourLabel.style.color = '#ccc';
        skillXPPerHour.appendChild(skillXPPerHourLabel);
        skillXPPerHour.appendChild(skillXPPerHourValue);

        const skillActionsLeft = document.createElement('div');
        skillActionsLeft.id = `skillActionsLeft`;
        skillActionsLeft.style.fontSize = '12px';
        const skillActionsLeftLabel = document.createElement('div');
        const skillActionsLeftValue = document.createElement('div');
        skillActionsLeftLabel.id = `skillActionsLeftLabel`;
        skillActionsLeftValue.id = `skillActionsLeftValue`;
        skillActionsLeftLabel.textContent = `Actions Left:`;
        skillActionsLeftLabel.style.color = '#ccc';
        skillActionsLeft.appendChild(skillActionsLeftLabel);
        skillActionsLeft.appendChild(skillActionsLeftValue);

        // Append to XP Details Right
        xpDetailsRight.appendChild(skillXPPerHour);
        xpDetailsRight.appendChild(skillActionsLeft);

        // Append to XP Details Container
        xpDetails.appendChild(xpDetailsLeft);
        xpDetails.appendChild(xpDetailsRight);

        // XP Bar
        const xpProgressBar = document.createElement('div');
        xpProgressBar.style.width = '100%';
        xpProgressBar.style.height = '15px';
        xpProgressBar.style.backgroundColor = '#80808069';
        xpProgressBar.style.borderRadius = '5px';
        xpProgressBar.style.marginTop = '5px';
        xpProgressBar.style.overflow = 'hidden';
        xpProgressBar.style.position = 'relative';
        const xpProgress = document.createElement('div');
        const currentLevelXP = this.levelToXP[skill._level];
        const nextLevelXP = this.levelToXP[skill._level + 1];
        const xpPercentage =
            (skill._xp - currentLevelXP) / (nextLevelXP - currentLevelXP);
        xpProgress.style.width = `${xpPercentage * 100}%`;
        xpProgress.id = `xpProgress`;
        xpProgress.style.height = '100%';
        xpProgress.style.backgroundColor = 'rgb(82 209 82)';
        xpProgress.style.transition = 'width 0.5s ease-in-out';
        xpProgress.style.position = 'absolute';
        xpProgressBar.appendChild(xpProgress);

        const xpProgressDetails = document.createElement('div');
        xpProgressDetails.style.margin = '0 5px';
        xpProgressDetails.style.fontSize = '12px';
        xpProgressDetails.style.position = 'absolute';
        xpProgressDetails.style.width = '-webkit-fill-available';
        xpProgressDetails.style.color = 'black';

        // Current Level Span
        const currentLevelSpan = document.createElement('span');
        currentLevelSpan.id = `currentLevelSpan`;
        currentLevelSpan.textContent = `Lvl. ${skill._level}`;

        // Next Level Span
        const nextLevelSpan = document.createElement('span');
        nextLevelSpan.id = `nextLevelSpan`;
        nextLevelSpan.textContent = `Lvl. ${skill._level + 1}`;
        nextLevelSpan.style.position = 'absolute';
        nextLevelSpan.style.right = '0';

        // XP Progress Span
        const xpProgressSpan = document.createElement('span');
        xpProgressSpan.id = `xpProgressSpan`;
        xpProgressSpan.textContent = `${(xpPercentage * 100).toFixed(1)}%`;
        xpProgressSpan.style.position = 'absolute';
        xpProgressSpan.style.left = '50%';
        xpProgressSpan.style.transform = 'translateX(-50%)';

        xpProgressDetails.appendChild(currentLevelSpan);
        xpProgressDetails.appendChild(xpProgressSpan);
        xpProgressDetails.appendChild(nextLevelSpan);
        xpProgressBar.appendChild(xpProgressDetails);
        skillTracker.appendChild(xpProgressBar);

        this.skillTrackers[skillName] = {
            trackerElement: skillTracker,
            trackedActions: 0,
            trackedXPGained: 0,
            previousXP: skill._xp,
            trackerXPGainedWindows: [],
            inXPPerHourMode: false,
            domElements: {
                skillXPGainedValue: skillXPGainedValue,
                skillXPLeftValue: skillXPLeftValue,
                skillXPPerHourValue: skillXPPerHourValue,
                skillActionsLeftValue: skillActionsLeftValue,
                skillActionsLeftLabel: skillActionsLeftLabel,
                xpProgress: xpProgress,
                currentLevelSpan: currentLevelSpan,
                nextLevelSpan: nextLevelSpan,
                xpProgressSpan: xpProgressSpan,
            },
        };

        // When the user hovers over the skill tracker, show a button in the middle of the tracker to hide it
        skillTracker.addEventListener('mouseenter', () => {
            // Actions Div
            const actionsDiv = document.createElement('div');
            actionsDiv.id = 'skillTrackerActions';
            actionsDiv.style.position = 'absolute';
            actionsDiv.style.left = '50%';
            actionsDiv.style.transform = 'translate(-25%, 10%)';
            actionsDiv.style.display = 'flex';
            actionsDiv.style.flexDirection = 'column';
            skillTracker.appendChild(actionsDiv);

            // Hide Button
            const hideButton = document.createElement('div');
            hideButton.textContent = 'Hide';
            hideButton.id = 'hideSkillTrackerButton';
            hideButton.style.backgroundColor = 'rgb(65 65 65)';
            hideButton.style.padding = '5px 10px';
            hideButton.style.borderRadius = '5px';
            hideButton.style.cursor = 'pointer';
            hideButton.addEventListener('click', () => {
                skillTracker.style.display = 'none'; // Hide the tracker
            });
            actionsDiv.appendChild(hideButton);

            // Switch to XP per Hour Button
            const xpPerHourButton = document.createElement('div');
            // Set text content based on the current mode
            xpPerHourButton.textContent = 'XP/Hour'; // Default text
            if (this.skillTrackers[skillName].inXPPerHourMode) {
                xpPerHourButton.textContent = 'Actions Left'; // If already in XP per hour mode, show Actions Left
            }
            xpPerHourButton.id = 'xpPerHourButton';
            xpPerHourButton.style.backgroundColor = 'rgb(65 65 65)';
            xpPerHourButton.style.padding = '5px 10px';
            xpPerHourButton.style.borderRadius = '5px';
            xpPerHourButton.style.marginTop = '5px';
            xpPerHourButton.style.cursor = 'pointer';
            xpPerHourButton.addEventListener('click', () => {
                const skillTracker = this.skillTrackers[skillName];
                if (skillTracker && !skillTracker.inXPPerHourMode) {
                    skillTracker.inXPPerHourMode = true;
                    xpPerHourButton.textContent = 'Actions Left'; // Change button text to Actions Left
                    // Update skillActionsLeftLabel to say "XP/Hour"
                    if (skillTracker.domElements) {
                        skillTracker.domElements.skillActionsLeftLabel.textContent =
                            'XP/Hour:';
                        const XPPerHour = this.calculateXPPerHour(skillTracker);
                        skillTracker.domElements.skillActionsLeftValue.textContent = `${abbreviateValue(XPPerHour)}`;
                    }
                } else if (skillTracker && skillTracker.inXPPerHourMode) {
                    skillTracker.inXPPerHourMode = false;
                    xpPerHourButton.textContent = 'XP/Hour'; // Change button text back to XP/Hour
                    // Update skillActionsLeftLabel to say "Actions Left"
                    if (skillTracker.domElements) {
                        skillTracker.domElements.skillActionsLeftLabel.textContent =
                            'Actions Left:';
                        const avgXPPerAction =
                            skillTracker.trackedActions > 0
                                ? skillTracker.trackedXPGained /
                                  skillTracker.trackedActions
                                : 0;
                        const actionsLeft =
                            avgXPPerAction > 0
                                ? Math.ceil(
                                      (this.levelToXP[skill._level + 1] -
                                          skill._xp) /
                                          avgXPPerAction
                                  )
                                : 0;
                        skillTracker.domElements.skillActionsLeftValue.textContent = `${abbreviateValue(actionsLeft)}`;
                    }
                }
            });

            actionsDiv.appendChild(xpPerHourButton);
        });

        skillTracker.addEventListener('mouseleave', () => {
            const actionsDiv = skillTracker.querySelector(
                '#skillTrackerActions'
            );
            if (!actionsDiv) {
                return; // No actions div to remove
            }
            const hideButton = skillTracker.querySelector(
                '#hideSkillTrackerButton'
            );
            if (hideButton) {
                actionsDiv.removeChild(hideButton);
            }

            const xpPerHourButton =
                skillTracker.querySelector('#xpPerHourButton');
            if (xpPerHourButton) {
                actionsDiv.removeChild(xpPerHourButton);
            }

            skillTracker.removeChild(actionsDiv);
        });

        skillTracker.style.display = 'none';
        this.panelContent?.appendChild(skillTracker);
    }

    updateSkillListing(skill: Skill): void {
        const skillName: string = this.gameLookups['Skills'][skill._skill];
        let skillTracker = this.skillTrackers[skillName];

        if (!skillTracker) {
            this.createSkillListing(skill);
            skillTracker = this.skillTrackers[skillName];
        }

        if (!skillTracker || skill._xp === skillTracker.previousXP) {
            return; // No change in XP or tracker not available
        }

        skillTracker.trackerElement.style.display = 'flex'; // Show the tracker if it was hidden

        const xpGained = skill._xp - skillTracker.previousXP; // Also XP per Action

        // Update the XP tracking windows
        this.updateXPWindows(skillTracker, xpGained);

        skillTracker.trackedXPGained += xpGained;
        skillTracker.trackedActions += 1;
        skillTracker.previousXP = skill._xp;

        // Update new values in the tracker using cached DOM elements
        const domElements = skillTracker.domElements;
        if (!domElements) {
            console.warn('DOM elements not cached for skill:', skillName);
            return;
        }

        domElements.skillXPGainedValue.textContent = `${abbreviateValue(skillTracker.trackedXPGained)}`;
        domElements.skillXPLeftValue.textContent = `${abbreviateValue(this.levelToXP[skill._level + 1] - skill._xp)}`;

        // Protect against division by zero
        const avgXPPerAction =
            skillTracker.trackedActions > 0
                ? Math.floor(
                      skillTracker.trackedXPGained / skillTracker.trackedActions
                  )
                : 0;
        domElements.skillXPPerHourValue.textContent = `${abbreviateValue(avgXPPerAction)}`;

        if (!skillTracker.inXPPerHourMode) {
            const actionsLeft =
                avgXPPerAction > 0
                    ? Math.ceil(
                          (this.levelToXP[skill._level + 1] - skill._xp) /
                              avgXPPerAction
                      )
                    : 0;
            domElements.skillActionsLeftValue.textContent = `${abbreviateValue(actionsLeft)}`;
        } else {
            const XPPerHour = this.calculateXPPerHour(skillTracker);
            domElements.skillActionsLeftValue.textContent = `${abbreviateValue(XPPerHour)}`;
        }

        // Update XP progress bar and level information
        const currentLevelXP = this.levelToXP[skill._level];
        const nextLevelXP = this.levelToXP[skill._level + 1];
        const xpPercentage =
            (skill._xp - currentLevelXP) / (nextLevelXP - currentLevelXP);

        domElements.xpProgress.style.width = `${xpPercentage * 100}%`;
        domElements.currentLevelSpan.textContent = `Lvl. ${skill._level}`;
        domElements.nextLevelSpan.textContent = `Lvl. ${skill._level + 1}`;
        domElements.xpProgressSpan.textContent = `${(xpPercentage * 100).toFixed(1)}%`;
    }

    GameLoop_update() {
        if (!this.settings.enable.value) {
            return;
        }

        const resourceSkills =
            this.gameHooks.EntityManager.Instance.MainPlayer.Skills._skills;
        resourceSkills.forEach(skill => {
            this.updateSkillListing(skill);
        });

        const combatSkills =
            this.gameHooks.EntityManager.Instance.MainPlayer.Combat._skills;
        combatSkills.forEach(skill => {
            this.updateSkillListing(skill);
        });
    }

    stop(): void {
        this.panelManager.removeMenuItem('📊');
        this.skillTrackers = {};
        this.log(`Stopped`);
    }

    init(): void {
        this.log(`Initialized`);
    }

    private getCurrentWindowStart(): number {
        const now = Date.now();
        return (
            Math.floor(now / this.WINDOW_DURATION_MS) * this.WINDOW_DURATION_MS
        );
    }

    private updateXPWindows(
        skillTracker: SkillTracker,
        xpGained: number
    ): void {
        const currentWindowStart = this.getCurrentWindowStart();

        // Find or create current window
        let currentWindow = skillTracker.trackerXPGainedWindows.find(
            window => window.windowStart === currentWindowStart
        );

        if (currentWindow) {
            currentWindow.xpGained += xpGained;
            currentWindow.actions += 1;
        } else {
            // Create new window
            skillTracker.trackerXPGainedWindows.push({
                xpGained: xpGained,
                actions: 1,
                windowStart: currentWindowStart,
            });
        }

        // Remove old windows (keep only the last MAX_WINDOWS)
        skillTracker.trackerXPGainedWindows =
            skillTracker.trackerXPGainedWindows
                .filter(
                    window =>
                        currentWindowStart - window.windowStart <
                        this.MAX_WINDOWS * this.WINDOW_DURATION_MS
                )
                .sort((a, b) => b.windowStart - a.windowStart)
                .slice(0, this.MAX_WINDOWS);
    }

    private calculateXPPerHour(skillTracker: SkillTracker): number {
        if (skillTracker.trackerXPGainedWindows.length === 0) {
            return 0;
        }

        const totalXPGained = skillTracker.trackerXPGainedWindows.reduce(
            (total, window) => {
                return total + window.xpGained;
            },
            0
        );

        const totalWindowsUsed = skillTracker.trackerXPGainedWindows.length;
        const totalTimeMinutes = totalWindowsUsed * this.MINUTES_PER_WINDOW;

        // Calculate XP per hour: (total XP / total minutes) * 60
        return totalTimeMinutes > 0
            ? (totalXPGained / totalTimeMinutes) * this.MINUTES_PER_HOUR
            : 0;
    }
}
