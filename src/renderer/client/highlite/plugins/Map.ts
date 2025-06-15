import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { PanelManager } from "../core/managers/highlite/panelManager";

export class WorldMap extends Plugin {
    pluginName = "World Map";
    panelManager : PanelManager = new PanelManager();
    mapWindow: HTMLDivElement | null = null;
    mapEmbed: HTMLIFrameElement | null = null;
    previousPosition : { X: number, Z: number } | null = null;
    
    init(): void {
        this.log("Initializing");
    }

    start(): void {
        this.log("Started");
        if (!this.settings.enable.value) {
            return;
        }

        const mapMenuItems = this.panelManager.requestMenuItem("🗺️", "World Map");
        if (!mapMenuItems) {
            this.error("Failed to create World Map panel.");
            return;
        }
        
        const iconElement = mapMenuItems[0] as HTMLDivElement;

        iconElement.onclick = () => {
            this.showMap();
        }
    }

    showMap() {
        if (!this.settings.enable.value) {
          return;
        }

        if (this.mapWindow) {
            this.log("Map window already exists, skipping creation.");
            // If map is already visible, hide it, otherwise show it
            if (this.mapWindow.style.visibility == "hidden") {
                this.mapWindow.style.visibility = "visible";
            } else {
                this.mapWindow.style.visibility = "hidden";
            }
            return;
        }
        // Create a window in the middle of the screen which embeds the map: https://highlite.fanet.dev/map
        this.mapWindow = document.createElement("div");
        this.mapWindow.style.position = "fixed";
        this.mapWindow.style.top = "50%";
        this.mapWindow.style.left = "50%";
        this.mapWindow.style.transform = "translate(-50%, -50%)";
        this.mapWindow.style.width = "50%";
        this.mapWindow.style.height = "50%";
        this.mapWindow.style.backgroundColor = "white";
        this.mapWindow.style.zIndex = "1000";
        this.mapWindow.style.border = "2px solid black";
        this.mapWindow.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
        this.mapWindow.style.display = "flex";
        this.mapWindow.style.justifyContent = "center";
        this.mapWindow.style.alignItems = "center";
        this.mapWindow.style.visibility = "visible";
        this.mapWindow.style.borderRadius = "10px";
        this.mapWindow.style.flexDirection = "column";
        this.mapWindow.style.background = "rgba(16, 16, 16, 0.8)";
        this.mapWindow.style.backdropFilter = "blur(5px)";
        this.mapWindow.style.padding = "10px";
        this.mapWindow.style.paddingTop = "0px";
        document.body.appendChild(this.mapWindow);


        // Window Title
        const titleDiv = document.createElement("div");
        titleDiv.style.display = "flex";
        titleDiv.style.width = "100%";
        titleDiv.style.flexDirection = "row";
        titleDiv.style.padding = "5px";
        titleDiv.style.justifyContent = "space-between";
        this.mapWindow.appendChild(titleDiv);
        const titleText = document.createElement("span");
        titleText.textContent = "World Map";
        titleText.style.fontFamily = "Inter";
        titleText.style.color = "white";
        titleDiv.appendChild(titleText);

        const embed = document.createElement("iframe");
        embed.src = `https://highlite.fanet.dev/map?hide_decor=true&highliteMapPlugin=true`;
        embed.style.width = "100%";
        embed.style.height = "100%";
        embed.style.border = "none";
        embed.style.borderRadius = "10px";
        embed.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
        this.mapWindow.appendChild(embed);
        this.mapEmbed = embed;

        // Add a close button to the map window
        /* <div style="position: absolute;top: -5px;right: -5px;z-index: 100000000;background: red;color: white;box-shadow: none;padding: 5px;font-family: 'Inter';height: 10px;width: 10px;overflow: visible;text-align: center;justify-content: center;display: flex;align-items: center;border-radius: 5px;text-shadow: 0px 0px 4px black;cursor: pointer;">✕</div>*/
        const closeButton = document.createElement("div");
        closeButton.style.zIndex = "100000000";
        closeButton.style.background = "red";
        closeButton.style.color = "white";
        closeButton.style.boxShadow = "none";
        closeButton.style.padding = "5px";
        closeButton.style.fontFamily = "Inter";
        closeButton.style.height = "10px";
        closeButton.style.width = "10px";
        closeButton.style.overflow = "visible";
        closeButton.style.textAlign = "center";
        closeButton.style.justifyContent = "center";
        closeButton.style.display = "flex";
        closeButton.style.alignItems = "center";
        closeButton.style.borderRadius = "5px";
        closeButton.style.textShadow = "0px 0px 4px black";
        closeButton.style.cursor = "pointer";
        closeButton.textContent = "✕";
        closeButton.onclick = () => {
            if (!this.mapWindow) return;
            this.mapWindow.style.visibility = "hidden";
        };
        
        titleDiv.appendChild(closeButton);

    }

    GameLoop_update(...args : any) {
      if (!this.mapWindow) return;
      if (!this.mapEmbed) return;
      if (!this.settings.enable.value) return;
      if (!this.gameHooks.EntityManager) return;
      if (!this.gameHooks.EntityManager.Instance) return;
      if (!this.gameHooks.EntityManager.Instance.MainPlayer) return;
      if (!this.gameHooks.EntityManager.Instance.MainPlayer.CurrentMapLevel) return;
      if (!this.gameHooks.EntityManager.Instance.MainPlayer.CurrentGamePosition) return;
      

      const playerMapLevel = this.gameHooks.EntityManager.Instance.MainPlayer.CurrentMapLevel;
      const playerMapPos = this.gameHooks.EntityManager.Instance.MainPlayer.CurrentGamePosition;
      const mapLevelText = playerMapLevel == 1 ? "Overworld" : playerMapLevel == 0 ? "Underworld" : "Sky";

      if (this.previousPosition != null && playerMapPos.X == this.previousPosition.X && playerMapPos.Z == this.previousPosition.Z) {
        return; // No position change, no need to update
      } else {
        this.previousPosition = { X: playerMapPos.X, Z: playerMapPos.Z };
      }

      if (!this.mapEmbed.contentWindow) {
        return; // No content window, cannot post message
      }

      this.mapEmbed.contentWindow.postMessage({ X:  playerMapPos.X + 512, Y: playerMapPos.Z + 512, lvl: mapLevelText}, "*");
    }

    stop(): void {
        this.log("Stopped");
        if (this.mapWindow) {
            document.body.removeChild(this.mapWindow);
            this.mapWindow = null;
        }
        if (this.mapEmbed) {
            this.mapEmbed.remove();
            this.mapEmbed = null;
        }
        this.panelManager.removeMenuItem("🗺️");
    }
}
