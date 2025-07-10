import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { PanelManager } from "../core/managers/highlite/panelManager";
import * as unicodeEmoji from "unicode-emoji";
import emojiUnicode from "emoji-unicode";

export class EmojiChat extends Plugin {
  pluginName = "Emoji Chat";
  author = "Flickwire";
  panelManager: PanelManager = new PanelManager();
  panelContent: HTMLElement | undefined = undefined;

  chatInputManager: any = undefined;

  private groupIcons = {
    "smileys-emotion": "😀",
    "people-body": "👤",
    "animals-nature": "🐾",
    "food-drink": "🍔",
    "travel-places": "🌍",
    activities: "⚽",
    objects: "📦",
    symbols: "🔣",
    flags: "🏳️‍🌈",
  };

  start(): void {
    if (!this.settings.enable.value) {
      return;
    }
    this.log(`Started`);
    if (this.attachToChatInput()) {
      this.createPanel();
    }
  }

  private createPanel(): void {
    this.panelContent = this.panelManager.requestMenuItem(
      "🙂",
      "Emoji Chat"
    )[1];
    if (!this.panelContent) {
      this.log(`Failed to create Emoji Chat panel`);
      return;
    }
    this.panelContent.style.display = "block";
    this.panelContent.style.flexDirection = "column";
    this.panelContent.style.width = "100%";
    this.panelContent.style.height = "-webkit-fill-available";
    const emojiButtons = this.emojiButtons();
    const tabBar = document.createElement("div");
    tabBar.style.display = "flex";
    tabBar.style.flexDirection = "row";
    tabBar.style.flexWrap = "wrap";
    tabBar.style.justifyContent = "space-around";
    tabBar.style.margin = "5px 0";
    tabBar.style.padding = "5px";
    tabBar.style.backgroundColor = "rgba(1,1,1,0.2)";
    this.panelContent.appendChild(tabBar);
    const groupDivs: HTMLDivElement[] = [];
    for (const group in emojiButtons) {
      if (emojiButtons.hasOwnProperty(group)) {
        groupDivs[group] = document.createElement("div");
        groupDivs[group].style.display = "none";
        if (group === "smileys-emotion") {
          groupDivs[group].style.display = "flex"; // Default to showing smileys-emotion group
        }
        groupDivs[group].style.flexDirection = "row";
        groupDivs[group].style.margin = "5px 0";
        groupDivs[group].style.flexWrap = "wrap";
        emojiButtons[group as unicodeEmoji.Group].forEach((button) => {
          groupDivs[group].appendChild(button);
        });
        this.panelContent.appendChild(groupDivs[group]);
      }
    }
    for (const group in emojiButtons) {
      if (emojiButtons.hasOwnProperty(group)) {
        const button = document.createElement("span");
        button.style.cursor = "pointer";
        button.textContent = this.groupIcons[group as unicodeEmoji.Group];
        button.style.cursor = "pointer";
        button.style.margin = "0 5px";
        button.addEventListener("click", () => {
          for (const g in emojiButtons) {
            if (emojiButtons.hasOwnProperty(g)) {
              groupDivs[g].style.display = "none";
            }
          }
          groupDivs[group].style.display = "flex";
        });
        tabBar.appendChild(button);
      }
    }
  }

  private attachToChatInput(): boolean {
    const HTMLUIManager = this.gameHooks.HTMLUIManager;
    if (!HTMLUIManager) {
      this.log(`HTMLUIManager is not available.`);
      return false;
    }
    const screenMask = HTMLUIManager.Instance.getScreenMask();
    if (!screenMask) {
      this.log(`ScreenMask is not available.`);
      return false;
    }
    this.chatInputManager = screenMask
      .getChatMenuQuadrant()
      .getChatMenu()
      .getChatInputMenu()
      .getChatInput();
    return !!this.chatInputManager;
  }

  private detachFromChatInput(): void {
    this.chatInputManager = undefined;
  }

  private emojiButtons: () => Record<unicodeEmoji.Group, HTMLSpanElement[]> =
    () => {
      const emojiList = unicodeEmoji.getEmojisGroupedBy("group", {
        subgroup: ["country-flag", "subdivision-flag"],
        version: ["16.0"],
      });
      const emojiButtons: Record<unicodeEmoji.Group, HTMLSpanElement[]> = {
        "smileys-emotion": [],
        "people-body": [],
        "animals-nature": [],
        "food-drink": [],
        "travel-places": [],
        activities: [],
        objects: [],
        symbols: [],
        flags: [],
      };
      for (const group in emojiList) {
        const emojiButtonsForGroup: HTMLSpanElement[] = [];
        if (emojiList.hasOwnProperty(group)) {
          const emojis = emojiList[group];
          emojis.forEach((emoji) => {
            const button = document.createElement("span");
            button.textContent = emoji.emoji;
            button.style.cursor = "pointer";
            button.style.margin = "0 5px";
            button.addEventListener("click", () => {
              const unicodeEmoji = this.convertEmojiToUnicode(emoji.emoji);
              this.appendToChatInput(unicodeEmoji);
            });
            emojiButtonsForGroup.push(button);
          });
        }
        emojiButtons[group as unicodeEmoji.Group] = emojiButtonsForGroup;
      }
      return emojiButtons;
    };

  private convertEmojiToUnicode(emoji: string): string {
    const unicode = emojiUnicode(emoji).split(" ");
    if (unicode.length === 0) {
      return "";
    }
    for (let i = 0; i < unicode.length; i++) {
      unicode[i] = `&#x${unicode[i]};`;
    }
    const unicodeString = unicode.join("");
    return unicodeString;
  }

  private appendToChatInput(emoji: string): void {
    if (!this.chatInputManager) {
      this.log(`Chat input manager is not initialized.`);
      return;
    }
    const currentText = this.chatInputManager._inputValue || "";
    this.chatInputManager.setInputValue(currentText + emoji);
  }

  private destroyPanel(): void {
    try {
      this.panelManager.removeMenuItem("🙂");
    } catch (e) {
      this.log('Could not destroy panel (it probably does not exist)');
    }
  }

  stop(): void {
    this.destroyPanel();
  }

  init(): void {}

  SocketManager_loggedIn(): void {
    if (!this.settings.enable.value) {
      return;
    }
    this.log("Player logged in, attaching to chat input");
    setTimeout(() => {
      if (this.attachToChatInput()) {
        this.createPanel();
      }
    }, 1000);
  }

  SocketManager_handleLoggedOut(): void {
    this.log("Player logged out, detaching from chat input");
    this.detachFromChatInput();
    this.destroyPanel();
  }
}
