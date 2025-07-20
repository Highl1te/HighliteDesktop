import type { HookManager } from '../../managers/highlite/hookManager';
import type { ContextMenuManager } from '../../managers/game/contextMenuManager';
import type { NotificationManager } from '../../managers/highlite/notificationManager';
import type { PluginManager } from '../../managers/highlite/pluginManger';
import type { UIManager } from '../../managers/highlite/uiManager';
import type { PanelManager } from '../../managers/highlite/panelManager';
import type { SettingsManager } from '../../managers/highlite/settingsManager';
import type { DatabaseManager } from '../../managers/highlite/databaseManager';
import type { SoundManager } from '../../managers/highlite/soundsManager';

export interface IHighlite {
    hookManager: HookManager;
    contextMenuManager: ContextMenuManager;
    notificationManager: NotificationManager;
    pluginManager: PluginManager;
    uiManager: UIManager;
    panelManager: PanelManager;
    settingsManager: SettingsManager;
    databaseManager: DatabaseManager;
    soundManager: SoundManager;
}
