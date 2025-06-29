import { Vector3 } from "@babylonjs/core/Maths/math";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PlaneBuilder } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class"
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";

export class Nameplates extends Plugin {
    pluginName = "Nameplates";
    author = "Highlite";
    constructor() {
        super();

        this.settings.playerNameplates = {
            text: "Player Nameplates",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {} // NO OP
        }
        this.settings.npcNameplates = {
            text: "NPC Nameplates",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {} // NO OP
        };
        this.settings.youNameplate = {
            text: "You Nameplate",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {} // NO OP
        };
        this.settings.groundItemNameplates = {
            text: "Ground Item Nameplates",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {} // NO OP
        };
        

        // Text size settings for each nameplate type
        this.settings.playerNameplateSize = {
            text: "Player Nameplate Text Size",
            type: SettingsTypes.range,
            value: 20,
            callback: () => this.regeneratePlayerNameplates()
        }
        this.settings.npcNameplateSize = {
            text: "NPC Nameplate Text Size",
            type: SettingsTypes.range,
            value: 20,
            callback: () => this.regenerateNPCNameplates()
        };
        this.settings.youNameplateSize = {
            text: "You Nameplate Text Size",
            type: SettingsTypes.range,
            value: 20,
            callback: () => this.regenerateMainPlayerNameplate()
        };
        this.settings.groundItemNameplateSize = {
            text: "Ground Item Nameplate Text Size",
            type: SettingsTypes.range,
            value: 20,
            callback: () => this.regenerateGroundItemNameplates()
        };
    }

    NPCTextMeshes: {
        [key: number]: { mesh: Mesh }
    } = {}
    PlayerTextMeshes: {
        [key: number]: { mesh: Mesh, isFriend: boolean }
    } = {}
    GroundItemTextMeshes: {
        [key: string]: { mesh: Mesh, itemName: string, quantity: number, position: string }
    } = {}

    // Track nameplate positions for stacking
    private positionTracker: Map<string, number> = new Map();

    /**
     * Calculate the level color based on combat level difference
     */
    private calculateLevelColor(playerLevel: number, npcLevel: number): string {
        const levelDifference = playerLevel - npcLevel;
        
        if (levelDifference >= 10) return "rgb(0, 255, 0)";
        if (levelDifference === 9) return "rgb(25, 255, 0)";
        if (levelDifference === 8) return "rgb(50, 255, 0)";
        if (levelDifference === 7) return "rgb(76, 255, 0)";
        if (levelDifference === 6) return "rgb(101, 255, 0)";
        if (levelDifference === 5) return "rgb(127, 255, 0)";
        if (levelDifference === 4) return "rgb(152, 255, 0)";
        if (levelDifference === 3) return "rgb(178, 255, 0)";
        if (levelDifference === 2) return "rgb(204, 255, 0)";
        if (levelDifference === 1) return "rgb(229, 255, 0)";
        if (levelDifference === 0) return "rgb(255, 255, 0)";
        if (levelDifference === -1) return "rgb(255, 229, 0)";
        if (levelDifference === -2) return "rgb(255, 204, 0)";
        if (levelDifference === -3) return "rgb(255, 178, 0)";
        if (levelDifference === -4) return "rgb(255, 152, 0)";
        if (levelDifference === -5) return "rgb(255, 127, 0)";
        if (levelDifference === -6) return "rgb(255, 101, 0)";
        if (levelDifference === -7) return "rgb(255, 76, 0)";
        if (levelDifference === -8) return "rgb(255, 50, 0)";
        if (levelDifference === -9) return "rgb(255, 25, 0)";
        if (levelDifference <= -10) return "rgb(255, 0, 0)";
        
        return "rgb(255, 255, 255)"; // Default white
    }

    init(): void {
        this.log("Initializing");
    }

    start(): void {
        this.log("Started");
    }

    stop(): void {
        this.log("Stopped");
        // Clean up all meshes when plugin is stopped
        this.cleanupAllMeshes();
    }

