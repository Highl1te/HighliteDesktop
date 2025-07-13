import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";
import { SettingsTypes } from "../core/interfaces/highlite/plugin/pluginSettings.interface";

type TabOptions = {
  name: string;
  icon: string;
  channels: {
    global: boolean;
    local: boolean;
    pm: boolean;
    system: boolean;
  };
};

type BetterChatSettings = {
  tabs: TabOptions[];
  currentTab: number;
  width: number;
  height: number;
  hidden: boolean;
};

export class BetterChat extends Plugin {
  pluginName = "BetterChat";
  author = "Flickwire";

  private defaultState: BetterChatSettings = {
    tabs: [
      {
        name: "Chat",
        icon: "💬",
        channels: {
          global: true,
          local: true,
          pm: true,
          system: true,
        },
      },
    ],
    currentTab: 0,
    width: 300,
    height: 400,
    hidden: false,
  };

  private state = {
    tabs: [] as TabOptions[],
    currentTab: 0,
  };

  constructor() {
    super();
    this.settings.state = {
      text: "State",
      type: SettingsTypes.text,
      value: JSON.stringify(this.defaultState),
      callback: this.state_onChange.bind(this),
      validation: this.state_validate.bind(this),
    };
  }

  init(): void {
    this.log("Initialized");
    if (this.settings.state.value) {
      this.state = JSON.parse(this.settings.state.value as string);
    } else {
      // Create default state
      this.state = this.defaultState;
      this.settings.state.value = JSON.stringify(this.state);
    }
  }

  start(): void {
    if (!this.settings.enable.value) {
      return;
    }
  }

  stop(): void {}

  state_onChange(newState: string): void {
    this.settings.state.value = newState;
    this.state = JSON.parse(newState) as BetterChatSettings;
  }

  state_validate(state: string | number | boolean): boolean {
    if (typeof state !== "string") {
      return false;
    }
    try {
      const parsedState = JSON.parse(state);
      if (
        typeof parsedState !== "object" ||
        !parsedState.tabs ||
        !Array.isArray(parsedState.tabs)
      ) {
        return false;
      }
      for (const tab of parsedState.tabs) {
        if (
          typeof tab.name !== "string" ||
          typeof tab.icon !== "string" ||
          typeof tab.channels !== "object" ||
          typeof tab.channels.global !== "boolean" ||
          typeof tab.channels.local !== "boolean" ||
          typeof tab.channels.pm !== "boolean" ||
          typeof tab.channels.system !== "boolean"
        ) {
          return false;
        }
      }
      if (
        typeof parsedState.currentTab !== "number" ||
        typeof parsedState.width !== "number" ||
        typeof parsedState.height !== "number" ||
        typeof parsedState.hidden !== "boolean"
      ) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}
