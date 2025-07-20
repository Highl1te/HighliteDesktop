import {Vector3} from '@babylonjs/core/Maths/math';
import {Plugin} from '../core/interfaces/highlite/plugin/plugin.class';
import {SettingsTypes} from '../core/interfaces/highlite/plugin/pluginSettings.interface';
import {UIManager, UIManagerScope} from '../core/managers/highlite/uiManager';

export class EntityHighlight extends Plugin {
    pluginName = 'EntityHighlight Plugin';
    author = 'Tomb';
    DOMElement: HTMLDivElement | null = null;

    private uiManager: UIManager;

    constructor() {
        super();

        this.uiManager = new UIManager();

        this.settings.highlightOffset = {
            text: 'Highlight Offset',
            type: SettingsTypes.range,
            value: -30,
            callback: () => {},
        };
        this.settings.highlightBackground = {
            text: 'Highlight Background',
            type: SettingsTypes.color,
            value: '#ff0000',
            callback: () => this.updateEntityThemes(),
        };
        this.settings.highlightBackgroundAlpha = {
            text: 'Highlight Alpha',
            type: SettingsTypes.range,
            value: 1,
            min: 1,
            max: 10,
            callback: () => {},
        };
        this.settings.entityPriorities = {
            text: 'Entities to highlight',
            type: SettingsTypes.text,
            value: 'Tree,Bank Chest',
            callback: () => this.updateEntityPriorities(),
        };
    }

    EntityDOMElements: {
        [key: string]: {
            element: HTMLDivElement;
            position: Vector3;
            name: string;
        };
    } = {};

    private positionTracker: Map<string, number> = new Map();
    private entitiesToHighlight: string[] = [];
    private showAllEntities: boolean = false;

    init(): void {
        this.log('Initializing');
        this.setupKeyboardListeners();
    }

    start(): void {
        this.log('Started EntityHighlight Plugin');
        this.setupAllElements();
    }

    stop(): void {
        this.log('Stopped EntityHighlight Plugin');
        this.cleanupAllElements();
    }

    SocketManager_loggedIn(): void {
        if (this.settings.enable.value) {
            this.updateEntityPriorities();
            this.setupAllElements();
        }
    }

    SocketManager_handleLoggedOut(): void {
        this.cleanupAllElements();
    }

    GameLoop_draw(): void {
        const WorldEntities =
            this.gameHooks.WorldEntityManager.Instance.WorldEntities;

        this.resetPositionTracker();

        this.cleanStaleWorldEntities(WorldEntities);
        this.processWorldEntities(WorldEntities);
    }


    private setupKeyboardListeners(): void {
        this.log("Setting up keyboard listeners");
        document.addEventListener('keydown', e=> {
            if (e.key === 'Alt') {
                this.showAllEntities = true;
                this.updatePriorityButtonsVisibility();
                //this.disableScreenMaskPointerEvents();
            }
        });
        document.addEventListener('keyup', e=> {
            if (e.key === 'Alt') {
                this.showAllEntities = false;
                this.updateEntityPriorities();
            }
        });
        window.addEventListener('blur', () => {
            if (this.showAllEntities) {
                this.showAllEntities = false;
                this.updateEntityPriorities();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.showAllEntities) {
                this.resetAltState();
            }
        });
    }

    private updatePriorityButtonsVisibility(): void {
        const buttons = document.querySelectorAll('.priority-button');
        buttons.forEach(button => {
            if (this.showAllEntities) {
                (button as HTMLElement).style.display = 'inline-block';
            } else {
                (button as HTMLElement).style.display = 'none';
            }
        });
    }

    private cleanStaleWorldEntities(WorldEntities: any): void {
        for (const key in this.EntityDOMElements) {
            if (!WorldEntities.has(parseInt(key))) {
                this.disposeElementFromCollection(this.EntityDOMElements, key);
            }
        }
    }

    private updateEntityPriorities(): void {
        const prioritiesStr = this.settings.entityPriorities!.value as string;
        this.entitiesToHighlight = prioritiesStr
            .split(',')
            .map(entry => entry.trim())
            .filter(entry => entry.length > 0);
        this.setupAllElements();
    }

    private disposeElementFromCollection(
        collection: any,
        key: string | number
    ): void {
        if (collection[key]?.element) {
            collection[key].element.remove();
            delete collection[key];
        }
    }

    private resetPositionTracker(): void {
        this.positionTracker.clear();
    }

    private processWorldEntities(WorldEntities: any[]): void {
            for (const entity of WorldEntities) {
                try {
                let entityName = entity[1]._name;
                if(entityName.length <= 1) continue;
                if (this.entitiesToHighlight.includes(entity[1]._name) || this.showAllEntities) {
                    if (!this.EntityDOMElements[entity[1]._entityTypeId]) {
                        this.createEntityElement(
                            entity[1]._entityTypeId,
                            entity[1]
                        );
                    }
                    const entityTypeId = entity[1]._entityTypeId;
                    const element = this.EntityDOMElements[entityTypeId].element;
                    element.style.color = 'white';

                    this.applyEntityColors(element);

                    const worldPos = this.getEntityWorldPosition(entity[1]);
                    if (worldPos) {
                        this.EntityDOMElements[entity[1]._entityTypeId].position =
                            worldPos;

                        const positionKey = this.getPositionKey(worldPos);
                        const currentCount =
                            this.positionTracker.get(positionKey) || 0;
                        this.positionTracker.set(positionKey, currentCount + 1);
                    }

                    const entityMesh = entity[1]._appearance._bjsMeshes[0];
                    try {
                        this.updateElementPosition(
                            entityMesh,
                            this.EntityDOMElements[entity[1]._entityTypeId]
                        );
                    } catch (e) {
                        this.log('Error updating entity element position: ', e);
                    }
                }
            } catch (e) {
                this.log("Error with entity: ", entity[0], entity[1]);
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
            domElement.element.style.visibility = 'hidden';
            return;
        } else {
            // Handle visibility based on stack limits (only if in frustum)
            domElement.element.style.visibility = 'visible';
        }
        const offset: number = this.settings.highlightOffset?.value as number;
        domElement.element.style.transform = `translate3d(calc(${this.pxToRem(translationCoordinates.x)}rem - 50%), calc(${this.pxToRem(translationCoordinates.y - 30 - offset)}rem - 50%), 0px)`;
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

        return entity._appearance._bjsMeshes[0].absolutePosition;
    }

    private hexToRGB(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);

        if (alpha) {
            return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
        } else {
            return 'rgb(' + r + ', ' + g + ', ' + b + ')';
        }
    }

