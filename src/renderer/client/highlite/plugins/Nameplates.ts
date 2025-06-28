import { Vector3 } from "@babylonjs/core/Maths/math";
import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class"
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";

export class Nameplates extends Plugin {
    pluginName = "Nameplates";
    DOMElement: HTMLDivElement | null = null;
    constructor() {
        super();
        this.settings.playerNameplates = {
            text: "Player Nameplates",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => { } //NOOP

        };
        this.settings.npcNameplates = {
            text: "NPC Nameplates",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => { } //NOOP
        };

        this.settings.youNameplate = {
            text: "You Nameplate",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => { } //NOOP
        };
    }

    NampeplateContainer : HTMLDivElement | null = null;
    NPCDomElements : {
        [key : string] : { element: HTMLDivElement, position : Vector3 }
    } = {}
    PlayerDomElements : {
        [key : string] : { element: HTMLDivElement, position : Vector3  }
    } = {}


    init(): void {
        this.log("Initializing");
    }

    start(): void {
        this.log("Started");
    }

    stop(): void {
        this.log("Stopped");
    }

    SocketManager_loggedIn(...args : any) {
        this.DOMElement = document.createElement('div');
        this.DOMElement.id = "highlite-nameplates";
        this.DOMElement.style.position = "absolute";
        this.DOMElement.style.pointerEvents = "none";
        this.DOMElement.style.zIndex = "1";
        this.DOMElement.style.overflow = "hidden";
        this.DOMElement.style.width = "100%";
        this.DOMElement.style.height = "100%";
        this.DOMElement.style.fontFamily = "Inter";
        this.DOMElement.style.fontSize = "12px";
        this.DOMElement.style.fontWeight = "bold";
        document.getElementById('hs-screen-mask')?.appendChild(this.DOMElement);
    }

    SocketManager_handleLoggedOut(...args : any) {
        // Clear the NPC and Player DOM elements
        for (const key in this.NPCDomElements) {
            if (this.NPCDomElements[key]) {
                this.NPCDomElements[key].element.remove();
                delete this.NPCDomElements[key];
            }
        }
        for (const key in this.PlayerDomElements) {
            if (this.PlayerDomElements[key]) {
                this.PlayerDomElements[key].element.remove();
                delete this.PlayerDomElements[key];
            }
        }

        this.NPCDomElements = {};
        this.PlayerDomElements = {};
    }

