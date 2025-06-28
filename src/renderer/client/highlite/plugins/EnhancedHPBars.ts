import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";

export class EnhancedHPBars extends Plugin {
    pluginName = "Enhanced HP Bars";

    targetContainer : HTMLDivElement | null = null;
    previousTarget : any | null = null;
    lostTargetTime : number | null = null;
    
    // Player health elements (left side)
    playerNameDiv : HTMLDivElement | null = null;
    playerHealthBarBack : HTMLDivElement | null = null;
    playerHealthBarFront : HTMLDivElement | null = null;
    playerHealthText : HTMLSpanElement | null = null;
    
    // Enemy health elements (right side)
    nameDiv : HTMLDivElement | null = null;
    healthBarBack : HTMLDivElement | null = null;
    healthBarFront : HTMLDivElement | null = null;
    healthText : HTMLSpanElement | null = null;

    playerAction : string | null = null;
    playerTarget : any | null = null;

    constructor() {
        super();
        this.settings.centerWindow = {
            text: "Center Window",
            type: 0,
            value: false,
            callback: () => {
                this.updatePosition(this.settings.centerWindow!.value as boolean);
            }
        };
    }

    updatePosition(enabled : boolean) {
        if (!this.targetContainer) return;
        
        const playerSection = document.getElementById("highlite-player-section");
        const enemySection = document.getElementById("highlite-enemy-section");
        
        if (enabled) {
            // Center position at top of screen (larger, side-by-side layout)
            this.targetContainer.style.left = "50%";
            this.targetContainer.style.top = "10px";
            this.targetContainer.style.right = "auto";
            this.targetContainer.style.transform = "translateX(-50%)";
            this.targetContainer.style.width = "400px";
            this.targetContainer.style.height = "100px";
            this.targetContainer.style.flexDirection = "column";
            
            // Add combat header if it doesn't exist
            let combatHeader = document.getElementById("highlite-combat-header");
            if (!combatHeader) {
                combatHeader = document.createElement("div");
                combatHeader.id = "highlite-combat-header";
                combatHeader.style.textAlign = "center";
                combatHeader.style.fontSize = "14px";
                combatHeader.style.fontWeight = "bold";
                combatHeader.style.fontFamily = "Inter";
                combatHeader.style.marginTop = "10px";
                combatHeader.style.marginBottom = "5px";
                combatHeader.style.color = "white";
                combatHeader.style.textShadow = "1px 1px 1px rgba(0,0,0,0.8)";
                combatHeader.innerText = "Combat";
                this.targetContainer.insertBefore(combatHeader, this.targetContainer.firstChild);
            }
            
            // Create side-by-side container
            let sideBySideContainer = document.getElementById("highlite-side-by-side-container");
            if (!sideBySideContainer) {
                sideBySideContainer = document.createElement("div");
                sideBySideContainer.id = "highlite-side-by-side-container";
                sideBySideContainer.style.display = "flex";
                sideBySideContainer.style.flexDirection = "row";
                sideBySideContainer.style.gap = "20px";
                sideBySideContainer.style.flex = "1";
                
                // Move sections to side-by-side container
                if (playerSection && enemySection) {
                    sideBySideContainer.appendChild(playerSection);
                    sideBySideContainer.appendChild(enemySection);
                    this.targetContainer.appendChild(sideBySideContainer);
                }
            }
            
        } else {
            // Normal position (right side, vertical layout)
            this.targetContainer.style.left = "auto";
            this.targetContainer.style.top = "260px";
            this.targetContainer.style.right = "6px";
            this.targetContainer.style.transform = "none";
            this.targetContainer.style.width = "200px";
            this.targetContainer.style.height = "90px";
            this.targetContainer.style.flexDirection = "column";
            
            // Remove combat header and side-by-side container
            const combatHeader = document.getElementById("highlite-combat-header");
            const sideBySideContainer = document.getElementById("highlite-side-by-side-container");
            
            if (combatHeader) {
                combatHeader.remove();
            }
            
            if (sideBySideContainer && playerSection && enemySection) {
                // Move sections back to main container
                this.targetContainer.appendChild(playerSection);
                this.targetContainer.appendChild(enemySection);
                sideBySideContainer.remove();
            }
        }
    }