    private getHighlightBackground(): string {
        const alpha =
            (this.settings.highlightBackgroundAlpha.value as number) * 0.1;
        return this.hexToRGB(this.settings.highlightBackground.value, alpha);
    }

    private updateEntityThemes(): void {
        for (const key in this.EntityDOMElements) {
            let element = this.EntityDOMElements[key].element;
            element.style.background = this.getHighlightBackground();
            element.style.borderRadius = '4px';
            element.style.padding = '2px 6px';
            element.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            element.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
            element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        }
    }

    private applyEntityColors(element: HTMLDivElement): void {
        element.style.background = this.getHighlightBackground();
        element.style.borderRadius = '4px';
        element.style.padding = '2px 6px';
        element.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        element.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
        element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        return;
    }

    private createEntityElement(entityId: number, entity: any): void {

        if(entity._name.length <= 1) return;

        const element = document.createElement('div');
        element.id = `entity-highlight-${entityId}`;
        element.style.position = 'absolute';
        element.style.pointerEvents = 'none';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.zIndex = '1000';
        element.style.color = 'white';
        element.style.fontSize = '12px';
        element.innerHTML = entity._name;
        element.style.background = this.settings.highlightBackground
            .value as string;
        element.style.borderRadius = '4px';
        element.style.gap = '4px';
        element.style.padding = '2px 20px';
        element.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        element.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
        element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';

        const priorityBtn = document.createElement('button');
        priorityBtn.className = 'priority-button';
        priorityBtn.style.display = this.showAllEntities
            ? 'inline-block'
            : 'none';
        let highlightedEntity = this.entitiesToHighlight.includes(entity._name)
        if(highlightedEntity) {
            priorityBtn.innerText = '-';
            priorityBtn.style.background = 'red';
        } else {
            priorityBtn.innerText = '+';
            priorityBtn.style.background = 'green';
        }
        priorityBtn.style.color = 'white';
        priorityBtn.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        priorityBtn.style.borderRadius = '2px';
        priorityBtn.style.padding = '1px 4px';
        priorityBtn.style.fontSize = '10px';
        priorityBtn.style.cursor = 'pointer';
        priorityBtn.style.fontWeight = 'bold';
        priorityBtn.style.pointerEvents = 'auto';
        priorityBtn.style.zIndex = '1001';
        priorityBtn.style.userSelect = 'none';

        this.uiManager.bindOnClickBlockHsMask(priorityBtn, () => {
            this.toggleEntityHighlight(entity._name);
        });

        element.appendChild(priorityBtn);

        this.EntityDOMElements[entityId] = {
            element: element,
            position: Vector3.ZeroReadOnly,
            name: entity._name,
        };

        document
            .getElementById('entity-highlight-entity')
            ?.appendChild(element);
    }

    private toggleEntityHighlight(entityName: string): void {
        if(this.entitiesToHighlight.indexOf(entityName) === -1) {
            this.settings.entityPriorities.value += "," + entityName;
            this.entitiesToHighlight.push(entityName);
        } else {
            let newPriorityList = this.entitiesToHighlight.filter(entity => entity !== entityName);
            this.settings.entityPriorities.value = newPriorityList.join(',');
        }
        this.updateEntityPriorities();
    }

    private cleanupElementCollection(collection: any): void {
        for (const key in collection) {
            if (collection[key]) {
                collection[key].element.remove();
                delete collection[key];
            }
        }
    }

    private cleanupAllElements(): void {
        this.log('EntityHightlight - Cleaning all elements');
        this.cleanupElementCollection(this.EntityDOMElements);

        this.EntityDOMElements = {};

        if (this.DOMElement) {
            this.DOMElement.remove();
            this.DOMElement = null;
        }
    }

    private setupAllElements(): void {
        this.log('EntityHightlight - Starting setup');
        this.cleanupAllElements();

        // Use UIManager to create the container with ClientRelative scope
        this.DOMElement = this.uiManager.createElement(
            UIManagerScope.ClientRelative
        ) as HTMLDivElement;
        if (this.DOMElement) {
            this.DOMElement.id = 'entity-highlight-entity';
            this.DOMElement.style.position = 'absolute';
            this.DOMElement.style.pointerEvents = 'none';
            this.DOMElement.style.zIndex = '1';
            this.DOMElement.style.overflow = 'hidden';
            this.DOMElement.style.width = '100%';
            this.DOMElement.style.height =
                'calc(100% - var(--titlebar-height))'; // Account for titlebar height
            this.DOMElement.style.top = 'var(--titlebar-height)'; // Position below titlebar
            this.DOMElement.style.fontFamily = 'Inter';
            this.DOMElement.style.fontSize = '12px';
            this.DOMElement.style.fontWeight = 'bold';
        }
    }
}
