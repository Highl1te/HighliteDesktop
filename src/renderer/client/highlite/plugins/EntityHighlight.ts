import { Vector3 } from "@babylonjs/core/Maths/math";
import {Plugin} from "../core/interfaces/highlite/plugin/plugin.class";
import {SettingsTypes} from "../core/interfaces/highlite/plugin/pluginSettings.interface";
import {UIManager, UIManagerScope} from "../core/managers/highlite/uiManager";

export class EntityHighlight extends Plugin {
    pluginName = "EntityHighlight Plugin";
    author = "Tomb";
    DOMElement: HTMLDivElement | null = null;

    private uiManager: UIManager;

    constructor() {
        super();

        this.uiManager = new UIManager();

        this.settings.bankHighlight = { text: "Bank Highlight", type: SettingsTypes.checkbox, value: true, callback: () => {} };
        this.settings.bankDebug = { text: "Bank Debug", type: SettingsTypes.checkbox, value: true, callback: () => this.findAllBanks() };
    };

    BankEntityDOMElements: {
        [key: string]: { element: HTMLDivElement, position: Vector3 }
    } = {}

    private positionTracker: Map<string, number> = new Map();

    init(): void {
        this.log("Initializing");
    }

    start(): void {
        this.log("Started EntityHighlight Plugin");
    }

    stop(): void {
        this.log("Stopped EntityHighlight Plugin");
    }

    SocketManager_loggedIn(): void {
        if (this.settings.enable.value) {
            this.setupAllElements();
        }
        this.log(this.BankEntityDOMElements);
    }

    SocketManager_handleLoggedOut(): void {
        this.cleanupAllElements();
    }

    GameLoop_draw(): void {
        const WorldEntities = this.gameHooks.WorldEntityManager.Instance.WorldEntities;

        this.resetPositionTracker();

        this.processWorldEntities(WorldEntities);
    }

    private resetPositionTracker(): void {
        this.positionTracker.clear();
    }

    private processWorldEntities(WorldEntities: any[]): void {
        for(const entity of WorldEntities) {
            if(entity[1]._name === "Bank Chest") {
                if (!this.BankEntityDOMElements[entity[1]._entityTypeId]) {
                    this.createEntityElement(entity[1]._entityTypeId, entity[1]);
                }
                const bankID = entity[1]._entityTypeId;
                const element = this.BankEntityDOMElements[bankID].element;
                element.style.color = "white";

                this.applyEntityColors(element);

                const worldPos = this.getEntityWorldPosition(entity[1]);
                if(worldPos) {
                    this.BankEntityDOMElements[entity[1]._entityTypeId].position = worldPos;

                    const positionKey = this.getPositionKey(worldPos);
                    const currentCount = this.positionTracker.get(positionKey) || 0;
                    this.positionTracker.set(positionKey, currentCount + 1);
                }

                const entityMesh = entity[1]._appearance._bjsMeshes[0];
                try {
                    this.updateElementPosition(entityMesh, this.BankEntityDOMElements[entity[1]._entityTypeId]);
                } catch (e) {
                    this.log("Error updating entity element position: ", e);
                }
            }
        }
    }

    private updateElementPosition(entityMesh: any, domElement: any): void {
        const translationCoordinates = Vector3.Project(
            Vector3.ZeroReadOnly,
            entityMesh.getWorldMatrix(),
            this.gameHooks.GameEngine.Instance.Scene.getTransformMatrix(),
            this.gameHooks.GameCameraManager.Camera.viewport.toGlobal(
                this.gameHooks.GameEngine.Instance.Engine.getRenderWidth(1),
                this.gameHooks.GameEngine.Instance.Engine.getRenderHeight(1)
            )
        );

        const camera = this.gameHooks.GameCameraManager.Camera;
        const isInFrustrum = camera.isInFrustum(entityMesh);

        //Apply frustum culling first - if not in frustum, hide regardless of stack limits
        if (!isInFrustrum) {
            domElement.element.style.visibility = "hidden";
            return;
        } else {
            // Handle visibility based on stack limits (only if in frustum)
            domElement.element.style.visibility = "visible";
        }

        domElement.element.style.transform = `translate3d(calc(${this.pxToRem(translationCoordinates.x)}rem - 50%), calc(${this.pxToRem(translationCoordinates.y - 30 - 0)}rem - 50%), 0px)`;
    }

    private pxToRem(px: number): number {
        return px / 16;
    }

    private getPositionKey(worldPosition: Vector3): string {
        // Round to consistent grid for stacking with 1 unit tolerance
        // This prevents minor position changes from causing restacking
        const roundedX = Math.round(worldPosition.x);
        const roundedZ = Math.round(worldPosition.z);
        return `${roundedX}_${roundedZ}`;
    }

    private getEntityWorldPosition(entity: any): Vector3 | null {
        if (!entity || !entity._appearance) {
            return null;
        }

        return entity._appearance._bjsMeshes[0].absolutePosition
    }

