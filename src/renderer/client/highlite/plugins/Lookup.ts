import { EntityType } from "../core/managers/game/contextMenuManager";
import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { ActionState } from "../core/interfaces/game/ActionStates.enum";
import { ContextMenuTypes } from "../core/interfaces/game/ContextMenuTypes.enum";

export class Lookup extends Plugin {
    pluginName = "Lookup";
    author = "Highlite";

    lookupContextActionInventory  = 0;
    lookupContextActionEntities  = 0;

    init(): void {
        this.log("Initializing");
    }

    handleInventoryLookup(actionInfo : any, clickInfo : any) : any {
        const item = actionInfo.getItem();
        window.open(`https://highspell.wiki/w/${(item.Def._nameCapitalized).replace(" ", "_")}`);
    }

    handlePlayerLookup(actionInfo : any, clickInfo : any) : any {
        const player = actionInfo.getEntity();
        const playerName = player._name;
        window.open(`https://highspell.com/hiscores/player/${playerName}`);
    }

    handleWorldObjectLookup(actionInfo : any, clickInfo : any) : any {
        const object = actionInfo.getEntity();
        const objectName = object._name;
        window.open(`https://highspell.wiki/w/${(objectName).replace(" ", "_")}`);
    }

    start(): void {
        document.highlite.managers.ContextMenuManager.AddInventoryItemMenuAction("Lookup", this.handleInventoryLookup, ActionState.Any, ContextMenuTypes.Any);
        document.highlite.managers.ContextMenuManager.AddGameWorldMenuAction("Lookup", this.handlePlayerLookup, EntityType.Player);
        document.highlite.managers.ContextMenuManager.AddGameWorldMenuAction("Lookup", this.handleWorldObjectLookup, EntityType.NPC);
        document.highlite.managers.ContextMenuManager.AddGameWorldMenuAction("Lookup", this.handleWorldObjectLookup, EntityType.WorldObject);
        document.highlite.managers.ContextMenuManager.AddGameWorldMenuAction("Lookup", this.handleWorldObjectLookup, EntityType.GroundItem);
    }

    stop(): void {
        document.highlite.managers.ContextMenuManager.RemoveInventoryItemMenuAction("Lookup", this.handleInventoryLookup, ActionState.Any, ContextMenuTypes.Any);
        document.highlite.managers.ContextMenuManager.RemoveGameWorldMenuAction("Lookup", this.handlePlayerLookup, EntityType.Player);
        document.highlite.managers.ContextMenuManager.RemoveGameWorldMenuAction("Lookup", this.handleWorldObjectLookup, EntityType.NPC);
        document.highlite.managers.ContextMenuManager.RemoveGameWorldMenuAction("Lookup", this.handleWorldObjectLookup, EntityType.WorldObject);
        document.highlite.managers.ContextMenuManager.RemoveGameWorldMenuAction("Lookup", this.handleWorldObjectLookup, EntityType.GroundItem);
    }
}
