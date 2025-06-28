import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";
import { NotificationManager } from "../core/managers/highlite/notificationManager";
import { SoundManager } from "../core/managers/highlite/soundsManager";

export class TradeAlerts extends Plugin {
    pluginName = "Trade Alerts";
    author = "Highlite";
    private notificationManager: NotificationManager = new NotificationManager();
    private soundManager : SoundManager = new SoundManager();

    constructor() {
      super();
      this.settings.volume = {
          text: "Volume",
          type: SettingsTypes.range,
          value: 50,
          callback: () => Function("NOOP")
      };
      this.settings.notification = {
          text: "Notification",
          type: SettingsTypes.checkbox,
          value: false,
          callback: () => Function("NOOP")
      };
      this.settings.sound = {
          text: "Sound",
          type: SettingsTypes.checkbox,
          value: true,
          callback: () => Function("NOOP")
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

    SocketManager_handleTradeRequestedPacket(players : any) 
    {
        if (players[0] !== this.gameHooks.EntityManager.Instance.MainPlayer.EntityID && players.includes(this.gameHooks.EntityManager.Instance.MainPlayer.EntityID)) {
          if (this.settings.notification?.value as boolean) {
            this.gameHooks.EntityManager.Instance.Players.forEach((player : any) => {
              if (player.EntityID === players[0]) {
                this.notificationManager.createNotification("You have received a trade request from " + player.Name);
                return;
              }
            });
          }

          if (this.settings.sound?.value as boolean) {
            this.soundManager.playSound("https://cdn.pixabay.com/download/audio/2025/05/06/audio_2fd68b9a9a.mp3", (this.settings.volume?.value as number / 100));
          }
        }
    }
  }