    SocketManager_handleLoggedOut() {
        // Clean up all text meshes using the helper method
        this.cleanupMeshCollection(this.NPCTextMeshes);
        this.cleanupMeshCollection(this.PlayerTextMeshes);
        this.cleanupMeshCollection(this.GroundItemTextMeshes);

        this.NPCTextMeshes = {};
        this.PlayerTextMeshes = {};
        this.GroundItemTextMeshes = {};
    }

    GameLoop_draw() {
        const NPCS: Map<number, any> = this.gameHooks.EntityManager.Instance._npcs; // Map
        const Players = this.gameHooks.EntityManager.Instance._players; // Array
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;
        const GroundItems = this.gameHooks.GroundItemManager.Instance.GroundItems; // Map
        const playerFriends = this.gameHooks.ChatManager.Instance._friends;

        if (!this.settings.enable.value) {
            // If plugin is disabled, clean up all existing meshes to prevent memory leaks
            this.cleanupAllMeshes();
            return;
        }

        // Reset position tracker for this frame
        this.resetPositionTracker();

        // Create text meshes for any NPC that does not have one yet
        if (!NPCS || !Players || !MainPlayer || !GroundItems) {
            this.log("Missing required game entities, skipping nameplate rendering.");
            return;
        }

        // Clear old meshes that are no longer needed
        for (const key in this.NPCTextMeshes) {
            if (!NPCS.has(parseInt(key))) {
                this.NPCTextMeshes[key].mesh.dispose(false, true);
                delete this.NPCTextMeshes[key];
            }
        }

        for (const key in this.PlayerTextMeshes) {
            const exists = Players.some((player) => player._entityId === parseInt(key)) || (MainPlayer && MainPlayer._entityId === parseInt(key));
            if (!exists) {
                this.PlayerTextMeshes[key].mesh.dispose(false, true);
                delete this.PlayerTextMeshes[key];
            }
        }

        for (const key in this.GroundItemTextMeshes) {
            if (!GroundItems.has(parseInt(key))) {
                this.GroundItemTextMeshes[key].mesh.dispose(false, true);
                delete this.GroundItemTextMeshes[key];
            }
        }


        // Loop through all NPCs
        if (this.settings.npcNameplates!.value) {
            for (const [key, value] of NPCS) {
                const npc = value;
                if (!this.NPCTextMeshes[key]) {
                    // Create nameplate for NPC
                    const textMesh = this.createNPCNameplate(npc, MainPlayer._combatLevel);
                    textMesh.parent = npc._appearance._haloNode; // Parent to halo node
                    this.NPCTextMeshes[key] = {
                        mesh: textMesh
                    };
                }

                // Update position every frame for proper stacking (similar to players)
                if (this.NPCTextMeshes[key]) {
                    this.NPCTextMeshes[key].mesh.position = this.calculateStackedPosition(npc, 'npc');
                }
            }
        } else {
            // NPC nameplates are disabled, clean up any existing NPC meshes
            this.cleanupMeshCollection(this.NPCTextMeshes);
        }
        
        // Process regular players first
        if (this.settings.playerNameplates!.value) {
            for (const player of Players) {
                const isFriend = playerFriends.includes(player._nameLowerCase);
                const currentColor = isFriend ? "lightgreen" : "white";

                if (!this.PlayerTextMeshes[player._entityId]) {
                    // Build nameplate text (just the name for players)
                    const textMesh = this.createNameplateMesh({
                        text: player._name,
                        color: currentColor,
                        fontSize: 20,
                        nameplateType: 'player'
                    });
                    textMesh.parent = player._appearance._haloNode; // Parent to halo node
                    this.PlayerTextMeshes[player._entityId] = {
                        mesh: textMesh,
                        isFriend: isFriend
                    };
                } else if (this.PlayerTextMeshes[player._entityId].isFriend != isFriend) {
                    // Player text mesh already exists
                    const existingMesh = this.PlayerTextMeshes[player._entityId];
                    if (existingMesh.mesh) {
                        // Friend status changed, recreate the mesh with new color
                        existingMesh.mesh.dispose(false, true);
                        const textMesh = this.createNameplateMesh({
                            text: player._name,
                            color: currentColor,
                            fontSize: 20,
                            nameplateType: 'player'
                        });
                        textMesh.parent = player._appearance._haloNode; // Parent to halo node
                        this.PlayerTextMeshes[player._entityId] = {
                            mesh: textMesh,
                            isFriend: isFriend
                        };
                    }
                }
                
                // Update position every frame for proper stacking
                this.PlayerTextMeshes[player._entityId].mesh.position = this.calculateStackedPosition(player, 'player', false);
            }
        } else {
            // Player nameplates are disabled, clean up any existing player meshes (except MainPlayer)
            for (const key in this.PlayerTextMeshes) {
                const entityId = parseInt(key);
                if (MainPlayer && entityId !== MainPlayer._entityId) {
                    this.PlayerTextMeshes[key].mesh.dispose(false, true);
                    delete this.PlayerTextMeshes[key];
                }
            }
        }

        // Handle MainPlayer nameplate last so it gets the top position
        if (this.settings.youNameplate!.value && MainPlayer) {
            const mainPlayerEntityId = MainPlayer._entityId;
            
            if (!this.PlayerTextMeshes[mainPlayerEntityId]) {
                // Create nameplate for MainPlayer
                const textMesh = this.createNameplateMesh({
                    text: MainPlayer._name,
                    color: "cyan",
                    fontSize: 20,
                    nameplateType: 'mainPlayer'
                }); // Use cyan to distinguish from other players
                textMesh.parent = MainPlayer._appearance._haloNode; // Parent to halo node
                this.PlayerTextMeshes[mainPlayerEntityId] = {
                    mesh: textMesh,
                    isFriend: false // MainPlayer is not considered a friend for color purposes
                };
            }

            this.PlayerTextMeshes[mainPlayerEntityId].mesh.position = this.calculateStackedPosition(MainPlayer, 'player', true);
        } else if (!this.settings.youNameplate!.value && MainPlayer) {
            // Remove MainPlayer nameplate if setting is disabled
            const mainPlayerEntityId = MainPlayer._entityId;
            if (this.PlayerTextMeshes[mainPlayerEntityId]) {
                this.PlayerTextMeshes[mainPlayerEntityId].mesh.dispose(false, true);
                delete this.PlayerTextMeshes[mainPlayerEntityId];
            }
        }

        // Handle Ground Items
        if (this.settings.groundItemNameplates!.value) {
            // First, group items by position only (not by name)
            const positionGroups: Map<string, { items: Map<string, { items: any[], count: number }>, firstKey: string, totalItems: number }> = new Map();
            
            for (const [key, groundItem] of GroundItems) {
                const itemName = groundItem._def._nameCapitalized;
                const worldPos = groundItem._appearance._billboardMesh.getAbsolutePosition();
                const roundedX = Math.round(worldPos.x * 2) / 2;
                const roundedZ = Math.round(worldPos.z * 2) / 2;
                const positionKey = `${roundedX}_${roundedZ}`;
                
                if (!positionGroups.has(positionKey)) {
                    positionGroups.set(positionKey, { 
                        items: new Map(), 
                        firstKey: String(key), 
                        totalItems: 0 
                    });
                }
                
                const positionGroup = positionGroups.get(positionKey)!;
                
                if (!positionGroup.items.has(itemName)) {
                    positionGroup.items.set(itemName, { items: [], count: 0 });
                }
                
                const itemGroup = positionGroup.items.get(itemName)!;
                itemGroup.items.push({ key: String(key), item: groundItem });
                itemGroup.count++;
                positionGroup.totalItems++;
            }
            
            // Clean up old meshes that are no longer needed
            const activePositionKeys = new Set();
            for (const [positionKey] of positionGroups) {
                activePositionKeys.add(positionKey);
            }
            
            for (const key in this.GroundItemTextMeshes) {
                const existingMesh = this.GroundItemTextMeshes[key];
                if (!activePositionKeys.has(existingMesh.position)) {
                    existingMesh.mesh.dispose(false, true);
                    delete this.GroundItemTextMeshes[key];
                }
            }
            
            // Create or update nameplates for each position group
            for (const [positionKey, positionGroup] of positionGroups) {
                const representativeKey = positionGroup.firstKey;
                
                // Create multi-line text with all items at this position
                const lines: Array<{ text: string, color: string }> = [];
                
                // Sort items by name for consistent display
                const sortedItems = Array.from(positionGroup.items.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                
                for (const [itemName, itemGroup] of sortedItems) {
                    const displayText = itemGroup.count > 1 ? `${itemName} [x${itemGroup.count}]` : itemName;
                    lines.push({ text: displayText, color: "orange" });
                }
                
                if (!this.GroundItemTextMeshes[representativeKey]) {
                    // Create new multi-line nameplate
                    const firstItem = Array.from(positionGroup.items.values())[0].items[0];
                    const textMesh = this.createMultiLineGroundItemNameplate(lines);
                    textMesh.parent = firstItem.item._appearance._billboardMesh;
                    
                    this.GroundItemTextMeshes[representativeKey] = {
                        mesh: textMesh,
                        itemName: `${positionGroup.items.size} types`, // Store summary info
                        quantity: positionGroup.totalItems,
                        position: positionKey
                    };
                } else {
                    // Update existing nameplate if contents changed
                    const existingMesh = this.GroundItemTextMeshes[representativeKey];
                    if (existingMesh.quantity !== positionGroup.totalItems) {
                        // Dispose old mesh and create new one with updated text
                        existingMesh.mesh.dispose(false, true);
                        
                        const firstItem = Array.from(positionGroup.items.values())[0].items[0];
                        const textMesh = this.createMultiLineGroundItemNameplate(lines);
                        textMesh.parent = firstItem.item._appearance._billboardMesh;
                        
                        existingMesh.mesh = textMesh;
                        existingMesh.quantity = positionGroup.totalItems;
                        existingMesh.itemName = `${positionGroup.items.size} types`;
                    }
                }
                
                // Update position every frame for proper stacking
                this.GroundItemTextMeshes[representativeKey].mesh.position = this.calculateStackedPosition(
                    Array.from(positionGroup.items.values())[0].items[0].item, 
                    'grounditem'
                );
            }
        } else {
            // Ground item nameplates are disabled, clean up any existing ground item meshes
            this.cleanupMeshCollection(this.GroundItemTextMeshes);
        }
    }


    /**
     * Create a nameplate mesh with text - unified method for all nameplate types
     */
    createNameplateMesh(options: {
        text?: string;
        nameText?: string;
        levelText?: string;
        color?: string;
        nameColor?: string;
        levelColor?: string;
        fontSize?: number;
        nameplateType: 'player' | 'npc' | 'mainPlayer' | 'groundItem';
        isAggressive?: boolean;
        isAlwaysAggro?: boolean;
    }): Mesh {
        const scene = this.gameHooks.GameEngine.Instance.Scene;
        const actualFontSize = this.getFontSize(options.nameplateType, options.fontSize || 24);
        
        // Determine if this is a multi-color (NPC) nameplate
        const isMultiColor = options.nameText && options.levelText;
        
        let texture: DynamicTexture;
        let width: number;
        let height: number;
        let scaleFactor: number;
        
        if (isMultiColor) {
            // Create multi-color texture for NPCs
            const result = this.createDynamicTexture({
                lines: [
                    { text: options.nameText!, color: options.nameColor || "yellow" },
                    { text: options.levelText! + this.getAggressionEmoji(options.isAggressive, options.isAlwaysAggro), color: options.levelColor || "white" }
                ],
                fontSize: actualFontSize,
                scene
            });
            texture = result.texture;
            width = result.width;
            height = result.height;
            scaleFactor = result.scaleFactor;
        } else {
            // Create single-color texture for players and ground items
            const result = this.createDynamicTexture({
                lines: [{ text: options.text!, color: options.color || "white" }],
                fontSize: actualFontSize,
                scene
            });
            texture = result.texture;
            width = result.width;
            height = result.height;
            scaleFactor = result.scaleFactor;
        }
        
        // Create material and plane
        const material = this.createTextMaterial(texture, scene);
        const plane = this.createTextPlane(material, width, height, scaleFactor, scene);

        return plane;
    }

    /**
     * Legacy method for backward compatibility - delegates to unified method
     */
    createTextMesh(text: string, color: string = "white", fontSize: number = 24, nameplateType: 'player' | 'npc' | 'mainPlayer' | 'groundItem' = 'player'): Mesh {
        return this.createNameplateMesh({
            text,
            color,
            fontSize,
            nameplateType
        });
    }

    /**
     * Create nameplate for NPC with appropriate styling
     */
    private createNPCNameplate(npc: any, mainPlayerLevel: number): Mesh {
        if (npc._combatLevel != 0) {
            // Calculate level color using the helper method
            const levelColor = this.calculateLevelColor(mainPlayerLevel, npc._combatLevel);
            
            return this.createNameplateMesh({
                nameText: npc._name,
                levelText: `Lvl. ${npc._combatLevel}`,
                nameColor: "yellow",
                levelColor: levelColor,
                fontSize: 20,
                nameplateType: 'npc',
                isAggressive: npc._def._combat._isAggressive,
                isAlwaysAggro: npc._def._combat._isAlwaysAggro
            });
        } else {
            // NPC with no combat level, just show name
            return this.createNameplateMesh({
                text: npc._name,
                color: "yellow",
                fontSize: 20,
                nameplateType: 'npc'
            });
        }
    }

    /**
     * Calculate the Y offset for nameplates based on existing nameplates at the same position
     */
    private calculateStackedPosition(
        entity: any, 
        entityType: 'player' | 'npc' | 'grounditem', 
        isMainPlayer: boolean = false
    ): Vector3 {
        // Determine the position source and validation based on entity type
        let worldPos: Vector3;
        let positionSource: any;
        
        if (entityType === 'grounditem') {
            if (!entity || !entity._appearance || !entity._appearance._billboardMesh) {
                return new Vector3(0, 0.25, 0); // Default position
            }
            positionSource = entity._appearance._billboardMesh;
        } else {
            // For players and NPCs
            if (!entity || !entity._appearance || !entity._appearance._haloNode) {
                return new Vector3(0, 0.25, 0); // Default position
            }
            positionSource = entity._appearance._haloNode;
        }
        
        // Get world position from the appropriate source
        worldPos = positionSource.getAbsolutePosition();
        
        // Create a position key based on rounded world coordinates (to group nearby entities)
        const roundedX = Math.round(worldPos.x * 2) / 2; // Round to nearest 0.5
        const roundedZ = Math.round(worldPos.z * 2) / 2; // Round to nearest 0.5
        const positionKey = `${entityType}_${roundedX}_${roundedZ}`;
        
        // Calculate stack index based on entity type and main player status
        let stackIndex = 0;
        
        if (entityType === 'player' && isMainPlayer) {
            // MainPlayer always gets the top position (highest Y)
            const totalPlayersAtPosition = this.positionTracker.get(positionKey) || 0;
            this.positionTracker.set(positionKey, totalPlayersAtPosition + 1);
            stackIndex = totalPlayersAtPosition; // MainPlayer gets the highest index
        } else {
            // Standard stacking for NPCs, regular players, and ground items
            const currentStack = this.positionTracker.get(positionKey) || 0;
            this.positionTracker.set(positionKey, currentStack + 1);
            stackIndex = currentStack;
        }
        
        // Configure height and spacing based on entity type
        let baseHeight: number;
        let stackSpacing: number;
        
        switch (entityType) {
            case 'grounditem':
                baseHeight = 0.5; // Start higher than NPCs/players to avoid overlap
                stackSpacing = 0.3; // Smaller spacing for ground items
                break;
            case 'player':
                baseHeight = 0.25;
                stackSpacing = 0.4; // Spacing between player nameplates
                break;
            case 'npc':
                baseHeight = 0.25;
                stackSpacing = 0.4; // Spacing between NPC nameplates
                break;
            default:
                baseHeight = 0.25;
                stackSpacing = 0.4;
        }
        
        // Calculate Y offset (stack upwards)
        const yOffset = baseHeight + (stackIndex * stackSpacing);
        
        return new Vector3(0, yOffset, 0);
    }

    /**
     * Clear position tracker - called before each frame to reset stacking
     */
    private resetPositionTracker(): void {
        this.positionTracker.clear();
    }

    /**
     * Clean up all meshes to prevent memory leaks
     */
    private cleanupAllMeshes(): void {
        // Clean up all mesh collections using the helper method
        this.cleanupMeshCollection(this.NPCTextMeshes);
        this.cleanupMeshCollection(this.PlayerTextMeshes);
        this.cleanupMeshCollection(this.GroundItemTextMeshes);

        // Reset all collections
        this.NPCTextMeshes = {};
        this.PlayerTextMeshes = {};
        this.GroundItemTextMeshes = {};
    }

    /**
     * Regenerate all player nameplates when size setting changes
     */
    private regeneratePlayerNameplates(): void {
        const Players = this.gameHooks.EntityManager.Instance._players;
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;
        const playerFriends = this.gameHooks.ChatManager.Instance._friends;

        if (!Players || !MainPlayer) return;

        // Regenerate regular player nameplates
        for (const player of Players) {
            if (player._entityId !== MainPlayer._entityId && this.PlayerTextMeshes[player._entityId]) {
                const existingMesh = this.PlayerTextMeshes[player._entityId];
                const isFriend = playerFriends.includes(player._nameLowerCase);
                const currentColor = isFriend ? "lightgreen" : "white";

                // Dispose old mesh and create new one with updated size
                existingMesh.mesh.dispose(false, true);
                const textMesh = this.createNameplateMesh({
                    text: player._name,
                    color: currentColor,
                    fontSize: 20,
                    nameplateType: 'player'
                });
                textMesh.parent = player._appearance._haloNode;
                
                this.PlayerTextMeshes[player._entityId] = {
                    mesh: textMesh,
                    isFriend: isFriend
                };
            }
        }
    }

    /**
     * Regenerate all NPC nameplates when size setting changes
     */
    private regenerateNPCNameplates(): void {
        const NPCS: Map<number, any> = this.gameHooks.EntityManager.Instance._npcs;
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;

        if (!NPCS || !MainPlayer) return;

        // Regenerate all NPC nameplates
        for (const [key, npc] of NPCS) {
            if (this.NPCTextMeshes[key]) {
                // Dispose old mesh
                this.NPCTextMeshes[key].mesh.dispose(false, true);

                // Create new mesh with updated size
                const textMesh = this.createNPCNameplate(npc, MainPlayer._combatLevel);
                textMesh.parent = npc._appearance._haloNode;
                textMesh.position = new Vector3(0, 0.25, 0);
                this.NPCTextMeshes[key] = {
                    mesh: textMesh
                };
            }
        }
    }

    /**
     * Regenerate main player nameplate when size setting changes
     */
    private regenerateMainPlayerNameplate(): void {
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;

        if (!MainPlayer) return;

        const mainPlayerEntityId = MainPlayer._entityId;
        if (this.PlayerTextMeshes[mainPlayerEntityId]) {
            // Dispose old mesh
            this.PlayerTextMeshes[mainPlayerEntityId].mesh.dispose(false, true);

            // Create new mesh with updated size
            const textMesh = this.createNameplateMesh({
                text: MainPlayer._name,
                color: "cyan",
                fontSize: 20,
                nameplateType: 'mainPlayer'
            });
            textMesh.parent = MainPlayer._appearance._haloNode;
            
            this.PlayerTextMeshes[mainPlayerEntityId] = {
                mesh: textMesh,
                isFriend: false
            };
        }
    }

    /**
     * Regenerate all ground item nameplates when size setting changes
     */
    private regenerateGroundItemNameplates(): void {
        const GroundItems = this.gameHooks.GroundItemManager.Instance.GroundItems;

        if (!GroundItems) return;

        // Store the current ground item data before regenerating
        const currentGroundItems: { [key: string]: { itemName: string, quantity: number, position: string, parent: any, lines?: Array<{ text: string, color: string }> } } = {};
        
        for (const key in this.GroundItemTextMeshes) {
            const existingMesh = this.GroundItemTextMeshes[key];
            
            // Try to reconstruct the lines from current ground items at this position
            const lines: Array<{ text: string, color: string }> = [];
            const positionKey = existingMesh.position;
            
            // Find all ground items at this position to reconstruct the multi-line text
            for (const [, groundItem] of GroundItems) {
                const worldPos = groundItem._appearance._billboardMesh.getAbsolutePosition();
                const roundedX = Math.round(worldPos.x * 2) / 2;
                const roundedZ = Math.round(worldPos.z * 2) / 2;
                const itemPositionKey = `${roundedX}_${roundedZ}`;
                
                if (itemPositionKey === positionKey) {
                    const itemName = groundItem._def._nameCapitalized;
                    // Check if this item name already exists in lines
                    const existingLine = lines.find(line => line.text.includes(itemName));
                    if (!existingLine) {
                        lines.push({ text: itemName, color: "orange" });
                    }
                }
            }
            
            currentGroundItems[key] = {
                itemName: existingMesh.itemName,
                quantity: existingMesh.quantity,
                position: existingMesh.position,
                parent: existingMesh.mesh.parent,
                lines: lines
            };
            // Dispose old mesh
            existingMesh.mesh.dispose(false, true);
        }

        // Clear the collection
        this.GroundItemTextMeshes = {};

        // Recreate nameplates with new size
        for (const key in currentGroundItems) {
            const data = currentGroundItems[key];
            
            if (data.lines && data.lines.length > 0) {
                const textMesh = this.createMultiLineGroundItemNameplate(data.lines);
                textMesh.parent = data.parent;
                
                this.GroundItemTextMeshes[key] = {
                    mesh: textMesh,
                    itemName: data.itemName,
                    quantity: data.quantity,
                    position: data.position
                };
            }
        }
    }

    /**
     * Dispose and clean up a mesh collection
     */
    private cleanupMeshCollection<T extends { mesh: Mesh }>(collection: { [key: string]: T } | { [key: number]: T }): void {
        for (const key in collection) {
            if (collection[key]) {
                collection[key].mesh.dispose(false, true);
                delete collection[key];
            }
        }
    }

    /**
     * Get the appropriate font size for a nameplate type
     */
    private getFontSize(nameplateType: 'player' | 'npc' | 'mainPlayer' | 'groundItem', defaultSize: number = 20): number {
        const sizeMap = {
            'player': this.settings.playerNameplateSize?.value as number,
            'npc': this.settings.npcNameplateSize?.value as number,
            'mainPlayer': this.settings.youNameplateSize?.value as number,
            'groundItem': this.settings.groundItemNameplateSize?.value as number
        };
        
        return sizeMap[nameplateType] || defaultSize;
    }

    /**
     * Get aggression emoji based on NPC state
     */
    private getAggressionEmoji(isAggressive?: boolean, isAlwaysAggro?: boolean): string {
        if (isAggressive === undefined || isAlwaysAggro === undefined) return "";
        
        if (isAggressive && !isAlwaysAggro) {
            return " 😠";
        } else if (!isAggressive && !isAlwaysAggro) {
            return " 😐";
        } else if (isAlwaysAggro) {
            return " 👿";
        }
        return "";
    }

    /**
     * Unified dynamic texture creation method
     */
    private createDynamicTexture(options: {
        lines: Array<{ text: string, color: string }>;
        fontSize: number;
        scene: any;
    }): { texture: DynamicTexture, width: number, height: number, scaleFactor: number } {
        const scaleFactor = 3; // Render at 3x resolution for crisp text
        const scaledFontSize = options.fontSize * scaleFactor;
        
        // Calculate texture dimensions
        const maxLineLength = Math.max(...options.lines.map(line => line.text.length));
        const textureWidth = Math.max(1024, maxLineLength * scaledFontSize * 0.8) * scaleFactor;
        const lineHeight = scaledFontSize + (10 * scaleFactor);
        const textureHeight = (options.lines.length * lineHeight + 80) * scaleFactor;
        
        const dynamicTexture = new DynamicTexture("textTexture", { width: textureWidth, height: textureHeight }, options.scene, false, DynamicTexture.TRILINEAR_SAMPLINGMODE);
        dynamicTexture.hasAlpha = true;
        
        const context = dynamicTexture.getContext() as CanvasRenderingContext2D;
        
        // Configure high-quality rendering
        context.save();
        context.clearRect(0, 0, textureWidth, textureHeight);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.font = `bold ${scaledFontSize}px Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        
        // Configure outline
        context.strokeStyle = "rgba(0, 0, 0, 0.9)";
        context.lineWidth = 4 * scaleFactor;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.miterLimit = 2;
        
        // Calculate starting Y position for centered text
        const totalTextHeight = options.lines.length * lineHeight;
        const startY = (textureHeight - totalTextHeight) / 2 + lineHeight / 2;
        const x = textureWidth / 2;
        
        // Draw each line
        options.lines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            
            // Draw outline
            context.strokeText(line.text, x, y);
            
            // Draw main text
            context.globalCompositeOperation = "source-over";
            context.fillStyle = line.color;
            context.fillText(line.text, x, y);
        });
        
        context.restore();
        dynamicTexture.update();
        
        return { texture: dynamicTexture, width: textureWidth, height: textureHeight, scaleFactor };
    }

    /**
     * Create a simplified text material for nameplate meshes
     */
    private createTextMaterial(texture: DynamicTexture, scene: any): StandardMaterial {
        const material = new StandardMaterial("textMaterial", scene);
        
        // Basic texture and transparency setup
        material.diffuseTexture = texture;
        material.emissiveTexture = texture;
        material.useAlphaFromDiffuseTexture = true;
        material.alphaMode = Engine.ALPHA_COMBINE;
        
        // Disable lighting and enable transparency
        material.disableLighting = true;
        material.backFaceCulling = false;
        material.disableDepthWrite = true; // Prevent z-fighting
        
        return material;
    }

    /**
     * Create a simplified text plane for nameplate meshes
     */
    private createTextPlane(material: StandardMaterial, textureWidth: number, textureHeight: number, scaleFactor: number, scene: any): Mesh {
        const textWidth = (textureWidth / scaleFactor) / 60;
        const textHeight = (textureHeight / scaleFactor) / 60;
        const plane = PlaneBuilder.CreatePlane("textPlane", { width: textWidth, height: textHeight, updatable: false }, scene);

        plane.material = material;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.isPickable = false;
        plane.doNotSyncBoundingInfo = true;
        
        plane.freezeWorldMatrix();
        plane.renderingGroupId = 3;
        plane.alwaysSelectAsActiveMesh = true;
        
        plane.computeWorldMatrix(true);
        plane.refreshBoundingInfo();
        return plane;
    }

    /**
     * Create a multi-line nameplate for ground items at the same position
     */
    private createMultiLineGroundItemNameplate(lines: Array<{ text: string, color: string }>): Mesh {
        const scene = this.gameHooks.GameEngine.Instance.Scene;
        const actualFontSize = this.getFontSize('groundItem', 18);
        
        // Create multi-line texture
        const result = this.createDynamicTexture({
            lines: lines,
            fontSize: actualFontSize,
            scene
        });
        
        // Create material and plane
        const material = this.createTextMaterial(result.texture, scene);
        const plane = this.createTextPlane(material, result.width, result.height, result.scaleFactor, scene);

        return plane;
    }

}
