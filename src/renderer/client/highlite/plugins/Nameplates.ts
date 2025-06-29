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
        this.settings.playerNameplateSize = { text: "Player Nameplate Text Size", type: SettingsTypes.range, value: 20, callback: () => this.regeneratePlayerNameplates() };
        this.settings.npcNameplateSize = { text: "NPC Nameplate Text Size", type: SettingsTypes.range, value: 20, callback: () => this.regenerateNPCNameplates() };
        this.settings.youNameplateSize = { text: "You Nameplate Text Size", type: SettingsTypes.range, value: 20, callback: () => this.regenerateMainPlayerNameplate() };
        this.settings.groundItemNameplateSize = { text: "Ground Item Nameplate Text Size", type: SettingsTypes.range, value: 20, callback: () => this.regenerateGroundItemNameplates() };
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

    private positionTracker: Map<string, number> = new Map();
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
        this.cleanupAllMeshes();
    }

    SocketManager_handleLoggedOut() {
        this.cleanupAllMeshes();
    }

    GameLoop_draw() {
        const NPCS = this.gameHooks.EntityManager.Instance._npcs; // Map
        const Players = this.gameHooks.EntityManager.Instance._players; // Array
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;
        const GroundItems = this.gameHooks.GroundItemManager.Instance.GroundItems; // Map
        const playerFriends = this.gameHooks.ChatManager.Instance._friends;

        if (!this.settings.enable.value) {
            this.cleanupAllMeshes();
            return;
        }

        this.resetPositionTracker();

        if (!NPCS || !Players || !MainPlayer || !GroundItems) {
            this.log("Missing required game entities, skipping nameplate rendering.");
            return;
        }

        this.cleanupStaleEntities(NPCS, Players, MainPlayer, GroundItems);

        this.processNPCs(NPCS, MainPlayer);
        this.processPlayers(Players, MainPlayer, playerFriends);
        this.processGroundItems(GroundItems);
    }

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
        
        const isMultiColor = options.nameText && options.levelText;
        
        let texture: DynamicTexture;
        let width: number;
        let height: number;
        let scaleFactor: number;
        
        if (isMultiColor) {
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
        
        const material = this.createTextMaterial(texture, scene);
        const plane = this.createTextPlane(material, width, height, scaleFactor, scene);

        return plane;
    }

    private createNPCNameplate(npc: any, mainPlayerLevel: number): Mesh {
        if (npc._combatLevel != 0) {
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
            return this.createNameplateMesh({
                text: npc._name,
                color: "yellow",
                fontSize: 20,
                nameplateType: 'npc'
            });
        }
    }

    private calculateFixedSizeScale(worldPosition: Vector3): number {
        if (!this.settings.fixedSizeNameplates?.value) {
            return 1.0;
        }

        const camera = this.gameHooks.GameCameraManager.Camera;
        if (!camera) {
            return 1.0;
        }

        const cameraPosition = camera.position;
        const distance = Vector3.Distance(cameraPosition, worldPosition);
        
        const baseDistance = 10.0;
        
        const scaleFactor = Math.max(0.1, distance / baseDistance);
        
        return scaleFactor;
    }

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
            if (existingMesh?.mesh) {
                existingMesh.mesh.dispose(false, true);
            }

            const textMesh = this.createMultiLineGroundItemNameplate(lines);
            const parentNode = this.getEntityParentNode(firstItem.item, 'grounditem');
            if (parentNode) {
                textMesh.parent = parentNode;
            }
            
            if (existingMesh) {
                existingMesh.mesh = textMesh;
                existingMesh.quantity = positionGroup.totalItems;
                existingMesh.itemName = `${positionGroup.items.size} types`;
            } else {
                this.GroundItemTextMeshes[representativeKey] = {
                    mesh: textMesh,
                    itemName: `${positionGroup.items.size} types`,
                    quantity: positionGroup.totalItems,
                    position: positionKey
                };
            }
        }
    }

    private getEntityWorldPosition(entity: any, entityType: 'player' | 'npc' | 'grounditem'): Vector3 | null {
        if (!entity || !entity._appearance) {
            return null;
        }

        if (entityType === 'grounditem') {
            return entity._appearance._billboardMesh?.getAbsolutePosition() || null;
        } else {
            return entity._appearance._haloNode?.getAbsolutePosition() || null;
        }
    }

    private getEntityParentNode(entity: any, entityType: 'player' | 'npc' | 'grounditem'): any | null {
        if (!entity || !entity._appearance) {
            return null;
        }

        if (entityType === 'grounditem') {
            return entity._appearance._billboardMesh || null;
        } else {
            return entity._appearance._haloNode || null;
        }
    }

    private calculateStackedPosition(
        entity: any, 
        entityType: 'player' | 'npc' | 'grounditem', 
        isMainPlayer: boolean = false
    ): Vector3 {
        const worldPos = this.getEntityWorldPosition(entity, entityType);
        if (!worldPos) {
            return new Vector3(0, 0.25, 0);
        }
        
        const roundedX = Math.round(worldPos.x * 2) / 2;
        const roundedZ = Math.round(worldPos.z * 2) / 2;
        const positionKey = `${entityType}_${roundedX}_${roundedZ}`;
        
        let stackIndex = 0;
        
        if (entityType === 'player' && isMainPlayer) {
            const totalPlayersAtPosition = this.positionTracker.get(positionKey) || 0;
            this.positionTracker.set(positionKey, totalPlayersAtPosition + 1);
            stackIndex = totalPlayersAtPosition;
        } else {
            const currentStack = this.positionTracker.get(positionKey) || 0;
            this.positionTracker.set(positionKey, currentStack + 1);
            stackIndex = currentStack;
        }
        
        let baseHeight: number;
        let stackSpacing: number;
        
        switch (entityType) {
            case 'grounditem':
                baseHeight = 0.5;
                stackSpacing = 0.3;
                break;
            case 'player':
                baseHeight = 0.25;
                stackSpacing = 0.4;
                break;
            case 'npc':
                baseHeight = 0.25;
                stackSpacing = 0.4;
                break;
            default:
                baseHeight = 0.25;
                stackSpacing = 0.4;
        }
        
        const yOffset = baseHeight + (stackIndex * stackSpacing);
        
        return new Vector3(0, yOffset, 0);
    }

    private applyFixedSizeScaling(mesh: Mesh, entity: any, entityType: 'player' | 'npc' | 'grounditem'): void {
        if (!this.settings.fixedSizeNameplates?.value) {
            return;
        }

        const worldPos = this.getEntityWorldPosition(entity, entityType);
        if (!worldPos) {
            return;
        }

        const scaleFactor = this.calculateFixedSizeScale(worldPos);
        mesh.scaling.setAll(scaleFactor);
    }

    private resetPositionTracker(): void {
        this.positionTracker.clear();
    }

    private disposeMeshFromCollection(collection: any, key: string | number): void {
        if (collection[key]?.mesh) {
            collection[key].mesh.dispose(false, true);
            delete collection[key];
        }
    }

    private cleanupAllMeshes(): void {
        this.cleanupMeshCollection(this.NPCTextMeshes);
        this.cleanupMeshCollection(this.PlayerTextMeshes);
        this.cleanupMeshCollection(this.GroundItemTextMeshes);

        this.NPCTextMeshes = {};
        this.PlayerTextMeshes = {};
        this.GroundItemTextMeshes = {};
    }

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
        const { entityKey, playerFriends = [], mainPlayerLevel = 0, forceRecreate = false        } = options;
        
        const storageKey = entityKey ?? entity._entityId;
        const collection = entityType === 'npc' ? this.NPCTextMeshes : this.PlayerTextMeshes;
        const existingMesh = collection[storageKey];

        let needsRecreation = !existingMesh || forceRecreate;
        
        if (entityType === 'player' && existingMesh && playerFriends.length > 0) {
            const isFriend = playerFriends.includes(entity._nameLowerCase);
            const playerMesh = existingMesh as { mesh: Mesh, isFriend: boolean };
            needsRecreation = needsRecreation || (playerMesh.isFriend !== isFriend);
        }

        if (needsRecreation) {
            if (existingMesh?.mesh) {
                existingMesh.mesh.dispose(false, true);
            }

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

            const parentNode = this.getEntityParentNode(entity, entityType === 'mainPlayer' ? 'player' : entityType);
            if (parentNode) {
                textMesh.parent = parentNode;
            }
            
            collection[storageKey] = {
                mesh: textMesh,
                ...additionalData
            };
        }
    }

    private regeneratePlayerNameplates(): void {
        const Players = this.gameHooks.EntityManager.Instance._players;
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;
        const playerFriends = this.gameHooks.ChatManager.Instance._friends;

        if (!Players || !MainPlayer) return;

        for (const player of Players) {
            if (player._entityId !== MainPlayer._entityId && this.PlayerTextMeshes[player._entityId]) {
                this.createOrUpdateNameplate(player, 'player', { playerFriends, forceRecreate: true });
            }
        }
    }

    private regenerateNPCNameplates(): void {
        const NPCS: Map<number, any> = this.gameHooks.EntityManager.Instance._npcs;
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;

        if (!NPCS || !MainPlayer) return;

        for (const [key, npc] of NPCS) {
            if (this.NPCTextMeshes[key]) {
                this.createOrUpdateNameplate(npc, 'npc', { entityKey: key, mainPlayerLevel: MainPlayer._combatLevel, forceRecreate: true });
            }
        }
    }

    private regenerateMainPlayerNameplate(): void {
        const MainPlayer = this.gameHooks.EntityManager.Instance.MainPlayer;

        if (!MainPlayer) return;

        const mainPlayerEntityId = MainPlayer._entityId;
        if (this.PlayerTextMeshes[mainPlayerEntityId]) {
            this.createOrUpdateNameplate(MainPlayer, 'mainPlayer', { forceRecreate: true });
        }
    }

    private regenerateGroundItemNameplates(): void {
        const GroundItems = this.gameHooks.GroundItemManager.Instance.GroundItems;

        if (!GroundItems) return;

        const currentGroundItems: { [key: string]: { itemName: string, quantity: number, position: string, parent: any, lines?: Array<{ text: string, color: string }> } } = {};
        
        for (const key in this.GroundItemTextMeshes) {
            const existingMesh = this.GroundItemTextMeshes[key];
            
            const lines: Array<{ text: string, color: string }> = [];
            const positionKey = existingMesh.position;
            
            for (const [, groundItem] of GroundItems) {
                const worldPos = this.getEntityWorldPosition(groundItem, 'grounditem');
                if (!worldPos) continue;
                
                const roundedX = Math.round(worldPos.x * 2) / 2;
                const roundedZ = Math.round(worldPos.z * 2) / 2;
                const itemPositionKey = `${roundedX}_${roundedZ}`;
                
                if (itemPositionKey === positionKey) {
                    const itemName = groundItem._def._nameCapitalized;
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
            existingMesh.mesh.dispose(false, true);
        }

        this.GroundItemTextMeshes = {};

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

    private regenerateAllNameplates(): void {
        this.regeneratePlayerNameplates();
        this.regenerateNPCNameplates();
        this.regenerateMainPlayerNameplate();
        this.regenerateGroundItemNameplates();
    }

    private cleanupMeshCollection<T extends { mesh: Mesh }>(collection: { [key: string]: T } | { [key: number]: T }): void {
        for (const key in collection) {
            if (collection[key]) {
                collection[key].mesh.dispose(false, true);
                delete collection[key];
            }
        }
    }

    private getFontSize(nameplateType: 'player' | 'npc' | 'mainPlayer' | 'groundItem', defaultSize: number = 20): number {
        const sizeKey = nameplateType === 'mainPlayer' ? 'youNameplateSize' : `${nameplateType}NameplateSize`;
        return this.settings[sizeKey]?.value as number || defaultSize;
    }

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

    private createDynamicTexture(options: {
        lines: Array<{ text: string, color: string }>;
        fontSize: number;
        scene: any;
    }): { texture: DynamicTexture, width: number, height: number, scaleFactor: number } {
        const scaleFactor = 3;
        const scaledFontSize = options.fontSize * scaleFactor;
        
        const maxLineLength = Math.max(...options.lines.map(line => line.text.length));
        const textureWidth = Math.max(1024, maxLineLength * scaledFontSize * 0.8) * scaleFactor;
        const lineHeight = scaledFontSize + (10 * scaleFactor);
        const textureHeight = (options.lines.length * lineHeight + 80) * scaleFactor;
        
        const dynamicTexture = new DynamicTexture("textTexture", { width: textureWidth, height: textureHeight }, options.scene, false, DynamicTexture.TRILINEAR_SAMPLINGMODE);
        dynamicTexture.hasAlpha = true;
        
        const context = dynamicTexture.getContext() as CanvasRenderingContext2D;
        
        context.save();
        context.clearRect(0, 0, textureWidth, textureHeight);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.font = `bold ${scaledFontSize}px Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        
        context.strokeStyle = "rgba(0, 0, 0, 0.9)";
        context.lineWidth = 4 * scaleFactor;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.miterLimit = 2;
        
        const totalTextHeight = options.lines.length * lineHeight;
        const startY = (textureHeight - totalTextHeight) / 2 + lineHeight / 2;
        const x = textureWidth / 2;
        
        options.lines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            
            context.strokeText(line.text, x, y);
            
            context.globalCompositeOperation = "source-over";
            context.fillStyle = line.color;
            context.fillText(line.text, x, y);
        });
        
        context.restore();
        dynamicTexture.update();
        
        return { texture: dynamicTexture, width: textureWidth, height: textureHeight, scaleFactor };
    }

    private createTextMaterial(texture: DynamicTexture, scene: any): StandardMaterial {
        const material = new StandardMaterial("textMaterial", scene);
        
        material.diffuseTexture = texture;
        material.emissiveTexture = texture;
        material.useAlphaFromDiffuseTexture = true;
        material.alphaMode = Engine.ALPHA_COMBINE;
        
        material.disableLighting = true;
        material.backFaceCulling = false;
        material.disableDepthWrite = true;
        
        return material;
    }

    private createTextPlane(material: StandardMaterial, textureWidth: number, textureHeight: number, scaleFactor: number, scene: any): Mesh {
        const textWidth = (textureWidth / scaleFactor) / 60;
        const textHeight = (textureHeight / scaleFactor) / 60;
        const plane = PlaneBuilder.CreatePlane("textPlane", { width: textWidth, height: textHeight, updatable: false }, scene);

        plane.material = material;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.isPickable = false;
        plane.doNotSyncBoundingInfo = true;
        
        if (!this.settings.fixedSizeNameplates?.value) {
            plane.freezeWorldMatrix();
        }
        
        plane.renderingGroupId = 3;
        plane.alwaysSelectAsActiveMesh = true;
        
        plane.computeWorldMatrix(true);
        plane.refreshBoundingInfo();
        return plane;
    }

    private createMultiLineGroundItemNameplate(lines: Array<{ text: string, color: string }>): Mesh {
        const scene = this.gameHooks.GameEngine.Instance.Scene;
        const actualFontSize = this.getFontSize('groundItem', 18);
        
        const result = this.createDynamicTexture({
            lines: lines,
            fontSize: actualFontSize,
            scene
        });
        
        const material = this.createTextMaterial(result.texture, scene);
        const plane = this.createTextPlane(material, result.width, result.height, result.scaleFactor, scene);

        return plane;
    }

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

        if (this.settings.youNameplate!.value && MainPlayer) {
            this.createOrUpdateNameplate(MainPlayer, 'mainPlayer');
            this.PlayerTextMeshes[MainPlayer._entityId].mesh.position = this.calculateStackedPosition(MainPlayer, 'player', true);
            this.applyFixedSizeScaling(this.PlayerTextMeshes[MainPlayer._entityId].mesh, MainPlayer, 'player');
        } else if (!this.settings.youNameplate!.value && MainPlayer && this.PlayerTextMeshes[MainPlayer._entityId]) {
            this.disposeMeshFromCollection(this.PlayerTextMeshes, MainPlayer._entityId);
        }
    }

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

    private cleanupUnusedGroundItemMeshes(positionGroups: Map<string, any>): void {
        const activePositionKeys = new Set(positionGroups.keys());
        for (const key in this.GroundItemTextMeshes) {
            if (!activePositionKeys.has(this.GroundItemTextMeshes[key].position)) {
                this.disposeMeshFromCollection(this.GroundItemTextMeshes, key);
            }
        }
    }

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
