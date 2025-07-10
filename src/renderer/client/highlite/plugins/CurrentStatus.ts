import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { ActionState } from '../core/interfaces/game/ActionStates.enum';
import { UIManager, UIManagerScope } from "../core/managers/highlite/uiManager";

// display the current status of the player
export class CurrentStatus extends Plugin {
    pluginName: string = "Current Status";
    author = "Doodleman360";
    private uiManager = new UIManager();
    private statusUI: HTMLElement | null = null;
    private statusValueUI: HTMLElement | null = null;
    private isLoggedIn = false;

    constructor() {
        super();
    }

    init(): void {
        this.log("Initialized");
    }

    start(): void {
        this.log("Started");
        if (this.settings.enable.value && this.isLoggedIn && !this.statusUI) {
            this.createStatusUI();
        }
    }

    stop(): void {
        this.log("Stopped");
        if (this.statusUI) {
            this.statusUI.remove();
            this.statusUI = null;
        }
    }

    // Create UI Element
    private createStatusUI(): void {
        if (this.statusUI) {
            this.statusUI.remove();
        }
        this.statusUI = this.uiManager.createElement(UIManagerScope.ClientInternal);
        if (!this.statusUI) {
            this.log("Failed to create status UI element.");
            this.settings.enable.value = false;
            return;
        }

        this.statusUI.style.position = "absolute";
        this.statusUI.style.height = "auto";
        this.statusUI.style.zIndex = "1000";
        this.statusUI.style.right = "235px";
        this.statusUI.style.bottom = "110px";
        this.statusUI.style.display = "flex";
        this.statusUI.style.flexDirection = "column";
        this.statusUI.style.justifyContent = "space-evenly";
        this.statusUI.style.width = "auto";
        this.statusUI.style.padding = "10px";
        this.statusUI.classList.add("hs-menu", "hs-game-menu");

        // Create Sub-Span Element
        const statusSpan = document.createElement("span");
        statusSpan.style.display = "flex";
        statusSpan.style.justifyContent = "center";

        // Value
        this.statusValueUI = document.createElement("span");
        this.statusValueUI.innerText = "Idle";
        statusSpan.appendChild(this.statusValueUI);

        this.statusUI.appendChild(statusSpan);
    }

    // Logged In
    SocketManager_loggedIn(): void {
        this.isLoggedIn = true;
        if (!this.settings.enable.value) return;
        if (this.statusUI) {
            this.statusUI.remove();
            this.statusUI = null;
        }
        this.createStatusUI();
    }

    // Logged Out
    SocketManager_handleLoggedOut(): void {
        this.isLoggedIn = false;
        if (this.statusUI) {
            this.statusUI.remove();
            this.statusUI = null;
        }
    }

    GameLoop_update(...args: any) {
        if (!this.settings.enable.value) {
            return;
        }
        if (!this.statusUI) {
            return;
        }
        // Position adjustment like CoinCounter
        if (document.getElementsByClassName("hs-game-menu--opened").length === 0) {
            this.statusUI.style.right = "6px";
            this.statusUI.style.transition = "all 0.1s ease-in-out";
        } else {
            this.statusUI.style.right = "235px";
            this.statusUI.style.transition = "none";
        }

        const player = this.gameHooks.EntityManager.Instance._mainPlayer;
        if (!player) return;

        const currentState = ActionState[player._currentState.getCurrentState()].replace(/State$/, "");
        if (this.statusValueUI) {
            this.statusValueUI.innerText = currentState;
        }
    }
}