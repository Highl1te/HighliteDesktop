import { ContextMenuManager } from './managers/game/contextMenuManager';
import { HookManager } from './managers/highlite/hookManager';
import { NotificationManager } from './managers/highlite/notificationManager';
import { PanelManager } from './managers/highlite/panelManager';
import { PluginManager } from './managers/highlite/pluginManger';
import { UIManager } from './managers/highlite/uiManager';
import { SettingsManager } from './managers/highlite/settingsManager';
import { DatabaseManager } from './managers/highlite/databaseManager';
import { SoundManager } from './managers/highlite/soundsManager';
import { Reflector } from '../../reflector/reflector';

export class Highlite {
    hookManager: HookManager;
    contextMenuManager: ContextMenuManager;
    notificationManager: NotificationManager;
    pluginManager: PluginManager;
    uiManager: UIManager;
    panelManager: PanelManager;
    settingsManager: SettingsManager;
    databaseManager: DatabaseManager;
    soundManager: SoundManager;

    constructor() {
        console.info('[Highlite] Core Initializing!');

        document.highlite = {
            managers: {},
            gameHooks: {},
            gameLookups: {},
            plugins: [],
        };

        this.hookManager = new HookManager();
        this.contextMenuManager = new ContextMenuManager();
        this.notificationManager = new NotificationManager();
        this.pluginManager = new PluginManager();
        this.uiManager = new UIManager();
        this.panelManager = new PanelManager();
        this.soundManager = new SoundManager();
        this.settingsManager = new SettingsManager();
        this.databaseManager = new DatabaseManager();

        // Bind the classes from the hook manager (registerClass)
        // Read all the found signature binding 
        Reflector.bindClassHooks(this.hookManager);

        // Bind the enums to the hook manager (registerEnum)
        // These are the lookup tables
        Reflector.bindEnumHooks(this.hookManager);

        // Function Hook-ins
        this.hookManager.registerClassOverrideHook(
            'LoginScreen',
            '_handleRegisterButtonClicked',
            this.loginHooks
        );
        this.hookManager.registerClassOverrideHook(
            'LoginScreen',
            '_handleHomeButtonClicked',
            this.loginHooks
        );
        this.hookManager.registerClassHook('GameLoop', '_update');
        this.hookManager.registerClassHook('GameLoop', '_draw');
        this.hookManager.registerClassHook(
            'PrivateChatMessageList',
            'addChatMessage'
        );
        this.hookManager.registerClassHook('SocketManager', '_loggedIn');
        this.hookManager.registerClassHook('SocketManager', '_handleLoggedOut');
        this.hookManager.registerClassHook(
            'SocketManager',
            '_handleEnteredIdleStateAction'
        );
        this.hookManager.registerClassHook(
            'SocketManager',
            '_handleTradeRequestedPacket'
        );
        this.hookManager.registerClassHook(
            'SocketManager',
            '_handleInvokedInventoryItemActionPacket'
        );
        this.hookManager.registerClassHook('ScreenMask', 'initializeControls'); // When this fires, game UI is ready
        this.hookManager.registerClassHook('BankUIManager', 'showBankMenu');
        this.hookManager.registerClassHook(
            'BankUIManager',
            '_handleCenterMenuWillBeRemoved'
        );

        // Needs Naming
        this.contextMenuManager.registerContextHook(
            'ContextMenuManager',
            '_createInventoryItemContextMenuItems',
            this.contextMenuManager.inventoryContextHook
        );
        this.contextMenuManager.registerContextHook(
            'ContextMenuManager',
            '_createGameWorldContextMenuItems',
            this.contextMenuManager.gameWorldContextHook
        );
        this.hookManager.registerStaticClassHook('TargetActionManager', 'handleTargetAction');
        this.hookManager.registerStaticClassHook(
            'TargetActionManager',
            'getActionsAndEntitiesAtMousePointer',
            this.contextMenuManager.ActionSorting
        );
    }

    async loginHooks(fnName: string, ...args: any[]) {
        if (fnName === 'LoginScreen_handleRegisterButtonClicked') {
            window.open('https://highspell.com/register', '_blank');
        }
        if (fnName === 'LoginScreen_handleHomeButtonClicked') {
            window.open('https://highspell.com/', '_blank');
        }
    }

    async start() {
        console.info('[Highlite] Core Started!');
        await this.databaseManager.initDB();
        if (!this.databaseManager.database) {
            console.error('[Highlite] Database not initialized!');
            return;
        } else {
            console.info('[Highlite] Database initialized!');
        }
        await this.notificationManager.askNotificationPermission();
        this.settingsManager.init();
        await this.settingsManager.registerPlugins();
        this.pluginManager.initAll();
        this.pluginManager.postInitAll();
        this.pluginManager.startAll();
    }

    stop() {
        console.info('[Highlite] Core Stopped!');
        this.pluginManager.stopAll();
    }

    reload() {
        console.info('[Highlite] Core Reloading');
        this.stop();
        this.start();
    }
}
