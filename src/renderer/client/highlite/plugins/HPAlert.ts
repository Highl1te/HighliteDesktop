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
        this.settings.useCustomSound = {
            text: 'Use Custom Sound',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {}, //NOOP
        };
        this.settings.customSoundUrl = {
            text: 'Custom Sound URL',
            type: SettingsTypes.text,
            value: '',
            callback: () => {
                // Optional: Log when URL changes
                const url = this.settings.customSoundUrl.value as string;
                if (url) {
                    this.log(`Custom sound URL updated: ${url}`);
                }
            },
        };
        this.settings.testCustomSound = {
            text: 'Test Custom Sound',
            type: SettingsTypes.button,
            value: 'Play Sound',
            callback: () => this.testPlayCustomSound(),
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

    private testPlayCustomSound(): void {
        try {
            const customSoundUrl = this.settings.customSoundUrl?.value as string;
            const volume = (this.settings.volume?.value as number) / 100;

            if (!customSoundUrl || customSoundUrl.trim() === '') {
                alert('Please enter a custom sound URL first');
                this.log('No custom sound URL provided for test');
                return;
            }

            this.log(`Testing custom sound: ${customSoundUrl}`);
            this.soundManager.playSound(customSoundUrl, volume);
            
        } catch (error) {
            this.error(`Error testing custom sound: ${error}`);
            alert('Failed to play custom sound. Please check the URL and try again.');
        }
    }

    GameLoop_update(): void {
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
                    // Use custom sound if enabled and url exists, otherwise use default
                    this.settings.useCustomSound && this.settings.customSoundUrl.value != '' ? this.settings.customSoundUrl.value as string :
                    'https://cdn.pixabay.com/download/audio/2022/03/20/audio_c35359a867.mp3',
                    (this.settings.volume!.value as number) / 100
                );
            }
        } else {
            this.doNotify = true;
        }
    }
}
