export enum SettingsTypes {
    checkbox,
    range,
    color,
    text,
    button,
}

export interface PluginSettings {
    text: string;
    type: SettingsTypes;
    value: boolean | number | string;
    callback: Function;
    validation?: (value: boolean | number | string) => boolean;
    hidden?: boolean;
    disabled?: boolean;
    onLoaded?: Function; // Optional callback called when this setting is loaded from storage
}
