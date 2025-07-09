export enum SettingsTypes {
    checkbox,
    range,
    color,
    text,
}

export interface PluginSettings {
    text: string;
    type: SettingsTypes;
    value: boolean | number | string;
    callback: Function;
    validation?: (value: boolean | number | string) => boolean;
}
