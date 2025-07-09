import {
    UIManager,
    UIManagerScope,
} from '../../core/managers/highlite/uiManager';

export class IdleOverlay {
    overlay: HTMLElement = new UIManager().createElement(
        UIManagerScope.ClientRelative
    );

    constructor() {
        this.touchIdleOverlay();
        this.bindEvents();
    }

    private touchIdleOverlay() {
        this.overlay.classList.add('highlite-idle-overlay');
        this.overlay.hidden = true;

        // We force the overlay to be on top of everything
        this.overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        this.overlay.style.position = 'absolute';
        this.overlay.style.pointerEvents = 'none';
        this.overlay.style.zIndex = '99999999';
        this.overlay.style.width = '-webkit-fill-available';
        this.overlay.style.height = '-webkit-fill-available';
    }

    private bindEvents() {
        window.addEventListener('focus', this.onClientInteraction.bind(this));
        [
            'click',
            'keydown',
            /** Likely unwanted, at least not part of runelite as far as I'm aware */
            // 'mousemove',
            'touchstart',
            'pointerdown',
            'pointerup',
        ].forEach((eventType) => {
            /**
             * We use passive: true for faster scroll handling/performance boost
             * */
            window.addEventListener(
                eventType,
                this.onClientInteraction.bind(this),
                {
                    capture: true,
                    passive: true,
                }
            );
        });
    }

    onClientInteraction() {
        this.hide();
    }

    show() {
        this.overlay.hidden = false;
    }

    hide() {
        this.overlay.hidden = true;
    }
}
