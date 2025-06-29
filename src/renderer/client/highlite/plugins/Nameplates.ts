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

        // Nameplate toggles
        this.settings.playerNameplates = { text: "Player Nameplates", type: SettingsTypes.checkbox, value: true, callback: () => {} };
        this.settings.npcNameplates = { text: "NPC Nameplates", type: SettingsTypes.checkbox, value: true, callback: () => {} };
        this.settings.youNameplate = { text: "You Nameplate", type: SettingsTypes.checkbox, value: true, callback: () => {} };
        this.settings.groundItemNameplates = { text: "Ground Item Nameplates", type: SettingsTypes.checkbox, value: true, callback: () => {} };

        // Fixed size setting
        this.settings.fixedSizeNameplates = { text: "Fixed Size Nameplates (DOM-like - same size regardless of distance)", type: SettingsTypes.checkbox, value: false, callback: () => this.regenerateAllNameplates() };

        // Size settings
        Object.assign(this.settings, {
            playerNameplateSize: { text: "Player Nameplate Text Size", type: SettingsTypes.range, value: 20, callback: () => this.regeneratePlayerNameplates() },
            npcNameplateSize: { text: "NPC Nameplate Text Size", type: SettingsTypes.range, value: 20, callback: () => this.regenerateNPCNameplates() },
            youNameplateSize: { text: "You Nameplate Text Size", type: SettingsTypes.range, value: 20, callback: () => this.regenerateMainPlayerNameplate() },
            groundItemNameplateSize: { text: "Ground Item Nameplate Text Size", type: SettingsTypes.range, value: 20, callback: () => this.regenerateGroundItemNameplates() }
        });
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
        const diff = Math.max(-10, Math.min(10, playerLevel - npcLevel));
        const greenToRed = [
            "rgb(0, 255, 0)", "rgb(25, 255, 0)", "rgb(50, 255, 0)", "rgb(76, 255, 0)", "rgb(101, 255, 0)",
            "rgb(127, 255, 0)", "rgb(152, 255, 0)", "rgb(178, 255, 0)", "rgb(204, 255, 0)", "rgb(229, 255, 0)",
            "rgb(255, 255, 0)", "rgb(255, 229, 0)", "rgb(255, 204, 0)", "rgb(255, 178, 0)", "rgb(255, 152, 0)",
            "rgb(255, 127, 0)", "rgb(255, 101, 0)", "rgb(255, 76, 0)", "rgb(255, 50, 0)", "rgb(255, 25, 0)", "rgb(255, 0, 0)"
        ];
        return greenToRed[diff + 10] || "rgb(255, 255, 255)";
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
        const NPCS = this.gameHooks.EntityManager.Instance._npcs; // Map
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
        this.cleanupStaleEntities(NPCS, Players, MainPlayer, GroundItems);


        // Process entities
        this.processNPCs(NPCS, MainPlayer);
        this.processPlayers(Players, MainPlayer, playerFriends);
        this.processGroundItems(GroundItems);
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
     * Calculate scale factor to maintain consistent size regardless of distance
     */
    private calculateFixedSizeScale(worldPosition: Vector3): number {
        if (!this.settings.fixedSizeNameplates?.value) {
            return 1.0; // No scaling when fixed size is disabled
        }

        const camera = this.gameHooks.GameCameraManager.Camera;
        if (!camera) {
            return 1.0;
        }

        // Calculate distance from camera to nameplate
        const cameraPosition = camera.position;
        const distance = Vector3.Distance(cameraPosition, worldPosition);
        
        // Base distance for normal size (adjust this value to control the "normal" viewing distance)
        const baseDistance = 10.0;
        
        // Scale factor to maintain consistent apparent size
        // At baseDistance, scale = 1.0. Closer = smaller scale, farther = larger scale
        const scaleFactor = Math.max(0.1, distance / baseDistance);
        
        return scaleFactor;
    }

    /**
     * Create or update a ground item nameplate
     */
    private createOrUpdateGroundItemNameplate(
        representativeKey: string, 
        lines: Array<{ text: string, color: string }>, 
        firstItem: any, 
        positionGroup: any,
        positionKey: string,
        forceRecreate: boolean = false
    ): void {
        const existingMesh = this.GroundItemTextMeshes[representativeKey];
        const needsRecreation = !existingMesh || 
                               forceRecreate || 
                               (existingMesh && existingMesh.quantity !== positionGroup.totalItems);

        if (needsRecreation) {
            // Dispose existing mesh if it exists
            if (existingMesh?.mesh) {
                existingMesh.mesh.dispose(false, true);
            }

            // Create new nameplate
            const textMesh = this.createMultiLineGroundItemNameplate(lines);
            const parentNode = this.getEntityParentNode(firstItem.item, 'grounditem');
            if (parentNode) {
                textMesh.parent = parentNode;
            }
            
            if (existingMesh) {
                // Update existing entry
                existingMesh.mesh = textMesh;
                existingMesh.quantity = positionGroup.totalItems;
                existingMesh.itemName = `${positionGroup.items.size} types`;
            } else {
                // Create new entry
                this.GroundItemTextMeshes[representativeKey] = {
                    mesh: textMesh,
                    itemName: `${positionGroup.items.size} types`,
                    quantity: positionGroup.totalItems,
                    position: positionKey
                };
            }
        }
    }

    /**
     * Get world position from entity based on entity type
     */
    private getEntityWorldPosition(entity: any, entityType: 'player' | 'npc' | 'grounditem'): Vector3 | null {
        if (!entity || !entity._appearance) {
            return null;
        }

        if (entityType === 'grounditem') {
            return entity._appearance._billboardMesh?.getAbsolutePosition() || null;
        } else {
            // For players and NPCs
            return entity._appearance._haloNode?.getAbsolutePosition() || null;
        }
    }

    /**
     * Get parent node for entity based on entity type
     */
    private getEntityParentNode(entity: any, entityType: 'player' | 'npc' | 'grounditem'): any | null {
        if (!entity || !entity._appearance) {
            return null;
        }

        if (entityType === 'grounditem') {
            return entity._appearance._billboardMesh || null;
        } else {
            // For players and NPCs
            return entity._appearance._haloNode || null;
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
        // Get world position using helper method
        const worldPos = this.getEntityWorldPosition(entity, entityType);
        if (!worldPos) {
            return new Vector3(0, 0.25, 0); // Default position
        }
        
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
     * Apply fixed size scaling to a nameplate mesh if the setting is enabled
     */
    private applyFixedSizeScaling(mesh: Mesh, entity: any, entityType: 'player' | 'npc' | 'grounditem'): void {
        if (!this.settings.fixedSizeNameplates?.value) {
            return; // Fixed size scaling is disabled
        }

        // Get world position using helper method
        const worldPos = this.getEntityWorldPosition(entity, entityType);
        if (!worldPos) {
            return;
        }

        // Calculate and apply the scale factor
        const scaleFactor = this.calculateFixedSizeScale(worldPos);
        mesh.scaling.setAll(scaleFactor);
    }

    /**
     * Clear position tracker - called before each frame to reset stacking
     */
    private resetPositionTracker(): void {
        this.positionTracker.clear();
    }

    /**
     * Safely dispose a mesh from a collection
     */
    private disposeMeshFromCollection(collection: any, key: string | number): void {
        if (collection[key]?.mesh) {
            collection[key].mesh.dispose(false, true);
            delete collection[key];
        }
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
     * Unified method to create or update nameplate for any entity type
     */
    private createOrUpdateNameplate(
        entity: any, 
        entityType: 'player' | 'npc' | 'mainPlayer',
        options: {
            entityKey?: number;
            playerFriends?: string[];
            mainPlayerLevel?: number;
            forceRecreate?: boolean;
        } = {}
    ): void {
        const { entityKey, playerFriends = [], mainPlayerLevel = 0, forceRecreate = false } = options;
        
        // Determine storage key and collection
        const storageKey = entityKey ?? entity._entityId;
        const collection = entityType === 'npc' ? this.NPCTextMeshes : this.PlayerTextMeshes;
        const existingMesh = collection[storageKey];

        // Determine if recreation is needed based on entity type
        let needsRecreation = !existingMesh || forceRecreate;
        
        if (entityType === 'player' && existingMesh && playerFriends.length > 0) {
            const isFriend = playerFriends.includes(entity._nameLowerCase);
            const playerMesh = existingMesh as { mesh: Mesh, isFriend: boolean };
            needsRecreation = needsRecreation || (playerMesh.isFriend !== isFriend);
        }

        if (needsRecreation) {
            // Dispose existing mesh if it exists
            if (existingMesh?.mesh) {
                existingMesh.mesh.dispose(false, true);
            }

            // Create new nameplate based on entity type
            let textMesh: Mesh;
            let additionalData: any = {};

            switch (entityType) {
                case 'player':
                    const isFriend = playerFriends.includes(entity._nameLowerCase);
                    const currentColor = isFriend ? "lightgreen" : "white";
                    textMesh = this.createNameplateMesh({
                        text: entity._name,
                        color: currentColor,
                        fontSize: 20,
                        nameplateType: 'player'
                    });
                    additionalData = { isFriend };
                    break;

                case 'mainPlayer':
                    textMesh = this.createNameplateMesh({
                        text: entity._name,
                        color: "cyan",
                        fontSize: 20,
                        nameplateType: 'mainPlayer'
                    });
                    additionalData = { isFriend: false };
                    break;

                case 'npc':
                    textMesh = this.createNPCNameplate(entity, mainPlayerLevel);
                    break;

                default:
                    throw new Error(`Unknown entity type: ${entityType}`);
            }

            // Set parent node
            const parentNode = this.getEntityParentNode(entity, entityType === 'mainPlayer' ? 'player' : entityType);
            if (parentNode) {
                textMesh.parent = parentNode;
            }
            
            // Store in appropriate collection
            collection[storageKey] = {
                mesh: textMesh,
                ...additionalData
            };
        }
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
                this.createOrUpdateNameplate(player, 'player', { playerFriends, forceRecreate: true });
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
                this.createOrUpdateNameplate(npc, 'npc', { entityKey: key, mainPlayerLevel: MainPlayer._combatLevel, forceRecreate: true });
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
            this.createOrUpdateNameplate(MainPlayer, 'mainPlayer', { forceRecreate: true });
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
                const worldPos = this.getEntityWorldPosition(groundItem, 'grounditem');
                if (!worldPos) continue;
                
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
                if (data.parent) {
                    textMesh.parent = data.parent;
                }
                
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
     * Regenerate all nameplate types when fixed size setting changes
     */
    private regenerateAllNameplates(): void {
        this.regeneratePlayerNameplates();
        this.regenerateNPCNameplates();
        this.regenerateMainPlayerNameplate();
        this.regenerateGroundItemNameplates();
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
        const sizeKey = nameplateType === 'mainPlayer' ? 'youNameplateSize' : `${nameplateType}NameplateSize`;
        return this.settings[sizeKey]?.value as number || defaultSize;
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
        
        // If fixed size nameplates are enabled, we'll handle scaling in the game loop
        if (!this.settings.fixedSizeNameplates?.value) {
            plane.freezeWorldMatrix();
        }
        
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

    /**
     * Clean up stale entities that no longer exist
     */
    private cleanupStaleEntities(NPCS: Map<number, any>, Players: any[], MainPlayer: any, GroundItems: Map<number, any>): void {
        for (const key in this.NPCTextMeshes) {
            if (!NPCS.has(parseInt(key))) this.disposeMeshFromCollection(this.NPCTextMeshes, key);
        }
        for (const key in this.PlayerTextMeshes) {
            const exists = Players.some(p => p._entityId === parseInt(key)) || (MainPlayer && MainPlayer._entityId === parseInt(key));
            if (!exists) this.disposeMeshFromCollection(this.PlayerTextMeshes, key);
        }
        for (const key in this.GroundItemTextMeshes) {
            if (!GroundItems.has(parseInt(key))) this.disposeMeshFromCollection(this.GroundItemTextMeshes, key);
        }
    }

    /**
     * Process all NPCs for nameplate creation and positioning
     */
    private processNPCs(NPCS: Map<number, any>, MainPlayer: any): void {
        if (this.settings.npcNameplates!.value) {
            for (const [key, npc] of NPCS) {
                this.createOrUpdateNameplate(npc, 'npc', { entityKey: key, mainPlayerLevel: MainPlayer._combatLevel });
                if (this.NPCTextMeshes[key]) {
                    this.NPCTextMeshes[key].mesh.position = this.calculateStackedPosition(npc, 'npc');
                    this.applyFixedSizeScaling(this.NPCTextMeshes[key].mesh, npc, 'npc');
                }
            }
        } else {
            this.cleanupMeshCollection(this.NPCTextMeshes);
        }
    }

    /**
     * Process all players for nameplate creation and positioning
     */
    private processPlayers(Players: any[], MainPlayer: any, playerFriends: string[]): void {
        if (this.settings.playerNameplates!.value) {
            for (const player of Players) {
                this.createOrUpdateNameplate(player, 'player', { playerFriends });
                this.PlayerTextMeshes[player._entityId].mesh.position = this.calculateStackedPosition(player, 'player', false);
                this.applyFixedSizeScaling(this.PlayerTextMeshes[player._entityId].mesh, player, 'player');
            }
        } else {
            for (const key in this.PlayerTextMeshes) {
                if (MainPlayer && parseInt(key) !== MainPlayer._entityId) {
                    this.disposeMeshFromCollection(this.PlayerTextMeshes, key);
                }
            }
        }

        // Handle MainPlayer nameplate
        if (this.settings.youNameplate!.value && MainPlayer) {
            this.createOrUpdateNameplate(MainPlayer, 'mainPlayer');
            this.PlayerTextMeshes[MainPlayer._entityId].mesh.position = this.calculateStackedPosition(MainPlayer, 'player', true);
            this.applyFixedSizeScaling(this.PlayerTextMeshes[MainPlayer._entityId].mesh, MainPlayer, 'player');
        } else if (!this.settings.youNameplate!.value && MainPlayer && this.PlayerTextMeshes[MainPlayer._entityId]) {
            this.disposeMeshFromCollection(this.PlayerTextMeshes, MainPlayer._entityId);
        }
    }

    /**
     * Process all ground items for nameplate creation and positioning
     */
    private processGroundItems(GroundItems: Map<number, any>): void {
        if (!this.settings.groundItemNameplates!.value) {
            this.cleanupMeshCollection(this.GroundItemTextMeshes);
            return;
        }

        const positionGroups = this.groupGroundItemsByPosition(GroundItems);
        this.cleanupUnusedGroundItemMeshes(positionGroups);
        
        for (const [positionKey, positionGroup] of positionGroups) {
            const lines = this.createGroundItemLines(positionGroup);
            const firstItem = Array.from(positionGroup.items.values())[0].items[0];
            
            this.createOrUpdateGroundItemNameplate(positionGroup.firstKey, lines, firstItem, positionGroup, positionKey);
            
            this.GroundItemTextMeshes[positionGroup.firstKey].mesh.position = this.calculateStackedPosition(firstItem.item, 'grounditem');
            this.applyFixedSizeScaling(this.GroundItemTextMeshes[positionGroup.firstKey].mesh, firstItem.item, 'grounditem');
        }
    }

    /**
     * Group ground items by their world position
     */
    private groupGroundItemsByPosition(GroundItems: Map<number, any>): Map<string, { items: Map<string, { items: any[], count: number }>, firstKey: string, totalItems: number }> {
        const positionGroups = new Map();
        
        for (const [key, groundItem] of GroundItems) {
            const worldPos = this.getEntityWorldPosition(groundItem, 'grounditem');
            if (!worldPos) continue;
            
            const positionKey = `${Math.round(worldPos.x * 2) / 2}_${Math.round(worldPos.z * 2) / 2}`;
            
            if (!positionGroups.has(positionKey)) {
                positionGroups.set(positionKey, { items: new Map(), firstKey: String(key), totalItems: 0 });
            }
            
            const positionGroup = positionGroups.get(positionKey)!;
            const itemName = groundItem._def._nameCapitalized;
            
            if (!positionGroup.items.has(itemName)) {
                positionGroup.items.set(itemName, { items: [], count: 0 });
            }
            
            positionGroup.items.get(itemName)!.items.push({ key: String(key), item: groundItem });
            positionGroup.items.get(itemName)!.count++;
            positionGroup.totalItems++;
        }
        
        return positionGroups;
    }

    /**
     * Clean up ground item meshes that are no longer needed
     */
    private cleanupUnusedGroundItemMeshes(positionGroups: Map<string, any>): void {
        const activePositionKeys = new Set(positionGroups.keys());
        for (const key in this.GroundItemTextMeshes) {
            if (!activePositionKeys.has(this.GroundItemTextMeshes[key].position)) {
                this.disposeMeshFromCollection(this.GroundItemTextMeshes, key);
            }
        }
    }

    /**
     * Create display lines for grouped ground items
     */
    private createGroundItemLines(positionGroup: any): Array<{ text: string, color: string }> {
        const entries = Array.from(positionGroup.items.entries()) as [string, any][];
        return entries
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([itemName, itemGroup]) => ({
                text: itemGroup.count > 1 ? `${itemName} [x${itemGroup.count}]` : itemName,
                color: "orange"
            }));
    }

}
