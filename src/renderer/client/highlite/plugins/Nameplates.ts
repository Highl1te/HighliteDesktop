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

        this.settings.groundItemNameplates = {
            text: "Ground Item Nameplates",
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => { } //NOOP
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

    SocketManager_loggedIn() {
        // Babylon.js meshes will be created as needed in GameLoop_draw
    }

    SocketManager_handleLoggedOut() {
        // Clear all text meshes
        for (const key in this.NPCTextMeshes) {
            if (this.NPCTextMeshes[key]) {
                this.NPCTextMeshes[key].mesh.dispose();
                delete this.NPCTextMeshes[key];
            }
        }
        for (const key in this.PlayerTextMeshes) {
            if (this.PlayerTextMeshes[key]) {
                this.PlayerTextMeshes[key].mesh.dispose();
                delete this.PlayerTextMeshes[key];
            }
        }
        for (const key in this.GroundItemTextMeshes) {
            if (this.GroundItemTextMeshes[key]) {
                this.GroundItemTextMeshes[key].mesh.dispose();
                delete this.GroundItemTextMeshes[key];
            }
        }

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
                this.NPCTextMeshes[key].mesh.dispose();
                delete this.NPCTextMeshes[key];
            }
        }

        for (const key in this.PlayerTextMeshes) {
            const entityId = parseInt(key);
            // Don't remove MainPlayer's nameplate in this cleanup - it's handled separately
            if (entityId !== MainPlayer._entityId && !Players.some(player => player._entityId === entityId)) {
                this.log(`Removing player text mesh for ID ${key} - not found in current players.`);
                this.PlayerTextMeshes[key].mesh.dispose();
                delete this.PlayerTextMeshes[key];
            }
        }

        for (const key in this.GroundItemTextMeshes) {
            // More robust cleanup - check if ground item still exists
            let shouldRemove = true;
            if (GroundItems && GroundItems.size > 0) {
                // Check if any ground item in the map matches our key
                for (const [groundItemKey] of GroundItems) {
                    if (String(groundItemKey) === key) {
                        shouldRemove = false;
                        break;
                    }
                }
            }
            
            if (shouldRemove) {
                this.GroundItemTextMeshes[key].mesh.dispose();
                delete this.GroundItemTextMeshes[key];
            }
        }


        // Loop through all NPCs
        if (this.settings.npcNameplates!.value) {
            for (const [key, value] of NPCS) {
                const npc = value;
                if (!this.NPCTextMeshes[key]) {
                    // Build nameplate text
                    let nameplateText = npc._name;
                    if (npc._combatLevel != 0) {
                        // Calculate combat level difference manually
                        const playerCombatLevel = MainPlayer._combatLevel;
                        const levelDifference = playerCombatLevel - npc._combatLevel;
                        
                        // Convert level difference to RGB color based on CSS variables
                        let levelColor = "rgb(255, 255, 255)"; // Default white
                        
                        if (levelDifference >= 10) {
                            levelColor = "rgb(0, 255, 0)"; // pos-10
                        } else if (levelDifference === 9) {
                            levelColor = "rgb(25, 255, 0)"; // pos-9
                        } else if (levelDifference === 8) {
                            levelColor = "rgb(50, 255, 0)"; // pos-8
                        } else if (levelDifference === 7) {
                            levelColor = "rgb(76, 255, 0)"; // pos-7
                        } else if (levelDifference === 6) {
                            levelColor = "rgb(101, 255, 0)"; // pos-6
                        } else if (levelDifference === 5) {
                            levelColor = "rgb(127, 255, 0)"; // pos-5
                        } else if (levelDifference === 4) {
                            levelColor = "rgb(152, 255, 0)"; // pos-4
                        } else if (levelDifference === 3) {
                            levelColor = "rgb(178, 255, 0)"; // pos-3
                        } else if (levelDifference === 2) {
                            levelColor = "rgb(204, 255, 0)"; // pos-2
                        } else if (levelDifference === 1) {
                            levelColor = "rgb(229, 255, 0)"; // pos-1
                        } else if (levelDifference === 0) {
                            levelColor = "rgb(255, 255, 0)"; // pos-0
                        } else if (levelDifference === -1) {
                            levelColor = "rgb(255, 229, 0)"; // neg-1
                        } else if (levelDifference === -2) {
                            levelColor = "rgb(255, 204, 0)"; // neg-2
                        } else if (levelDifference === -3) {
                            levelColor = "rgb(255, 178, 0)"; // neg-3
                        } else if (levelDifference === -4) {
                            levelColor = "rgb(255, 152, 0)"; // neg-4
                        } else if (levelDifference === -5) {
                            levelColor = "rgb(255, 127, 0)"; // neg-5
                        } else if (levelDifference === -6) {
                            levelColor = "rgb(255, 101, 0)"; // neg-6
                        } else if (levelDifference === -7) {
                            levelColor = "rgb(255, 76, 0)"; // neg-7
                        } else if (levelDifference === -8) {
                            levelColor = "rgb(255, 50, 0)"; // neg-8
                        } else if (levelDifference === -9) {
                            levelColor = "rgb(255, 25, 0)"; // neg-9
                        } else if (levelDifference <= -10) {
                            levelColor = "rgb(255, 0, 0)"; // neg-10
                        }
                        
                        // Create the nameplate with colored level text
                        const textMesh = this.createMultiColorTextMesh(
                            npc._name, 
                            `Lvl. ${npc._combatLevel}`, 
                            npc._def._combat._isAggressive, 
                            npc._def._combat._isAlwaysAggro,
                            "yellow", 
                            levelColor, 
                            20
                        );
                        textMesh.parent = npc._appearance._haloNode; // Parent to halo node
                        textMesh.position = new Vector3(0, 0.25, 0); // Relative position above the NPC
                        this.NPCTextMeshes[key] = {
                            mesh: textMesh
                        };
                    } else {
                        // NPC with no combat level, just show name
                        const textMesh = this.createTextMesh(nameplateText, "yellow", 20);
                        textMesh.parent = npc._appearance._haloNode; // Parent to halo node
                        textMesh.position = new Vector3(0, 0.25, 0); // Relative position above the NPC
                        this.NPCTextMeshes[key] = {
                            mesh: textMesh
                        };
                    }
                }
            }
        } else {
            // NPC nameplates are disabled, clean up any existing NPC meshes
            for (const key in this.NPCTextMeshes) {
                this.NPCTextMeshes[key].mesh.dispose();
                delete this.NPCTextMeshes[key];
            }
        }

        // Process all players for nameplates - handle MainPlayer last so it gets top position
        const regularPlayers: any[] = [];
        
        // Separate regular players from MainPlayer
        if (this.settings.playerNameplates!.value) {
            for (const player of Players) {
                if (player._entityId !== MainPlayer._entityId) {
                    regularPlayers.push(player);
                }
                // Note: We don't add MainPlayer to any array here since we handle it separately
            }
        }
        
        // Process regular players first
        if (this.settings.playerNameplates!.value) {
            for (const player of regularPlayers) {
                const isFriend = playerFriends.includes(player._nameLowerCase);
                const currentColor = isFriend ? "lightgreen" : "white";

                if (!this.PlayerTextMeshes[player._entityId]) {
                    // Build nameplate text (just the name for players)
                    let nameplateText = player._name;

                    const textMesh = this.createTextMesh(nameplateText, currentColor, 20);
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
                        existingMesh.mesh.dispose();
                        const textMesh = this.createTextMesh(player._name, currentColor, 20);
                        textMesh.parent = player._appearance._haloNode; // Parent to halo node
                        this.PlayerTextMeshes[player._entityId] = {
                            mesh: textMesh,
                            isFriend: isFriend
                        };
                        this.log(`Updated player text mesh for ${player._name} (${player._entityId}) to color ${currentColor}`);
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
                    this.PlayerTextMeshes[key].mesh.dispose();
                    delete this.PlayerTextMeshes[key];
                }
            }
        }

        // Handle MainPlayer nameplate last so it gets the top position
        if (this.settings.youNameplate!.value && MainPlayer) {
            const mainPlayerEntityId = MainPlayer._entityId;
            
            if (!this.PlayerTextMeshes[mainPlayerEntityId]) {
                // Create nameplate for MainPlayer
                const textMesh = this.createTextMesh(MainPlayer._name, "cyan", 20); // Use cyan to distinguish from other players
                textMesh.parent = MainPlayer._appearance._haloNode; // Parent to halo node
                this.PlayerTextMeshes[mainPlayerEntityId] = {
                    mesh: textMesh,
                    isFriend: false // MainPlayer is not considered a friend for color purposes
                };
            }
            
            // Update position every frame - MainPlayer nameplate is always at the top
            this.PlayerTextMeshes[mainPlayerEntityId].mesh.position = this.calculatePlayerStackedPosition(MainPlayer, true);
        } else if (!this.settings.youNameplate!.value && MainPlayer) {
            // Remove MainPlayer nameplate if setting is disabled
            const mainPlayerEntityId = MainPlayer._entityId;
            if (this.PlayerTextMeshes[mainPlayerEntityId]) {
                this.PlayerTextMeshes[mainPlayerEntityId].mesh.dispose();
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
                    existingMesh.mesh.dispose();
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
                    const textMesh = this.createTextMesh(displayText, "orange", 18);
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
                        existingMesh.mesh.dispose();
                        
                        const textMesh = this.createTextMesh(displayText, "orange", 18);
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
            for (const key in this.GroundItemTextMeshes) {
                this.GroundItemTextMeshes[key].mesh.dispose();
                delete this.GroundItemTextMeshes[key];
            }
        }
    }


    createTextMesh(text: string, color: string = "white", fontSize: number = 24): Mesh {
        const scene = this.gameHooks.GameEngine.Instance.Scene;

        // Use higher resolution for better text quality
        const scaleFactor = 3; // Render at 3x resolution for crisp text
        const actualFontSize = fontSize * scaleFactor;

        // Create a dynamic texture for the text with better dimensions
        const textureWidth = Math.max(1024, text.length * actualFontSize * 0.8) * scaleFactor;
        const textureHeight = (actualFontSize * 2 + 80) * scaleFactor; // More height for better spacing
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
        context.font = `bold ${actualFontSize}px Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";

        // Split text into lines for multi-line support
        const lines = text.split('\n');
        const lineHeight = actualFontSize + (10 * scaleFactor); // Reduced spacing between lines
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
        dynamicTexture.update();        // Create material with transparency
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
        
        // Disable post-processing effects on this material
        material.disableColorWrite = false;
        material.disableDepthWrite = false;
        material.separateCullingPass = true;
        
        // Create plane mesh with optimized size (scaled back down for proper world size)
        const textWidth = (textureWidth / scaleFactor) / 60;
        const textHeight = (textureHeight / scaleFactor) / 60;
        const plane = PlaneBuilder.CreatePlane("textPlane", { width: textWidth, height: textHeight }, scene);
        plane.material = material;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.renderingGroupId = 2; // Use a moderate rendering group
        
        // Exclude from post-processing pipeline
        plane.isPickable = false;
        plane.doNotSyncBoundingInfo = true;

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
        
        // Use higher resolution for better text quality
        const scaleFactor = 3; // Render at 3x resolution for crisp text
        const actualFontSize = fontSize * scaleFactor;
        
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
        plane.renderingGroupId = 2; // Use a moderate rendering group
        
        // Exclude from post-processing pipeline
        plane.isPickable = false;
        plane.doNotSyncBoundingInfo = true;
        
        return plane;
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
     * Clear position tracker - called before each frame to reset stacking
     */
    private resetPositionTracker(): void {
        this.positionTracker.clear();
    }

    /**
     * Clean up all meshes to prevent memory leaks
     */
    private cleanupAllMeshes(): void {
        // Clean up NPC meshes
        for (const key in this.NPCTextMeshes) {
            if (this.NPCTextMeshes[key]) {
                this.NPCTextMeshes[key].mesh.dispose();
                delete this.NPCTextMeshes[key];
            }
        }

        // Clean up Player meshes
        for (const key in this.PlayerTextMeshes) {
            if (this.PlayerTextMeshes[key]) {
                this.PlayerTextMeshes[key].mesh.dispose();
                delete this.PlayerTextMeshes[key];
            }
        }

        // Clean up Ground Item meshes
        for (const key in this.GroundItemTextMeshes) {
            if (this.GroundItemTextMeshes[key]) {
                this.GroundItemTextMeshes[key].mesh.dispose();
                delete this.GroundItemTextMeshes[key];
            }
        }

        // Reset all collections
        this.NPCTextMeshes = {};
        this.PlayerTextMeshes = {};
        this.GroundItemTextMeshes = {};
    }
}
