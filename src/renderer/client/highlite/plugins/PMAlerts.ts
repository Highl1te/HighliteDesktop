import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";
import { NotificationManager } from "../core/managers/highlite/notificationManager";
import { SoundManager } from "../core/managers/highlite/soundsManager";

export class PMAlerts extends Plugin {
    pluginName = "PM Alerts";
    author = "Highlite";
    private notificationManager: NotificationManager = new NotificationManager();
    private soundManager : SoundManager = new SoundManager();

    constructor() {
        super();
        this.settings.volume = {
            text: "Volume",
            type: SettingsTypes.range,
            value: 50,
            callback: () => { } //TODO 
        };
        this.settings.notification = {
            text: "Notification",
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => { } //TODO 
        };
        this.settings.sound = {
            text: "Sound",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => { } //TODO 
        }
    }
  
    
    start(): void {
        this.log("Started");
    }

    stop(): void {
        this.log("Stopped");
    }

    init(): void {
        this.log("Initialized");
    }


    PrivateChatMessageList_addChatMessage(e: string, t: any, i: any, n: any, r: any, s: any, a: any, o: any, l: any, h: any) {
        if (e !== undefined && e !== null && e.startsWith("From")) {
            if (this.settings.notification!.value as boolean) {
                this.notificationManager.createNotification("You have received a private message from" + e.replace("From ", " "));
            }
            if (this.settings.sound!.value as boolean) {
                this.soundManager.playSound("https://cdn.pixabay.com/download/audio/2024/11/27/audio_e6b2e5efcc.mp3", (this.settings.volume!.value as number / 100));
            }
        }
    }

  }
