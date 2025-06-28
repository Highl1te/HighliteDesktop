import { Plugin } from '../../core/interfaces/highlite/plugin/plugin.class';
import { ActionState } from '../../core/interfaces/game/ActionStates.enum';
import { IdleOverlay } from './IdleOverlay';
import { NotificationManager } from '../../core/managers/highlite/notificationManager';
import { SoundManager } from '../../core/managers/highlite/soundsManager';
import { SettingsTypes } from '../../core/interfaces/highlite/plugin/pluginSettings.interface';

export class IdleAlert extends Plugin {
    private notificationManager: NotificationManager = new NotificationManager();
    private soundManager : SoundManager = new SoundManager();
    pluginName: string = "Idle Alert";
    author = "Highlite";

    constructor() {
        super();
        this.settings.volume = {
            text: "Volume",
            type: SettingsTypes.range,
            value: 50,
            callback: () => { } //TODO 
        };
        this.settings.activationTicks = {
            text: "Activation Ticks",
            type: SettingsTypes.range,
            value: 20,
            callback: () => { } //TODO 
        };
        this.settings.notification = {
            text: "Notification",
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => { } //TODO 
        };

        this.settings.idleOverlay = {
            text: "Overlay",
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => { } //TODO 
        };
    }

    ignoredStates: ActionState[] = [ActionState.BankingState, ActionState.ClimbSameMapLevelState, ActionState.GoThroughDoorState, ActionState.PlayerLoggingOutState, ActionState.PlayerDeadState, ActionState.StunnedState, ActionState.TradingState];
    actionState : number = ActionState.IdleState;
    idleTicks : number = 0;
    shouldTick : boolean = false;

    idleOverlay : IdleOverlay = new IdleOverlay();

    init(): void {
        this.log("Initialized");
    }
    start(): void {
        this.log("Started");
    }
    stop(): void {
        this.log("Stopped");
    }
    
    GameLoop_update(...args : any) {
        if (!this.settings.enable.value) {
            return;
        }
        const player = this.gameHooks.EntityManager.Instance._mainPlayer;

        if (player === undefined) {
            return;
        }

        if (this.ignoredStates.includes(player._currentState.getCurrentState())) {
            return;
        }

        // If player moves we stop tracking ticks since they are no longer during an "AFK" action.
        if (player._isMoving && player._currentTarget == null && player._currentState.getCurrentState() == ActionState.IdleState) {
            this.shouldTick = false;
            this.actionState = ActionState.IdleState;
            return;
        } else {
            this.shouldTick = true;
        }

        // Updates system so we know we have been doing actions
        if (player._currentState.getCurrentState() !== ActionState.IdleState) {
            this.actionState = player._currentState.getCurrentState();
        }

        if (player._currentState.getCurrentState() == ActionState.IdleState && this.actionState !== ActionState.IdleState && player._currentTarget == null && this.shouldTick) {
            this.idleTicks++
        } else {
            this.idleTicks = 0;
        }

        if (this.idleTicks > (this.settings.activationTicks!.value as number)) {
            if (this.settings.notification!.value) {``
                this.notificationManager.createNotification(`${player._name} is idle!`);
            }

            // TODO: settings.notificationOverlay?
            if (this.settings.idleOverlay!.value) {
                this.idleOverlay.show();
            }

            this.soundManager.playSound("https://cdn.pixabay.com/download/audio/2024/04/01/audio_e939eebbb1.mp3?filename=level-up-3-199576.mp3", (this.settings.volume!.value as number / 100));

            this.actionState = 0;
            this.idleTicks = 0;
        }
    }


}