    createTargetContainer() {
        this.targetContainer = document.createElement("div");
        this.targetContainer.id = "highlite-target-container";
        this.targetContainer.className = "hs-menu hs-game-menu";
        this.targetContainer.style.position = "absolute";
        this.targetContainer.style.height = "90px";
        this.targetContainer.style.width = "200px";
        this.targetContainer.style.zIndex = "1000";
        this.targetContainer.style.right = "6px";
        this.targetContainer.style.top = "260px";
        this.targetContainer.style.display = "flex";
        this.targetContainer.style.flexDirection = "column";
        this.targetContainer.style.justifyContent = "space-between";
        this.targetContainer.style.gap = "10px";
        document.getElementById("hs-screen-mask")?.appendChild(this.targetContainer);

        // Player health section (left side)
        const playerSection = document.createElement("div");
        playerSection.id = "highlite-player-section";
        playerSection.style.display = "flex";
        playerSection.style.flexDirection = "column";
        playerSection.style.flex = "1";
        this.targetContainer.appendChild(playerSection);

        this.playerNameDiv = document.createElement("div");
        this.playerNameDiv.id = "highlite-player-name";
        this.playerNameDiv.style.textAlign = "center";
        this.playerNameDiv.style.fontSize = "12px";
        this.playerNameDiv.style.fontWeight = "bold";
        this.playerNameDiv.style.fontFamily = "Inter";
        this.playerNameDiv.style.marginBottom = "5px";
        this.playerNameDiv.innerText = "Player";
        playerSection.appendChild(this.playerNameDiv);

        const playerHealthBarContainer = document.createElement("div");
        playerHealthBarContainer.id = "highlite-player-healthbar-container";
        playerHealthBarContainer.style.display = "flex";
        playerHealthBarContainer.style.justifyContent = "center";
        playerSection.appendChild(playerHealthBarContainer);

        const playerHealthBar = document.createElement("div");
        playerHealthBar.id = "highlite-player-healthbar";
        playerHealthBar.style.width = "90%";
        playerHealthBar.style.height = "15px";
        playerHealthBar.style.display = "flex";
        playerHealthBar.style.position = "relative";
        playerHealthBarContainer.appendChild(playerHealthBar);

        this.playerHealthBarBack = document.createElement("div");
        this.playerHealthBarBack.id = "highlite-player-healthbar-back";
        this.playerHealthBarBack.style.width = "100%";
        this.playerHealthBarBack.style.height = "15px";
        this.playerHealthBarBack.style.backgroundColor = "rgba(242, 67, 67, 0.5)";
        this.playerHealthBarBack.style.display = "flex";
        playerHealthBar.appendChild(this.playerHealthBarBack);

        this.playerHealthBarFront = document.createElement("div");
        this.playerHealthBarFront.id = "highlite-player-healthbar-front";
        this.playerHealthBarFront.style.width = "100%";
        this.playerHealthBarFront.style.height = "15px";
        this.playerHealthBarFront.style.backgroundColor = "rgba(88, 162, 23, 1)";
        this.playerHealthBarFront.style.display = "flex";
        this.playerHealthBarFront.style.transition = "width 0.5s ease-in-out";
        this.playerHealthBarBack.appendChild(this.playerHealthBarFront);

        this.playerHealthText = document.createElement("span");
        this.playerHealthText.id = "highlite-player-health-text";
        this.playerHealthText.style.fontSize = "10px";
        this.playerHealthText.style.fontWeight = "bold";
        this.playerHealthText.style.fontFamily = "Inter";
        this.playerHealthText.style.position = "absolute";
        this.playerHealthText.style.left = "50%";
        this.playerHealthText.style.top = "50%";
        this.playerHealthText.style.transform = "translate(-50%, -50%)";
        this.playerHealthText.style.color = "white";
        this.playerHealthText.style.textShadow = "1px 1px 1px rgba(0,0,0,0.8)";
        playerHealthBar.appendChild(this.playerHealthText);

        // Enemy health section (right side)
        const enemySection = document.createElement("div");
        enemySection.id = "highlite-enemy-section";
        enemySection.style.display = "flex";
        enemySection.style.flexDirection = "column";
        enemySection.style.flex = "1";
        this.targetContainer.appendChild(enemySection);

        this.nameDiv = document.createElement("div");
        this.nameDiv.id = "highlite-target-name";
        this.nameDiv.style.textAlign = "center";
        this.nameDiv.style.fontSize = "12px";
        this.nameDiv.style.fontWeight = "bold";
        this.nameDiv.style.fontFamily = "Inter";
        this.nameDiv.style.marginBottom = "5px";
        enemySection.appendChild(this.nameDiv);

        const healthBarContainer = document.createElement("div");
        healthBarContainer.id = "highlite-target-healthbar-container";
        healthBarContainer.style.display = "flex";
        healthBarContainer.style.justifyContent = "center";
        enemySection.appendChild(healthBarContainer);

        const healthBar = document.createElement("div");
        healthBar.id = "highlite-target-healthbar";
        healthBar.style.width = "90%";
        healthBar.style.height = "15px";
        healthBar.style.display = "flex";
        healthBar.style.position = "relative";
        healthBarContainer.appendChild(healthBar);

        this.healthBarBack = document.createElement("div");
        this.healthBarBack.id = "highlite-target-healthbar-back";
        this.healthBarBack.style.width = "100%";
        this.healthBarBack.style.height = "15px";
        this.healthBarBack.style.backgroundColor = "rgba(242, 67, 67, 0.5)";
        this.healthBarBack.style.display = "flex";
        healthBar.appendChild(this.healthBarBack);

        this.healthBarFront = document.createElement("div");
        this.healthBarFront.id = "highlite-target-healthbar-front";
        this.healthBarFront.style.width = "100%";
        this.healthBarFront.style.height = "15px";
        this.healthBarFront.style.backgroundColor = "rgba(88, 162, 23, 1)";
        this.healthBarFront.style.display = "flex";
        this.healthBarFront.style.transition = "width 0.5s ease-in-out";
        this.healthBarBack.appendChild(this.healthBarFront);

        this.healthText = document.createElement("span");
        this.healthText.id = "highlite-target-health-text";
        this.healthText.style.fontSize = "10px";
        this.healthText.style.fontWeight = "bold";
        this.healthText.style.fontFamily = "Inter";
        this.healthText.style.position = "absolute";
        this.healthText.style.left = "50%";
        this.healthText.style.top = "50%";
        this.healthText.style.transform = "translate(-50%, -50%)";
        this.healthText.style.color = "white";
        this.healthText.style.textShadow = "1px 1px 1px rgba(0,0,0,0.8)";
        healthBar.appendChild(this.healthText);
        
        // Apply the current position setting
        this.updatePosition(this.settings.centerWindow!.value as boolean);
    }

