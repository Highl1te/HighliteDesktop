import type { GameCameraManager } from "src/renderer/client/highlite/core/interfaces/game/GameCameraManager.class";
import type { ContextMenuManager } from "src/renderer/client/highlite/core/managers/game/contextMenuManager";
import type { DatabaseManager } from "src/renderer/client/highlite/core/managers/highlite/databaseManager";
import type { HookManager } from "src/renderer/client/highlite/core/managers/highlite/hookManager";
import type { NotificationManager } from "src/renderer/client/highlite/core/managers/highlite/notificationManager";
import type { PanelManager } from "src/renderer/client/highlite/core/managers/highlite/panelManager";
import type { PluginManager } from "src/renderer/client/highlite/core/managers/highlite/pluginManger";
import type { SettingsManager } from "src/renderer/client/highlite/core/managers/highlite/settingsManager";
import type { SoundManager } from "src/renderer/client/highlite/core/managers/highlite/soundsManager";
import type { UIManager } from "src/renderer/client/highlite/core/managers/highlite/uiManager";

export {};

declare global {
    interface Window {
        [key: string]: any,
    }

    interface Document {
        highlite: {
            managers: {
              HookManager: HookManager;
              ContextMenuManager: ContextMenuManager;
              NotificationManager: NotificationManager;
              PluginManager: PluginManager;
              UIManager: UIManager;
              PanelManager: PanelManager;
              SoundManager: SoundManager;
              SettingsManager: SettingsManager;
              DatabaseManager: DatabaseManager;
              [key: string]: any;
            };
            gameHooks: {
                GameCameraManager: GameCameraManager;
                [key: string]: any;
            };
            gameLookups: {
                [key: string]: any;
            };
            plugins: any[];
        };

        client: {
            [key: string]: any,
        },

        game: {
            [key: string]: any,
        }
    }
}