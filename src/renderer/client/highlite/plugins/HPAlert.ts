import { NotificationManager } from '../core/managers/highlite/notificationManager';
import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';
import { SoundManager } from '../core/managers/highlite/soundsManager';

export class HPAlert extends Plugin {
    pluginName = 'HP Alert';
    author = 'Highlite';
    private notificationManager: NotificationManager =
        new NotificationManager();
    private doNotify = true;
    private soundManager: SoundManager = new SoundManager();

    constructor() {
        super();
        this.settings.volume = {
            text: 'Volume',
            type: SettingsTypes.range,
            value: 50,
            callback: () => {}, //NOOP
        };
        this.settings.activationPercent = {
            text: 'Activation Percent',
            type: SettingsTypes.range,
            value: 50,
            callback: () => {}, //NOOP
        };
        this.settings.notification = {
            text: 'Notification',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {}, //NOOP
        };
        this.settings.sound = {
            text: 'Sound',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {}, //NOOP
        };
    }

    init(): void {
        this.log('Initializing');
    }

    start(): void {
        this.log('Started');
    }

    stop(): void {
        this.log('Stopped');
    }

    GameLoop_update(...args: any) {
        if (!this.settings.enable.value) {
            return;
        }
        const player = this.gameHooks.EntityManager.Instance._mainPlayer;
        const localNPCs = this.gameHooks.EntityManager.Instance._npcs;

        if (player === undefined) {
            return;
        }

        if (player._hitpoints == undefined) {
            return;
        }

        if (
            player._hitpoints._currentLevel / player._hitpoints._level <
            (this.settings.activationPercent?.value as number) / 100
        ) {
            if (this.doNotify && this.settings.notification?.value) {
                this.doNotify = false;
                this.notificationManager.createNotification(
                    `${player._name} is low on health!`
                );
            }

            // Check if any entity in localEntities (map object) .CurrentTarget is the player
            const isPlayerTargeted = localNPCs.entries().some(([_, npc]) => {
                if (
                    npc._currentTarget !== undefined &&
                    npc._currentTarget !== null &&
                    npc.Def.Combat != null &&
                    npc.Def.Combat != undefined
                ) {
                    if (npc._currentTarget._entityId == player._entityId) {
                        return true;
                    }
                }
            });

            if (
                this.settings.sound?.value &&
                (isPlayerTargeted ||
                    (player.CurrentTarget !== undefined &&
                        player.CurrentTarget !== null &&
                        player.CurrentTarget.Combat != null &&
                        player.CurrentTarget != undefined))
            ) {
                this.soundManager.playSound(
                    'https://cdn.pixabay.com/download/audio/2022/03/20/audio_c35359a867.mp3',
                    (this.settings.volume!.value as number) / 100
                );
            }
        } else {
            this.doNotify = true;
        }
    }
}
