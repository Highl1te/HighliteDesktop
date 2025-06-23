import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";

const TreasureMapItemIds = [442, 443, 456];

export class TreasureMapHelper extends Plugin {
  pluginName = "Treasure Map Helper";

  constructor() {
    super();
  }

  start(): void {}

  stop(): void {}

  init(): void {}

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

    const mapLevel = level === 1 ? "Overworld" : "Underworld";

    const link = `https://highspell.wiki/w/embed/map/?lvl=${mapLevel}&pos_x=${x}&pos_y=${y}&zoom=3&emoji=%E2%9D%8C&coords=${x},${y},${mapLevel}&outline=true&clean=true`;

    const targetElement =
      ".hs-treasure-map-menu__treasure-map-images-container";

    const treasureMapContainer = await this.waitForElementToExist(
      targetElement
    );

    const playerMapLevel =
      this.gameHooks.EntityManager.Instance.MainPlayer.CurrentMapLevel;
    const playerMapPos =
      this.gameHooks.EntityManager.Instance.MainPlayer.CurrentGamePosition;

    const isAtSpot =
      playerMapPos.X === x && playerMapPos.Z === y && playerMapLevel === level;

    const container = document.createElement("div");
    container.classList.add("hs-menu");
    container.style.cursor = "pointer";
    container.style.position = "absolute";
    container.style.top = "-25px";
    container.style.left = "0px";
    container.style.zIndex = "1000";
    container.style.padding = "5px 10px";

    const linkElement = document.createElement("a");
    linkElement.href = link;
    linkElement.target = "_blank";
    linkElement.style.textDecoration = "none";

    linkElement.style.color = isAtSpot ? "green" : "yellow";

    container.appendChild(linkElement);

    const text = document.createElement("span");
    text.textContent = "View on Wiki";
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
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
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
}
