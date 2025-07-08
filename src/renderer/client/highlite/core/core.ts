import { ContextMenuManager } from "./managers/game/contextMenuManager";
import { HookManager } from "./managers/highlite/hookManager";
import { NotificationManager } from "./managers/highlite/notificationManager";
import { PanelManager } from "./managers/highlite/panelManager";
import { PluginManager } from "./managers/highlite/pluginManger";
import { UIManager } from "./managers/highlite/uiManager";
import { SettingsManager } from "./managers/highlite/settingsManager";
import { DatabaseManager } from "./managers/highlite/databaseManager";
import { SoundManager } from "./managers/highlite/soundsManager";

export class Highlite {
    hookManager : HookManager;
    contextMenuManager : ContextMenuManager;
    notificationManager : NotificationManager;
    pluginManager : PluginManager;
    uiManager : UIManager;
    panelManager : PanelManager
    settingsManager : SettingsManager;
    databaseManager : DatabaseManager;
    soundManager : SoundManager;

    constructor() {
        console.info("[Highlite] Core Initializing!");

        document.highlite = {
            managers: {} as typeof document.highlite.managers,
            gameHooks: {} as typeof document.highlite.gameHooks,
            gameLookups: {},
            plugins: [],
        }

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
        this.hookManager.registerClass("Lk", "EntityManager");
        this.hookManager.registerClass("CN", "GroundItemManager");
        this.hookManager.registerClass("vF", "MeshManager");
        this.hookManager.registerClass("If", "WorldMapManager");
        this.hookManager.registerClass("zR", "AtmosphereManager");
        this.hookManager.registerClass("aD", "WorldEntityManager");
        this.hookManager.registerClass("dW", "SpellManager");
        this.hookManager.registerClass("Xk", "SpellMeshManager")
        this.hookManager.registerClass("pW", "GameLoop");
        this.hookManager.registerClass("jG", "ChatManager");
        this.hookManager.registerClass("uG", "RangeManager");
        this.hookManager.registerClass("FG", "SocketManager");
        this.hookManager.registerClass("gW", "GameEngine");
        this.hookManager.registerClass("qV", "ItemManager");
        this.hookManager.registerClass("MW", "LoginScreen");
        this.hookManager.registerClass("JW", "PrivateChatMessageList");
        this.hookManager.registerClass("kF", "InventoryManager");
        this.hookManager.registerClass('HR', 'HR'); // Potential name: UIManager?
        this.hookManager.registerClass('dH', 'InventoryItemSpriteManager');
        this.hookManager.registerClass('DP', 'ItemDefMap');
        // this.hookManager.registerClass("LF", "MainPlayer");
        this.hookManager.registerClass("eR", "GameCameraManager"); // Tip to find: contains call initializeCamera(e ,t)
        this.hookManager.registerClass("Ck", "SpriteSheetManager"); //Tip to find: contains getter PlayerSpritesheetInfo
        this.hookManager.registerClass("EB", "NpcDefinitionManager");
        this.hookManager.registerClass("IV", "SpellDefinitionManager");
        this.hookManager.registerClass("tk", "AppearanceUtils");
        this.hookManager.registerClass("SR", "BlobLoader");


        // Function Hook-ins
        this.hookManager.registerClassOverrideHook("LoginScreen", "_handleRegisterButtonClicked", this.loginHooks);
        this.hookManager.registerClassOverrideHook("LoginScreen", "_handleHomeButtonClicked", this.loginHooks);
        this.hookManager.registerClassHook("GameLoop", "_update");
        this.hookManager.registerClassHook("GameLoop", "_draw");
        this.hookManager.registerClassHook("PrivateChatMessageList", "addChatMessage");
        this.hookManager.registerClassHook("SocketManager", "_loggedIn");
        this.hookManager.registerClassHook("SocketManager", "_handleLoggedOut");
        this.hookManager.registerClassHook("SocketManager", "_handleEnteredIdleStateAction");
        this.hookManager.registerClassHook("SocketManager", "_handleTradeRequestedPacket");
        this.hookManager.registerClassHook("SocketManager", "_handleInvokedInventoryItemActionPacket");

        // Needs Naming
        this.contextMenuManager.registerContextHook("nz", "_createInventoryItemContextMenuItems", this.contextMenuManager.inventoryContextHook);
        this.contextMenuManager.registerContextHook("nz", "_createGameWorldContextMenuItems", this.contextMenuManager.gameWorldContextHook);
        this.hookManager.registerStaticClassHook('BV', 'handleTargetAction');
        this.hookManager.registerStaticClassHook('BV', 'getActionsAndEntitiesAtMousePointer', this.contextMenuManager.ActionSorting);

        // Lookup Table Mappings
        document.highlite.gameLookups["GameWorldActions"] = document.client.get("VA");
        document.highlite.gameLookups["InventoryActions"] = document.client.get("QA");
        document.highlite.gameLookups["Skills"] = document.client.get("bA");
        document.highlite.gameLookups["EquipmentTypes"] = document.client.get("oP");
        document.highlite.gameLookups["EntityTypes"] = document.client.get("PF");
        document.highlite.gameLookups["AppearanceTypes"] = document.client.get("YP");
    }

    async loginHooks(fnName: string, ...args: any[]) {
        if (fnName === "LoginScreen_handleRegisterButtonClicked") {
            window.open("https://highspell.com/register", "_blank");
        }
        if (fnName === "LoginScreen_handleHomeButtonClicked") {
            window.open("https://highspell.com/", "_blank");
        }
    }

    async start() {
        console.info("[Highlite] Core Started!");
        await this.databaseManager.initDB();
        if (!this.databaseManager.database) {
            console.error("[Highlite] Database not initialized!");
            return;
        } else {
            console.info("[Highlite] Database initialized!");
        }
        await this.notificationManager.askNotificationPermission();
        this.settingsManager.init();
        await this.settingsManager.registerPlugins();
        this.pluginManager.initAll();
        this.pluginManager.postInitAll();
        this.pluginManager.startAll();
    }

    stop() {
        console.info("[Highlite] Core Stopped!");
        this.pluginManager.stopAll();
    }

    reload() {
        console.info("[Highlite] Core Reloading");
        this.stop();
        this.start();
    }
}
