import { ContextMenuManager } from './managers/game/contextMenuManager';
import { HookManager } from './managers/highlite/hookManager';
import { NotificationManager } from './managers/highlite/notificationManager';
import { PanelManager } from './managers/highlite/panelManager';
import { PluginManager } from './managers/highlite/pluginManger';
import { UIManager } from './managers/highlite/uiManager';
import { SettingsManager } from './managers/highlite/settingsManager';
import { DatabaseManager } from './managers/highlite/databaseManager';
import { SoundManager } from './managers/highlite/soundsManager';

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

        // Class Mappings
        this.hookManager.registerClass('Bk', 'EntityManager');
        this.hookManager.registerClass('YN', 'GroundItemManager');
        this.hookManager.registerClass('zF', 'MeshManager');
        this.hookManager.registerClass('If', 'WorldMapManager');
        this.hookManager.registerClass('zR', 'AtmosphereManager');
        this.hookManager.registerClass('aD', 'WorldEntityManager');
        this.hookManager.registerClass('CW', 'SpellManager');
        this.hookManager.registerClass('$k', 'SpellMeshManager');
        this.hookManager.registerClass('SW', 'GameLoop');
        this.hookManager.registerClass('jG', 'ChatManager');
        this.hookManager.registerClass('_G', 'RangeManager');
        this.hookManager.registerClass('$G', 'SocketManager');
        this.hookManager.registerClass('xW', 'GameEngine');
        this.hookManager.registerClass('KV', 'ItemManager');
        this.hookManager.registerClass('FW', 'LoginScreen');
        this.hookManager.registerClass('aH', 'PrivateChatMessageList');
        this.hookManager.registerClass('VF', 'InventoryManager');
        this.hookManager.registerClass('HR', 'HR'); // Potential name: UIManager?
        this.hookManager.registerClass('CH', 'InventoryItemSpriteManager');
        this.hookManager.registerClass('DP', 'ItemDefMap');
        this.hookManager.registerClass('Oz', 'BankUIManager');
        // this.hookManager.registerClass("LF", "MainPlayer");
        this.hookManager.registerClass('eR', 'GameCameraManager'); // Tip to find: contains call initializeCamera(e ,t)
        this.hookManager.registerClass('xk', 'SpriteSheetManager'); //Tip to find: contains getter PlayerSpritesheetInfo
        this.hookManager.registerClass('dB', 'NpcDefinitionManager');
        this.hookManager.registerClass('RV', 'SpellDefinitionManager');
        this.hookManager.registerClass('sk', 'AppearanceUtils');
        this.hookManager.registerClass('CR', 'BlobLoader');
        this.hookManager.registerClass('_q', 'HTMLUIManager'); // Tip to find: contains getGameContainer()
        this.hookManager.registerClass('nX', 'ScreenMask');

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
            'cz',
            '_createInventoryItemContextMenuItems',
            this.contextMenuManager.inventoryContextHook
        );
        this.contextMenuManager.registerContextHook(
            'cz',
            '_createGameWorldContextMenuItems',
            this.contextMenuManager.gameWorldContextHook
        );
        this.hookManager.registerStaticClassHook('GV', 'handleTargetAction');
        this.hookManager.registerStaticClassHook(
            'GV',
            'getActionsAndEntitiesAtMousePointer',
            this.contextMenuManager.ActionSorting
        );

        // Lookup Table Mappings
        document.highlite.gameLookups['GameWorldActions'] =
            document.client.get('VA');
        document.highlite.gameLookups['InventoryActions'] =
            document.client.get('QA');
        document.highlite.gameLookups['Skills'] = document.client.get('bA');
        document.highlite.gameLookups['EquipmentTypes'] =
            document.client.get('oP');
        document.highlite.gameLookups['EntityTypes'] =
            document.client.get('RF');
        document.highlite.gameLookups['AppearanceTypes'] =
            document.client.get('YP');
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
