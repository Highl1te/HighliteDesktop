import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';
import placeholderPng from '@static/icons/placeholder.png';
import northArrowPng from '@static/icons/north-arrow.png';

export class MinimapMarker extends Plugin {
    private readonly MIN_ARROW_HIDE_DISTANCE = 10;
    private readonly MARKER_OFFSET = 8;

    pluginName = 'Minimap Marker';
    author = 'JayArrowz';
    minimapContainer: HTMLDivElement | null = null;
    minimapMarkerEl: HTMLImageElement | null = null;
    minimapArrowEl: HTMLImageElement | null = null;
    destinationPosition: { X: number; Z: number; lvl: number } | null = null;

    constructor() {
        super();
        this.settings.enable = {
            text: 'Enable',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => this.toggleVisibility(),
        };
        this.settings.destinationX = {
            text: 'Destination X Coordinate',
            type: SettingsTypes.range,
            value: 0,
            callback: () => this.updateDestinationFromSettings(),
        };
        this.settings.destinationZ = {
            text: 'Destination Z Coordinate',
            type: SettingsTypes.range,
            value: 0,
            callback: () => this.updateDestinationFromSettings(),
        };
        this.settings.destinationLevel = {
            text: 'Destination Level',
            type: SettingsTypes.range,
            value: 1,
            callback: () => this.updateDestinationFromSettings(),
        };
        this.settings.hideArrowWhenClose = {
            text: 'Hide Arrow When Close',
            type: SettingsTypes.checkbox,
            value: true,
            callback: () => {},
        };
    }

    init(): void {
        this.log('Initializing Minimap Marker');
    }

    start(): void {
        this.log('Started Minimap Marker');
        this.setMinimapContainer();

        if (this.settings.enable.value) {
            this.updateDestinationFromSettings();
        } else {
            this.hideElements();
        }
    }

    private updateDestinationFromSettings(): void {
        if (
            this.settings.destinationX.value ||
            this.settings.destinationZ.value
        ) {
            this.setDestination(
                this.settings.destinationX.value as number,
                this.settings.destinationZ.value as number,
                this.settings.destinationLevel.value as number
            );
        }
    }

    private toggleVisibility(): void {
        if (this.settings.enable.value) {
            this.showElements();
            this.updateDestinationFromSettings();
        } else {
            this.hideElements();
        }
    }

    private hideElements(): void {
        if (this.minimapMarkerEl) {
            this.minimapMarkerEl.style.visibility = 'hidden';
        }
        if (this.minimapArrowEl) {
            this.minimapArrowEl.style.visibility = 'hidden';
        }
    }

    private showElements(): void {
        if (this.minimapMarkerEl) {
            this.minimapMarkerEl.style.visibility = 'visible';
        }
    }

    private refreshMarkerAndArrow() {
        const mm =
            document.highlite?.gameHooks?.HR?.Manager?.getController()
                ?.MinimapQuadrantController?.MinimapController?._minimap;
        if (!mm || !this.minimapMarkerEl || !this.minimapArrowEl) return;

        const off = { X: 0, Y: 0 };
        const x = this.destinationPosition!.X + 0.5;
        const z = this.destinationPosition!.Z + 0.5;
        mm._calculatePosition(
            (x - mm._currentMiniMapCenter.X) * mm._mapZoomFactor,
            (mm._currentMiniMapCenter.Y - z) * mm._mapZoomFactor,
            0,
            0,
            off
        );

        const left = mm._minimapHalfWidthPx + off.X - this.MARKER_OFFSET;
        const top = mm._minimapHalfHeightPx + off.Y - this.MARKER_OFFSET;
        this.minimapMarkerEl.style.left = `${left}px`;
        this.minimapMarkerEl.style.top = `${top}px`;
        this.minimapMarkerEl.style.visibility = 'visible';

        this.minimapArrowEl.style.left = `${mm._minimapHalfWidthPx}px`;
        this.minimapArrowEl.style.top = `${mm._minimapHalfHeightPx}px`;

        const angle = (Math.atan2(+off.Y, off.X) * 180) / Math.PI + 90;
        this.minimapArrowEl.style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;
    }

    GameLoop_draw() {
        if (!this.settings.enable.value || !this.destinationPosition) return;
        this.refreshMarkerAndArrow();
    }

    GameLoop_update() {
        if (
            !this.settings.enable.value ||
            !this.destinationPosition ||
            !this.minimapArrowEl
        )
            return;
        const p =
            this.gameHooks.EntityManager.Instance.MainPlayer
                .CurrentGamePosition;
        const dist = Math.hypot(
            this.destinationPosition.X - p.X,
            this.destinationPosition.Z - p.Z
        );

        this.minimapArrowEl.style.visibility =
            this.settings.hideArrowWhenClose.value &&
            dist < this.MIN_ARROW_HIDE_DISTANCE
                ? 'hidden'
                : 'visible';
    }

    gameCameraRotated() {
        if (!this.settings.enable.value || !this.destinationPosition) return;
        this.refreshMarkerAndArrow();
    }

    private setDestination(worldX: number, worldZ: number, lvl: number) {
        this.destinationPosition = { X: worldX, Z: worldZ, lvl };

        if (this.minimapMarkerEl) {
            this.minimapMarkerEl.style.visibility = 'visible';
        }
    }

    private createOrEnsureMinimapMarker() {
        if (!this.minimapContainer) return;
        if (this.minimapMarkerEl) return;

        const img = document.createElement('img');
        img.src = placeholderPng;
        img.style.position = 'absolute';
        img.style.width = '1rem';
        img.style.height = '1rem';
        img.style.pointerEvents = 'none';
        img.style.transform = 'translate(-50%, -50%)';
        img.style.visibility = 'visible';
        img.style.zIndex = '1002';
        this.minimapContainer.appendChild(img);
        this.minimapMarkerEl = img;
    }

    private createMinimapArrow() {
        if (!this.minimapContainer) return;

        const img = document.createElement('img');
        img.src = northArrowPng;
        img.style.position = 'absolute';
        img.style.width = '1.2rem';
        img.style.height = '1.2rem';
        img.style.transform = 'translate(-50%, -50%)';
        img.style.transformOrigin = '50% 50%';
        img.style.pointerEvents = 'none';
        img.style.zIndex = '1001';
        this.minimapContainer.appendChild(img);
        this.minimapArrowEl = img;
        this.minimapArrowEl.style.visibility = 'hidden';
    }

    private setMinimapContainer() {
        this.minimapContainer = document.getElementById(
            'hs-minimap-container'
        ) as HTMLDivElement | null;
        if (this.minimapContainer) {
            this.createMinimapArrow();
            this.createOrEnsureMinimapMarker();
        }
    }

    stop(): void {
        this.log('Stopped Minimap Marker');
        if (this.minimapMarkerEl && this.minimapMarkerEl.parentElement) {
            this.minimapMarkerEl.parentElement.removeChild(
                this.minimapMarkerEl
            );
            this.minimapMarkerEl = null;
        }
        if (this.minimapArrowEl && this.minimapArrowEl.parentElement) {
            this.minimapArrowEl.parentElement.removeChild(this.minimapArrowEl);
            this.minimapArrowEl = null;
        }
    }

    SocketManager_loggedIn() {
        this.setMinimapContainer();
    }
}
