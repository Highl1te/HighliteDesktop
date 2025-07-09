import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';

const TreasureMapItemIds = [442, 443, 456];

export class TreasureMapHelper extends Plugin {
    pluginName = 'Treasure Map Helper';
    author = 'Oatelaus';

    constructor() {
        super();
    }

    start(): void {}

    stop(): void {}

    init(): void {
        this.injectPluginStyles();
    }

    async SocketManager_handleInvokedInventoryItemActionPacket([
        action,
        _2,
        _3,
        itemType,
        _4,
        _5,
        success,
        data,
    ]: [unknown, unknown, unknown, number, unknown, unknown, number, any[]]) {
        if (!this.settings.enable.value) {
            return;
        }

        if (!TreasureMapItemIds.includes(itemType) || !success || action !== 19)
            return;

        const [_, x, y, level] = data;

        const mapLevel = level === 1 ? 'Overworld' : 'Underworld';

        const offsetX = x + 512;
        const offsetY = y + 512;

        const link = `https://highlite.fanet.dev/map?hide_decor=true&highliteMapPlugin=true&pos_x=${offsetX}&pos_y=${offsetY}&lvl=${mapLevel}`;

        const targetElement =
            '.hs-treasure-map-menu__treasure-map-images-container';

        const treasureMapContainer =
            await this.waitForElementToExist(targetElement);

        const playerMapLevel =
            this.gameHooks.EntityManager.Instance.MainPlayer.CurrentMapLevel;
        const playerMapPos =
            this.gameHooks.EntityManager.Instance.MainPlayer
                .CurrentGamePosition;

        const isAtSpot =
            playerMapPos.X === x &&
            playerMapPos.Z === y &&
            playerMapLevel === level;

        const container = document.createElement('div');
        container.classList.add('hs-menu');
        container.classList.add('hs-treasure-map-helper-button');

        const linkElement = document.createElement('a');
        linkElement.classList.add('hs-treasure-map-helper-link');
        linkElement.classList.add(
            `hs-treasure-map-helper-link-${isAtSpot ? 'green' : 'yellow'}`
        );
        linkElement.href = link;
        linkElement.target = '_blank';

        container.appendChild(linkElement);

        const text = document.createElement('span');
        text.textContent = 'View on Wiki';
        linkElement.appendChild(text);

        treasureMapContainer.appendChild(container);
    }

    /**
     * Waits for an element to exist in the DOM using mutation observers.
     * @param selector CSS Selector to target the element
     * @returns HTMLElement of the selected entry.
     */
    private waitForElementToExist(selector: string): Promise<Element> {
        return new Promise((resolve) => {
            const element = document.querySelector(selector);
            if (element) {
                return resolve(element);
            }

            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                subtree: true,
                childList: true,
            });
        });
    }

    injectPluginStyles() {
        const elementId = 'highlite-plugin-treasure-map-helper';
        if (document.getElementById(elementId)) return;

        const style = document.createElement('style');
        style.id = elementId;
        style.textContent = `
    .hs-treasure-map-helper-button {
      cursor: pointer;
      position: absolute;
      top: -25px;
      left: 0px;
      z-index: 1000;
      padding: 5px 10px;
    }

    .hs-treasure-map-helper-link {
      text-decoration: none;
    }

    .hs-treasure-map-helper-link-green {
      color: green;
    }

    .hs-treasure-map-helper-link-yellow {
      color: yellow;
    }
  `;
        document.head.appendChild(style);
    }
}
