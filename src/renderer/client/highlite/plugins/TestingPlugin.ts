import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";
import {Vector3} from "@babylonjs/core/Maths/math";

export class TestingPlugin extends Plugin {
    pluginName = "Testing Plugin";
    author = "Tomb";

    constructor() {
        super();
        this.settings.enable = {
            text: "Print Debug Stuff",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => this.printDebugStuff()
        };
        this.settings.playerData = {
            text: "Show Player Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showPlayerData()
        };
        this.settings.inventoryData = {
            text: "Show Inventory Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showInventoryData()
        };
        this.settings.messagesData = {
            text: "Show Messages Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showMessagesData()
        };
        this.settings.messageInstanceData = {
            text: "Show Message Instance Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showMessageInstanceData()
        };
        this.settings.entityData = {
            text: "Show Entity Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showEntityData()
        };
        this.settings.entityInstanceData = {
            text: "Show Entity Instance Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showEntityInstanceData()
        };
        this.settings.worldEntityData = {
            text: "Show World Entity Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showWorldEntityData()
        };
        this.settings.worldEntityInstanceData = {
            text: "Show World Entity Instance Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showWorldEntityInstanceData()
        };
        this.settings.worldEntitiesData = {
            text: "Show World Entities Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showWorldEntitiesData()
        };
        this.settings.worldEntitiesValueData = {
            text: "Show World Entities Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showWorldEntitiesValueData()
        };
        this.settings.groundEntitiesData = {
            text: "Show Ground Entities Data",
            type: SettingsTypes.button,
            value: true,
            callback: () => this.showGroundEntitiesData()
        };
    }

    EntityDomElements: {
        [key: string]: { element: HTMLDivElement, position: Vector3, itemName: string, quantity: number, positionKey: string }
    } = {}

    init(): void {
        this.log("Initializing");
    }

    start(): void {
        this.log("Started Testing Plugin");
    }

    stop(): void {
        this.log("Stopped Testing Plugin");
    }

    SocketManager_loggedIn(): void {
        if (this.settings.enable.value) {
            //this.setupAllElements();
        }
    }

    SocketManager_handleLoggedOut(): void {
        //this.cleanupAllElements();
    }

    private showWorldEntitiesValueData(): void {
        this.log("Showing WorldEntities Data");
        const entities = this.gameHooks.WorldEntityManager.Instance.WorldEntities;
        for (const entity of entities) {
            this.log(entity[1]);
        }
    }

    private showGroundEntitiesData(): void {
        this.log("Showing Ground Entities Data");
        this.log(this.gameHooks.GroundItemManager.Instance.GroundItems);
    }

    private showWorldEntitiesData(): void {
        this.log("Showing WorldEntities Data");
        this.log(this.gameHooks.WorldEntityManager.Instance.WorldEntities);
    }


    private showWorldEntityData(): void {
        this.log("Showing WorldEntityManager Data");
        this.log(this.gameHooks.WorldEntityManager);
    }

    private showWorldEntityInstanceData(): void {
        this.log("Showing WorldEntityManager Instance Data");
        this.log(this.gameHooks.WorldEntityManager.Instance);
    }

    private showEntityData(): void {
        this.log("Showing EntityManager Data");
        this.log(this.gameHooks.EntityManager);
    }

    private showEntityInstanceData(): void {
        this.log("Showing EntityManager Instance Data");
        this.log(this.gameHooks.EntityManager.Instance);
    }

    private showMessagesData(): void {
        this.log("Showing ChatManager Data");
        this.log(this.gameHooks.ChatManager);
    }

    private showMessageInstanceData(): void {
        this.log("Showing ChatManager Instance Data");
        this.log(this.gameHooks.ChatManager.Instance);
    }

    private showInventoryData(): void {
        this.log("Showing Inventory Data");
        this.log(this.gameHooks.EntityManager.Instance.MainPlayer.Inventory);
    }

    private showPlayerData() {
        this.log("Showing Player Data");
        this.log(this.gameHooks.EntityManager.Instance.MainPlayer);
    }

    private printDebugStuff(): void {
        this.log("Print Debug Stuff");
    }


}