    init() : void {
        this.log("Initializing");
    }

    start() : void {
        this.log("Started");
        if (this.settings.enable.value && document.getElementById("hs-screen-mask") !== null) {
            this.createTargetContainer();
        }
    }

    stop() : void {
        // Destroy the target container if it exists
        this.targetContainer?.remove();
    }

    SocketManager_loggedIn(..._args : any) {
        if (!this.settings.enable.value) {
            return;
        }
        
        // Use the same createTargetContainer method for consistency
        this.createTargetContainer();
    }

    GameLoop_draw() {
        if (!this.settings.enable.value) {
            return;
        }

        if (!this.targetContainer || !this.nameDiv || !this.healthBarBack || !this.healthText || !this.healthBarFront || 
            !this.playerNameDiv || !this.playerHealthBarBack || !this.playerHealthText || !this.playerHealthBarFront) {
            return;
        }

        // Update player health information
        const player = this.gameHooks.EntityManager.Instance.MainPlayer;
        if (player && player.Hitpoints) {
            this.playerHealthText.innerText = `${player.Hitpoints.CurrentLevel}/${player.Hitpoints.Level}`;
            this.playerHealthBarFront.style.width = `${(player.Hitpoints.CurrentLevel / player.Hitpoints.Level) * 100}%`;
        }

        // If the currentTarget == this.playerTarget and the playerAction is "attack", then we show the target container
        // If the currentTarget is null, and the playerAction is "attack", we show the last target for 20 seconds
        // If the currentTarget is null, and the playerAction is not "attack", but an NPC has the player as a target show the NPC's name and health

        const target = this.gameHooks.EntityManager.Instance.MainPlayer.CurrentTarget;
        if (target == this.playerTarget && this.playerAction == "attack") {
            this.targetContainer.style.visibility = "visible";
            this.nameDiv.innerText = target.Name;
            this.healthText.innerText = `${target.Hitpoints.CurrentLevel}/${target.Hitpoints.Level}`;
            this.healthBarFront.style.width = `${(target.Hitpoints.CurrentLevel / target.Hitpoints.Level) * 100}%`;
            this.previousTarget = target;
            this.lostTargetTime = null;
        } else if (!target && this.previousTarget && this.playerAction == "attack") {
            if (!this.lostTargetTime) {
                this.lostTargetTime = Date.now();
            }
            if ((Date.now() - this.lostTargetTime) >= 20000) {
                this.lostTargetTime = null;
                this.previousTarget = null;
                return;
            }
            this.targetContainer.style.visibility = "visible";
            this.nameDiv.innerText = this.previousTarget.Name;
            if (!this.previousTarget.Hitpoints) {
                this.previousTarget = null; // Target has likely died or is no longer in the current chunk.
                return;
            }
            this.healthText.innerText = `${this.previousTarget.Hitpoints.CurrentLevel}/${this.previousTarget.Hitpoints.Level}`;
            this.healthBarFront.style.width = `${(this.previousTarget.Hitpoints.CurrentLevel / this.previousTarget.Hitpoints.Level) * 100}%`;
        } else {
            // Find the first NPC that has the player as a target
            const npcs = this.gameHooks.EntityManager.Instance.NPCs.entries();
            const playerID = this.gameHooks.EntityManager.Instance.MainPlayer.EntityID;

            for (const [_id, npc] of npcs) {
                if (npc.CurrentTarget && npc.CurrentTarget.EntityID === playerID) {
                    this.targetContainer.style.visibility = "visible";
                    this.nameDiv.innerText = npc.Name;
                    this.healthText.innerText = `${npc.Hitpoints.CurrentLevel}/${npc.Hitpoints.Level}`;
                    this.healthBarFront.style.width = `${(npc.Hitpoints.CurrentLevel / npc.Hitpoints.Level) * 100}%`;
                    return;
                }
            }

            // If no NPC has the player as a target, hide the target container
            this.targetContainer.style.visibility = "hidden";
        }

    }

    BV_handleTargetAction(actionNumber, targetEntity) {
        this.playerAction = this.gameLookups.GameWorldActions[actionNumber];
        this.playerTarget = targetEntity;
    }
}