    GameLoop_draw() {
        const NPCS = this.gameHooks.EntityManager.Instance._npcs; // Map
        const Players = this.gameHooks.EntityManager.Instance._players; // Array
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;
        const playerCombatLevel = MainPlayer._combatLevel;
        const BW = document.client.get("BW");


        // Clear non-existing NPCs
        if (NPCS.size == 0 || this.settings.enable.value == false || this.settings.npcNameplates!.value == false) {
            for (const key in this.NPCDomElements) {
                this.NPCDomElements[key]?.element.remove();
                delete this.NPCDomElements[key];
            }
        }
        for (const key in this.NPCDomElements) {
            if (!NPCS[key]) {
                this.NPCDomElements[key]?.element.remove();
                delete this.NPCDomElements[key];
            }
        }
        

        // Clear non-existing Players
        if (Players.length == 0 || this.settings.enable.value == false || this.settings.playerNameplates!.value == false) {
            for (const key in this.PlayerDomElements) {
                this.PlayerDomElements[key]?.element.remove();
                delete this.PlayerDomElements[key];
            }
        }

        for (const key in this.PlayerDomElements) {
            if (!Players[key] && key != MainPlayer._entityId || (key == MainPlayer._entityId && !this.settings.youNameplate!.value)) {
                this.PlayerDomElements[key]?.element.remove();
                delete this.PlayerDomElements[key];
            }
        }

        if (!this.settings.enable.value) {
            return;
        }

        // Loop through all NPCs
        if (this.settings.npcNameplates!.value) {
            for (const [key,value] of NPCS) {
                const npc = value;
                if (!this.NPCDomElements[key]) {
                    this.NPCDomElements[key] = {
                        element: document.createElement('div'),
                        position: Vector3.ZeroReadOnly
                    };
                    this.NPCDomElements[key]!.element.id = `highlite-nameplates-${key}`;
                    this.NPCDomElements[key]!.element.style.position = "absolute";
                    this.NPCDomElements[key]!.element.style.pointerEvents = "none";
                    this.NPCDomElements[key]!.element.style.zIndex = "1000";
                    this.NPCDomElements[key]!.element.style.display = "flex";
                    this.NPCDomElements[key]!.element.style.flexDirection = "column";
                    this.NPCDomElements[key]!.element.style.justifyContent = "center";
                    
                    // Create Name Holder
                    const nameSpan = document.createElement("div");
                    nameSpan.style.color = "yellow";
                    nameSpan.style.textAlign = "center";

                    nameSpan.innerText = npc._name;
                    this.NPCDomElements[key]!.element.append(nameSpan);

                    // Create Lvl Holder
                    if (npc._combatLevel != 0) {
                        const lvlSpan = document.createElement("div");
                        lvlSpan.style.textAlign = "center";
                        lvlSpan.innerText = `Lvl. ${npc._combatLevel}`
                        lvlSpan.className = BW.getTextColorClassNameForCombatLevelDifference(playerCombatLevel, npc._combatLevel)
                        
                        if (npc._def._combat._isAggressive && !npc._def._combat._isAlwaysAggro) {
                            lvlSpan.innerText += " 😠"
                        }

                        if (!npc._def._combat._isAggressive && !npc._def._combat._isAlwaysAggro) {
                            lvlSpan.innerText += " 😐"
                        }

                        if (npc._def._combat._isAlwaysAggro) {
                            lvlSpan.innerText += " 👿";
                        }
                        this.NPCDomElements[key]!.element.append(lvlSpan);
                    }

                    document.getElementById('highlite-nameplates')?.appendChild(this.NPCDomElements[key]!.element);
                }

                this.NPCDomElements[key]!.position = npc._currentGamePosition;

                const npcMesh = npc._appearance._haloNode;
                try {
                    this.updateElementPosition(npcMesh, this.NPCDomElements[key]);
                } catch (e) {
                    this.log("Error updating NPC element position: ", e);
                }
            }
        }

        if (this.settings.playerNameplates!.value) {
            for (const player of Players) {
                if (!this.PlayerDomElements[player._entityId]) {
                    this.PlayerDomElements[player._entityId] = {
                        element: document.createElement('div'),
                        position: Vector3.ZeroReadOnly
                    };
                    this.PlayerDomElements[player._entityId]!.element.id = `highlite-nameplates-${player._entityId}`;
                    this.PlayerDomElements[player._entityId]!.element.style.position = "absolute";
                    this.PlayerDomElements[player._entityId]!.element.style.pointerEvents = "none";
                    this.PlayerDomElements[player._entityId]!.element.style.zIndex = "1000";
                    this.PlayerDomElements[player._entityId]!.element.style.color = "white";
                    this.PlayerDomElements[player._entityId]!.element.innerHTML = player._name;
                    document.getElementById('highlite-nameplates')?.appendChild(this.PlayerDomElements[player._entityId]!.element);
                }

                // Check if Player is a friend
                const playerFriends = this.gameHooks.ChatManager.Instance._friends;
                for (const friend of playerFriends) {
                    if (friend == player._nameLowerCase) {
                        this.PlayerDomElements[player._entityId]!.element.style.color = "lightgreen";
                        break;
                    } else {
                        this.PlayerDomElements[player._entityId]!.element.style.color = "white";
                    }
                }

                const playerMesh = player._appearance._haloNode;
                try {
                    this.updateElementPosition(playerMesh, this.PlayerDomElements[player._entityId]);
                } catch (e) {
                    this.log("Error updating Player element position: ", e);
                }   
            }
        }

        if (this.settings.youNameplate!.value) {
            if (!this.PlayerDomElements[MainPlayer._entityId]) {
                this.PlayerDomElements[MainPlayer._entityId] = {
                    element: document.createElement('div'),
                    position: Vector3.ZeroReadOnly
                };
                this.PlayerDomElements[MainPlayer._entityId]!.element.id = `highlite-nameplates-${MainPlayer._entityId}`;
                this.PlayerDomElements[MainPlayer._entityId]!.element.style.position = "absolute";
                this.PlayerDomElements[MainPlayer._entityId]!.element.style.pointerEvents = "none";
                this.PlayerDomElements[MainPlayer._entityId]!.element.style.zIndex = "1000";
                this.PlayerDomElements[MainPlayer._entityId]!.element.style.color = "cyan";
                this.PlayerDomElements[MainPlayer._entityId]!.element.innerHTML = MainPlayer._name;
                document.getElementById('highlite-nameplates')?.appendChild(this.PlayerDomElements[MainPlayer._entityId]!.element);
            }

            const playerMesh = MainPlayer._appearance._haloNode;
            try {
                this.updateElementPosition(playerMesh, this.PlayerDomElements[MainPlayer._entityId]);
            } catch (e) {
                this.log("Error updating Player element position: ", e);
            }
        }
    }

                        // Halo  // DIV Element
    updateElementPosition(e: any, t : any) {
        const translationCoordinates = Vector3.Project(Vector3.ZeroReadOnly, 
            e.getWorldMatrix(), 
            this.gameHooks.GameEngine.Instance.Scene.getTransformMatrix(),
            this.gameHooks.GameCameraManager.Camera.viewport.toGlobal(this.gameHooks.GameEngine.Instance.Engine.getRenderWidth(1), this.gameHooks.GameEngine.Instance.Engine.getRenderHeight(1)),
        );
        const camera =  this.gameHooks.GameCameraManager.Camera;
        // camera._scene._frustrumPlanes
        const isInFrustrum = camera.isInFrustum(e);
        if (!isInFrustrum) {
            t.element.style.visibility = "hidden";
        } else {
            t.element.style.visibility = "visible";
        }

        // T is contains the position and is a member of either player or npc, if anything shares the same position, they should gain height based off where they fall in alphabetical order
        
        // Calculate the height based on the position in the array
        // Find all elements that share the same position
        // const elementsAtPosition = Object.values(this.NPCDomElements).concat(Object.values(this.PlayerDomElements)).filter(el => el.position.equals(t.position));
        // const index = elementsAtPosition.findIndex(el => el.element.id === t.element.id);
        // let heightOffset = index * 20; // 20px per element at the same position

        // // If element is the only one at the position, set heightOffset to 0
        // if (elementsAtPosition.length == 1) {
        //     heightOffset = 0;
        // }

        const heightOffset = 0; // TODO: Implement height offset based on position in array


        t.element.style.transform = "translate3d(calc(" + this.pxToRem(translationCoordinates.x) + "rem - 50%), calc(" + this.pxToRem(translationCoordinates.y - 30 - heightOffset) + "rem - 50%), 0px)"


    }
    pxToRem(px: number) {
        return px / 16;
    }

}
