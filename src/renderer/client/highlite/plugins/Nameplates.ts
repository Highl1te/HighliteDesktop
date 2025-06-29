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
                    this.NPCTextMeshes[key].mesh.position = this.calculateNPCStackedPosition(npc);
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
                    const textMesh = this.createTextMesh(player._name, currentColor, 20, 'player');
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
                        const textMesh = this.createTextMesh(player._name, currentColor, 20, 'player');
                        textMesh.parent = player._appearance._haloNode; // Parent to halo node
                        this.PlayerTextMeshes[player._entityId] = {
                            mesh: textMesh,
                            isFriend: isFriend
                        };
                    }
                }
                
                // Update position every frame for proper stacking
                this.PlayerTextMeshes[player._entityId].mesh.position = this.calculatePlayerStackedPosition(player, false);
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
                const textMesh = this.createTextMesh(MainPlayer._name, "cyan", 20, 'mainPlayer'); // Use cyan to distinguish from other players
                textMesh.parent = MainPlayer._appearance._haloNode; // Parent to halo node
                this.PlayerTextMeshes[mainPlayerEntityId] = {
                    mesh: textMesh,
                    isFriend: false // MainPlayer is not considered a friend for color purposes
                };
            }

            this.PlayerTextMeshes[mainPlayerEntityId].mesh.position = this.calculatePlayerStackedPosition(MainPlayer, true);
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
            // First, group items by name and position
            const itemGroups: Map<string, { items: any[], count: number, firstKey: string }> = new Map();
            
            for (const [key, groundItem] of GroundItems) {
                const itemName = groundItem._def._nameCapitalized;
                const worldPos = groundItem._appearance._billboardMesh.getAbsolutePosition();
                const roundedX = Math.round(worldPos.x * 2) / 2;
                const roundedZ = Math.round(worldPos.z * 2) / 2;
                const positionKey = `${roundedX}_${roundedZ}`;
                const groupKey = `${itemName}_${positionKey}`;
                
                if (!itemGroups.has(groupKey)) {
                    itemGroups.set(groupKey, { items: [], count: 0, firstKey: String(key) });
                }
                
                const group = itemGroups.get(groupKey)!;
                group.items.push({ key: String(key), item: groundItem });
                group.count++;
            }
            
            // Clean up old meshes that are no longer needed
            const activeGroupKeys = new Set();
            for (const [groupKey] of itemGroups) {
                activeGroupKeys.add(groupKey);
            }
            
            for (const key in this.GroundItemTextMeshes) {
                const existingMesh = this.GroundItemTextMeshes[key];
                const groupKey = `${existingMesh.itemName}_${existingMesh.position}`;
                if (!activeGroupKeys.has(groupKey)) {
                    existingMesh.mesh.dispose(false, true);
                    delete this.GroundItemTextMeshes[key];
                }
            }
            
            // Create or update nameplates for each group
            for (const [, group] of itemGroups) {
                const firstItem = group.items[0];
                const itemName = firstItem.item._def._nameCapitalized;
                const displayText = group.count > 1 ? `${itemName} [x${group.count}]` : itemName;
                
                // Use the first item's key as the representative key for this group
                const representativeKey = group.firstKey;
                
                if (!this.GroundItemTextMeshes[representativeKey]) {
                    // Create new nameplate
                    const textMesh = this.createTextMesh(displayText, "orange", 18, 'groundItem');
                    textMesh.parent = firstItem.item._appearance._billboardMesh;
                    
                    const worldPos = firstItem.item._appearance._billboardMesh.getAbsolutePosition();
                    const roundedX = Math.round(worldPos.x * 2) / 2;
                    const roundedZ = Math.round(worldPos.z * 2) / 2;
                    const positionKey = `${roundedX}_${roundedZ}`;
                    
                    this.GroundItemTextMeshes[representativeKey] = {
                        mesh: textMesh,
                        itemName: itemName,
                        quantity: group.count,
                        position: positionKey
                    };
                } else {
                    // Update existing nameplate if quantity changed
                    const existingMesh = this.GroundItemTextMeshes[representativeKey];
                    if (existingMesh.quantity !== group.count) {
                        // Dispose old mesh and create new one with updated text
                        existingMesh.mesh.dispose(false, true);
                        
                        const textMesh = this.createTextMesh(displayText, "orange", 18, 'groundItem');
                        textMesh.parent = firstItem.item._appearance._billboardMesh;
                        
                        existingMesh.mesh = textMesh;
                        existingMesh.quantity = group.count;
                    }
                }
                
                // Update position every frame for proper stacking
                this.GroundItemTextMeshes[representativeKey].mesh.position = this.calculateGroundItemStackedPosition(firstItem.item);
            }
        } else {
            // Ground item nameplates are disabled, clean up any existing ground item meshes
            this.cleanupMeshCollection(this.GroundItemTextMeshes);
        }
    }


    createTextMesh(text: string, color: string = "white", fontSize: number = 24, nameplateType: 'player' | 'npc' | 'mainPlayer' | 'groundItem' = 'player'): Mesh {
        const scene = this.gameHooks.GameEngine.Instance.Scene;

        // Get the appropriate font size setting based on nameplate type
        const actualFontSize = this.getFontSize(nameplateType, fontSize);

        // Use higher resolution for better text quality
        const scaleFactor = 3; // Render at 3x resolution for crisp text
        const scaledFontSize = actualFontSize * scaleFactor;

        // Create a dynamic texture for the text with better dimensions
        const textureWidth = Math.max(1024, text.length * scaledFontSize * 0.8) * scaleFactor;
        const textureHeight = (scaledFontSize * 2 + 80) * scaleFactor; // More height for better spacing
        const dynamicTexture = new DynamicTexture("textTexture", { width: textureWidth, height: textureHeight }, scene, false, DynamicTexture.TRILINEAR_SAMPLINGMODE);

        // Enable transparency on the texture
        dynamicTexture.hasAlpha = true;

        // Get the 2D context for advanced text rendering
        const context = dynamicTexture.getContext() as CanvasRenderingContext2D;

        // Clear the entire canvas to transparent
        context.save();
        context.clearRect(0, 0, textureWidth, textureHeight);

        // Enable high-quality text rendering
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        (context as any).textRenderingOptimization = 'optimizeQuality';

        // Set font properties with better settings
        context.font = `bold ${scaledFontSize}px Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";

        // Split text into lines for multi-line support
        const lines = text.split('\n');
        const lineHeight = scaledFontSize + (10 * scaleFactor); // Reduced spacing between lines
        const startY = textureHeight / 2 - ((lines.length - 1) * lineHeight) / 2;

        // Draw each line with outline for better visibility
        lines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            const x = textureWidth / 2;

            // Draw black outline (stroke) with scaled settings
            context.strokeStyle = "rgba(0, 0, 0, 0.9)";
            context.lineWidth = 4 * scaleFactor;
            context.lineJoin = "round";
            context.lineCap = "round";
            context.miterLimit = 2;
            context.strokeText(line, x, y);

            // Ensure the fill color is properly set and draw main text
            context.globalCompositeOperation = "source-over";
            context.fillStyle = color;
            context.fillText(line, x, y);
        });

        context.restore();

        // Update the texture after all drawing is complete
        dynamicTexture.update();        
        
        // Create material with transparency
        const material = new StandardMaterial("textMaterial", scene);
        material.diffuseTexture = dynamicTexture;
        material.disableLighting = true;
        material.useAlphaFromDiffuseTexture = true;
        material.backFaceCulling = false;
        material.alphaMode = Engine.ALPHA_COMBINE;
        
        // Ensure the material doesn't override texture colors
        material.emissiveTexture = dynamicTexture;
        material.diffuseColor.r = 1;
        material.diffuseColor.g = 1;
        material.diffuseColor.b = 1;
        material.emissiveColor.r = 1;
        material.emissiveColor.g = 1;
        material.emissiveColor.b = 1;
        
        // Force transparency settings
        material.needAlphaBlending = () => true;
        material.needAlphaTesting = () => false;
        
        // Enhanced rendering settings for better visibility
        material.disableColorWrite = false;
        material.disableDepthWrite = true; // Disable depth writing to prevent z-fighting
        material.separateCullingPass = true;
        material.forceDepthWrite = false;
        
        // Special settings for main player nameplate
        if (nameplateType === 'mainPlayer') {
            material.freeze(); // Freeze material for better performance
        }
        
        // Create plane mesh with optimized size (scaled back down for proper world size)
        const textWidth = (textureWidth / scaleFactor) / 60;
        const textHeight = (textureHeight / scaleFactor) / 60;
        const plane = PlaneBuilder.CreatePlane("textPlane", { width: textWidth, height: textHeight }, scene);
        plane.material = material;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        
        // Special handling for main player nameplate to ensure it's always visible
        if (nameplateType === 'mainPlayer') {
            plane.renderingGroupId = 3; // Higher rendering group for main player
            plane.infiniteDistance = true; // Prevent frustum culling
            plane.alwaysSelectAsActiveMesh = true; // Always consider for rendering
        } else {
            plane.renderingGroupId = 2; // Use a moderate rendering group for others
        }
        
        // Exclude from post-processing pipeline
        plane.isPickable = false;
        plane.doNotSyncBoundingInfo = true;
        plane.freezeWorldMatrix(); // Optimize performance by freezing world matrix updates

        return plane;
    }

    createMultiColorTextMesh(
        nameText: string, 
        levelText: string, 
        isAggressive: boolean, 
        isAlwaysAggro: boolean, 
        nameColor: string, 
        levelColor: string, 
        fontSize: number = 24
    ): Mesh {
        const scene = this.gameHooks.GameEngine.Instance.Scene;
        
        // Get the NPC nameplate size setting
        const npcFontSize = this.getFontSize('npc', fontSize);
        
        // Use higher resolution for better text quality
        const scaleFactor = 3; // Render at 3x resolution for crisp text
        const actualFontSize = npcFontSize * scaleFactor;
        
        // Add emoji based on aggression
        let emojiText = "";
        if (isAggressive && !isAlwaysAggro) {
            emojiText = " 😠";
        } else if (!isAggressive && !isAlwaysAggro) {
            emojiText = " 😐";
        } else if (isAlwaysAggro) {
            emojiText = " 👿";
        }
        
        // Create a dynamic texture for the text with better dimensions
        const maxLineLength = Math.max(nameText.length, (levelText + emojiText).length);
        const textureWidth = Math.max(1024, maxLineLength * actualFontSize * 0.8) * scaleFactor;
        const textureHeight = (actualFontSize * 3 + 80) * scaleFactor; // Height for 2 lines plus spacing
        const dynamicTexture = new DynamicTexture("multiColorTextTexture", {width: textureWidth, height: textureHeight}, scene, false, DynamicTexture.TRILINEAR_SAMPLINGMODE);
        
        // Enable transparency on the texture
        dynamicTexture.hasAlpha = true;
        
        // Get the 2D context for advanced text rendering
        const context = dynamicTexture.getContext() as CanvasRenderingContext2D;
        
        // Clear the entire canvas to transparent
        context.save();
        context.clearRect(0, 0, textureWidth, textureHeight);
        
        // Enable high-quality text rendering
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        (context as any).textRenderingOptimization = 'optimizeQuality';
        
        // Set font properties with better settings
        context.font = `bold ${actualFontSize}px Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        
        const lineHeight = actualFontSize + (10 * scaleFactor); // Reduced spacing between lines
        const startY = textureHeight / 2 - lineHeight / 2;
        
        // Draw name line (first line)
        const nameY = startY;
        const nameX = textureWidth / 2;
        
        // Draw black outline for name
        context.strokeStyle = "rgba(0, 0, 0, 0.9)";
        context.lineWidth = 4 * scaleFactor;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.miterLimit = 2;
        context.strokeText(nameText, nameX, nameY);
        
        // Draw name text
        context.globalCompositeOperation = "source-over";
        context.fillStyle = nameColor;
        context.fillText(nameText, nameX, nameY);
        
        // Draw level line (second line)
        const levelY = startY + lineHeight;
        const levelX = textureWidth / 2;
        
        // Draw black outline for level
        context.strokeText(levelText + emojiText, levelX, levelY);
        
        // Draw level text
        context.fillStyle = levelColor;
        context.fillText(levelText + emojiText, levelX, levelY);
        
        context.restore();
        
        // Update the texture after all drawing is complete
        dynamicTexture.update();
        
        // Create material with transparency
        const material = new StandardMaterial("multiColorTextMaterial", scene);
        material.diffuseTexture = dynamicTexture;
        material.disableLighting = true;
        material.useAlphaFromDiffuseTexture = true;
        material.backFaceCulling = false;
        material.alphaMode = Engine.ALPHA_COMBINE;
        
        // Ensure the material doesn't override texture colors
        material.emissiveTexture = dynamicTexture;
        material.diffuseColor.r = 1;
        material.diffuseColor.g = 1;
        material.diffuseColor.b = 1;
        material.emissiveColor.r = 1;
        material.emissiveColor.g = 1;
        material.emissiveColor.b = 1;
        
        // Force transparency settings
        material.needAlphaBlending = () => true;
        material.needAlphaTesting = () => false;
        
        // Disable post-processing effects on this material
        material.disableColorWrite = false;
        material.disableDepthWrite = false;
        material.separateCullingPass = true;
        
        // Create plane mesh with optimized size (scaled back down for proper world size)
        const textWidth = (textureWidth / scaleFactor) / 60;
        const textHeight = (textureHeight / scaleFactor) / 60;
        const plane = PlaneBuilder.CreatePlane("multiColorTextPlane", {width: textWidth, height: textHeight}, scene);
        plane.material = material;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.renderingGroupId = 2; // Use a moderate rendering group for NPCs
        
        // Exclude from post-processing pipeline
        plane.isPickable = false;
        plane.doNotSyncBoundingInfo = true;
        plane.freezeWorldMatrix(); // Optimize performance
        
        return plane;
    }

    /**
     * Create nameplate for NPC with appropriate styling
     */
    private createNPCNameplate(npc: any, mainPlayerLevel: number): Mesh {
        if (npc._combatLevel != 0) {
            // Calculate level color using the helper method
            const levelColor = this.calculateLevelColor(mainPlayerLevel, npc._combatLevel);
            
            return this.createMultiColorTextMesh(
                npc._name, 
                `Lvl. ${npc._combatLevel}`, 
                npc._def._combat._isAggressive, 
                npc._def._combat._isAlwaysAggro,
                "yellow", 
                levelColor, 
                20
            );
        } else {
            // NPC with no combat level, just show name
            return this.createTextMesh(npc._name, "yellow", 20, 'npc');
        }
    }

    /**
     * Calculate the Y offset for ground item nameplates based on existing nameplates at the same position
     */
    private calculateGroundItemStackedPosition(groundItem: any): Vector3 {
        if (!groundItem || !groundItem._appearance || !groundItem._appearance._billboardMesh) {
            return new Vector3(0, 0.25, 0); // Default position
        }

        // Use world position from the billboard mesh for more reliable positioning
        const worldPos = groundItem._appearance._billboardMesh.getAbsolutePosition();
        
        // Create a position key based on rounded world coordinates (to group nearby items)
        const roundedX = Math.round(worldPos.x * 2) / 2; // Round to nearest 0.5
        const roundedZ = Math.round(worldPos.z * 2) / 2; // Round to nearest 0.5
        const positionKey = `grounditem_${roundedX}_${roundedZ}`;
        
        // Get current stack count for this position
        const stackIndex = this.positionTracker.get(positionKey) || 0;
        
        // Update stack count
        this.positionTracker.set(positionKey, stackIndex + 1);
        
        // Calculate Y offset (stack upwards with spacing optimized for ground items)
        const baseHeight = 0.5; // Start higher than NPCs/players to avoid overlap
        const stackSpacing = 0.3; // Smaller spacing for ground items
        const yOffset = baseHeight + (stackIndex * stackSpacing);
        
        return new Vector3(0, yOffset, 0);
    }

    /**
     * Calculate the Y offset for player nameplates based on existing nameplates at the same position
     */
    private calculatePlayerStackedPosition(player: any, isMainPlayer: boolean): Vector3 {
        if (!player || !player._appearance || !player._appearance._haloNode) {
            return new Vector3(0, 0.25, 0); // Default position
        }

        // Use world position from the halo node for more reliable positioning
        const worldPos = player._appearance._haloNode.getAbsolutePosition();
        
        // Create a position key based on rounded world coordinates (to group nearby players)
        const roundedX = Math.round(worldPos.x * 2) / 2; // Round to nearest 0.5
        const roundedZ = Math.round(worldPos.z * 2) / 2; // Round to nearest 0.5
        const positionKey = `player_${roundedX}_${roundedZ}`;
        
        let stackIndex = 0;
        
        if (isMainPlayer) {
            // MainPlayer always gets the top position (highest Y)
            // Reserve the top slot for MainPlayer
            const totalPlayersAtPosition = this.positionTracker.get(positionKey) || 0;
            this.positionTracker.set(positionKey, totalPlayersAtPosition + 1);
            stackIndex = totalPlayersAtPosition; // MainPlayer gets the highest index
        } else {
            // Other players stack below MainPlayer
            const currentStack = this.positionTracker.get(positionKey) || 0;
            this.positionTracker.set(positionKey, currentStack + 1);
            stackIndex = currentStack;
        }
        
        // Calculate Y offset (stack upwards)
        const baseHeight = 0.25;
        const stackSpacing = 0.4; // Spacing between player nameplates
        const yOffset = baseHeight + (stackIndex * stackSpacing);
        
        return new Vector3(0, yOffset, 0);
    }

    /**
     * Calculate the Y offset for NPC nameplates based on existing nameplates at the same position
     */
    private calculateNPCStackedPosition(npc: any): Vector3 {
        if (!npc || !npc._appearance || !npc._appearance._haloNode) {
            return new Vector3(0, 0.25, 0); // Default position
        }

        // Use world position from the halo node for more reliable positioning
        const worldPos = npc._appearance._haloNode.getAbsolutePosition();
        
        // Create a position key based on rounded world coordinates (to group nearby NPCs)
        const roundedX = Math.round(worldPos.x * 2) / 2; // Round to nearest 0.5
        const roundedZ = Math.round(worldPos.z * 2) / 2; // Round to nearest 0.5
        const positionKey = `npc_${roundedX}_${roundedZ}`;
        
        // Get current stack count for this position
        const stackIndex = this.positionTracker.get(positionKey) || 0;
        
        // Update stack count
        this.positionTracker.set(positionKey, stackIndex + 1);
        
        // Calculate Y offset (stack upwards)
        const baseHeight = 0.25;
        const stackSpacing = 0.4; // Spacing between NPC nameplates
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
                const currentColor = this.getPlayerNameplateColor(player._name, playerFriends);

                // Dispose old mesh and create new one with updated size
                existingMesh.mesh.dispose(false, true);
                const textMesh = this.createTextMesh(player._name, currentColor, 20, 'player');
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
            const textMesh = this.createTextMesh(MainPlayer._name, "cyan", 20, 'mainPlayer');
            textMesh.parent = MainPlayer._appearance._haloNode;
            
            // Ensure proper rendering properties for main player
            textMesh.infiniteDistance = true;
            textMesh.alwaysSelectAsActiveMesh = true;
            
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
        const currentGroundItems: { [key: string]: { itemName: string, quantity: number, position: string, parent: any } } = {};
        
        for (const key in this.GroundItemTextMeshes) {
            const existingMesh = this.GroundItemTextMeshes[key];
            currentGroundItems[key] = {
                itemName: existingMesh.itemName,
                quantity: existingMesh.quantity,
                position: existingMesh.position,
                parent: existingMesh.mesh.parent
            };
            // Dispose old mesh
            existingMesh.mesh.dispose(false, true);
        }

        // Clear the collection
        this.GroundItemTextMeshes = {};

        // Recreate nameplates with new size
        for (const key in currentGroundItems) {
            const data = currentGroundItems[key];
            const displayText = data.quantity > 1 ? `${data.itemName} [x${data.quantity}]` : data.itemName;
            
            const textMesh = this.createTextMesh(displayText, "orange", 18, 'groundItem');
            textMesh.parent = data.parent;
            
            this.GroundItemTextMeshes[key] = {
                mesh: textMesh,
                itemName: data.itemName,
                quantity: data.quantity,
                position: data.position
            };
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
}