    private applyEntityColors(element: HTMLDivElement): void {
        element.style.background = "rgba(255, 255, 255, 0.1)";
        element.style.borderRadius = "4px";
        element.style.padding = "2px 6px";
        element.style.border = "1px solid rgba(255, 255, 255, 0.3)";
        element.style.textShadow = "1px 1px 2px rgba(0, 0, 0, 0.8)";
        element.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.3)";
        return;
    }

    private createEntityElement(entityId: number, entity: any): void {
        const element = document.createElement('div');
        element.id = `entity-highlight-${entityId}`;
        element.style.position = "absolute";
        element.style.pointerEvents = "none";
        element.style.zIndex = "1000";
        element.style.color = "white";
        element.style.fontSize = "12px";
        element.innerHTML = entity._name;
        element.style.background = "rgba(255, 255, 255, 0.1)";
        element.style.borderRadius = "4px";
        element.style.padding = "2px 6px";
        element.style.border = "1px solid rgba(255, 255, 255, 0.3)";
        element.style.textShadow = "1px 1px 2px rgba(0, 0, 0, 0.8)";
        element.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.3)";

        this.BankEntityDOMElements[entityId] = {
            element: element,
            position: Vector3.ZeroReadOnly
        };

        document.getElementById('entity-highlight-entity')?.appendChild(element);
    }


    private findAllBanks(): void {
        const entities = this.gameHooks.WorldEntityManager.Instance.WorldEntities;
        for (const entity of entities) {
            if(entity[1]._name == "Bank Chest") {
                this.log(entity[1]);
            }
        }
    }

    private cleanupElementCollection(collection: any): void {
        for (const key in collection) {
            if (collection[key]) {
                collection[key].element.remove();
                delete collection[key];
            }
        }
    }

    private injectCSSVariables(): void {
        if (!this.DOMElement) return;

        try {
            const screenMask = document.getElementById('hs-screen-mask');
            this.log(screenMask);
            if (!screenMask) return;

            const computedStyle = getComputedStyle(screenMask);
            const cssVariables = [
                '--hs-color-cmbt-lvl-diff-pos-10',
                '--hs-color-cmbt-lvl-diff-pos-9',
                '--hs-color-cmbt-lvl-diff-pos-8',
                '--hs-color-cmbt-lvl-diff-pos-7',
                '--hs-color-cmbt-lvl-diff-pos-6',
                '--hs-color-cmbt-lvl-diff-pos-5',
                '--hs-color-cmbt-lvl-diff-pos-4',
                '--hs-color-cmbt-lvl-diff-pos-3',
                '--hs-color-cmbt-lvl-diff-pos-2',
                '--hs-color-cmbt-lvl-diff-pos-1',
                '--hs-color-cmbt-lvl-diff-pos-0',
                '--hs-color-cmbt-lvl-diff-neg-1',
                '--hs-color-cmbt-lvl-diff-neg-2',
                '--hs-color-cmbt-lvl-diff-neg-3',
                '--hs-color-cmbt-lvl-diff-neg-4',
                '--hs-color-cmbt-lvl-diff-neg-5',
                '--hs-color-cmbt-lvl-diff-neg-6',
                '--hs-color-cmbt-lvl-diff-neg-7',
                '--hs-color-cmbt-lvl-diff-neg-8',
                '--hs-color-cmbt-lvl-diff-neg-9',
                '--hs-color-cmbt-lvl-diff-neg-10'
            ];

            let styleString = '';
            cssVariables.forEach(variable => {
                const value = computedStyle.getPropertyValue(variable);
                if (value) {
                    styleString += `${variable}: ${value}; `;
                }
            });

            if (styleString) {
                this.DOMElement.style.cssText += styleString;
            }
        } catch (error) {
            this.error("Error injecting CSS variables:", error);
        }
    }

    private cleanupAllElements(): void {
        this.log("EntityHightlight - Cleaning all elements");
        this.cleanupElementCollection(this.BankEntityDOMElements);

        this.BankEntityDOMElements = {};

        if (this.DOMElement) {
            this.DOMElement.remove();
            this.DOMElement = null;
        }
    }

    private setupAllElements(): void {
        this.log("EntityHightlight - Starting setup");
        this.cleanupAllElements();

        // Use UIManager to create the container with ClientRelative scope
        this.DOMElement = this.uiManager.createElement(UIManagerScope.ClientRelative) as HTMLDivElement;
        if (this.DOMElement) {
            this.DOMElement.id = "entity-highlight-entity";
            this.DOMElement.style.position = "absolute";
            this.DOMElement.style.pointerEvents = "none";
            this.DOMElement.style.zIndex = "1";
            this.DOMElement.style.overflow = "hidden";
            this.DOMElement.style.width = "100%";
            this.DOMElement.style.height = "calc(100% - var(--titlebar-height))"; // Account for titlebar height
            this.DOMElement.style.top = "var(--titlebar-height)"; // Position below titlebar
            this.DOMElement.style.fontFamily = "Inter";
            this.DOMElement.style.fontSize = "12px";
            this.DOMElement.style.fontWeight = "bold";

            // Inject CSS variables from screen mask to ensure proper styling
            this.injectCSSVariables();
        }
    }
}