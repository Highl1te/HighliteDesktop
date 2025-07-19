import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';

import Bronze_scimitar from '@static/icons/customCursor/Bronze_scimitar.png';
import Celadon_scimitar from '@static/icons/customCursor/Celadon_scimitar.png';
import Chicken_39 from '@static/icons/customCursor/Chicken_39.png';
import Chisel from '@static/icons/customCursor/Chisel.png';
import Coronium_scimitar from '@static/icons/customCursor/Coronium_scimitar.png';
import Damoguis_staff from '@static/icons/customCursor/Damoguis_staff.png';
import Ember_staff from '@static/icons/customCursor/Ember_staff.png';
import Fires_Fury from '@static/icons/customCursor/Fires_Fury.png';
import Forest_staff from '@static/icons/customCursor/Forest_staff.png';
import Gnomes_hat from '@static/icons/customCursor/Gnomes_hat.png';
import Golden_leaf from '@static/icons/customCursor/Golden_leaf.png';
import Hydro_staff from '@static/icons/customCursor/Hydro_staff.png';
import Iron_scimitar from '@static/icons/customCursor/Iron_scimitar.png';
import Knife from '@static/icons/customCursor/Knife.png';
import Leaf from '@static/icons/customCursor/Leaf.png';
import Legendary_scimitar from '@static/icons/customCursor/Legendary_scimitar.png';
import Marlin from '@static/icons/customCursor/Marlin.png';
import Natures_Fury from '@static/icons/customCursor/Natures_Fury.png';
import Palladium_scimitar from '@static/icons/customCursor/Palladium_scimitar.png';
import Raw_marlin from '@static/icons/customCursor/Raw_marlin.png';
import Rooster_117 from '@static/icons/customCursor/Rooster_117.png';
import Shovel from '@static/icons/customCursor/Shovel.png';
import Steel_scimitar from '@static/icons/customCursor/Steel_scimitar.png';
import Waters_Fury from '@static/icons/customCursor/Waters_Fury.png';


export class CustomCursor extends Plugin {
    pluginName: string = 'Custom Cursor';
    author = '0rangeYouGlad';

    constructor() {
        super();

        this.settings.cursorOffset = {
            text: 'Cursor Offset',
            type: SettingsTypes.text,
            value: "auto",
            callback: this.reset_cursor,
        } as any;

        this.settings.cursorImportant = {
            text: 'Cursor Important (Hover and Click)',
            type: SettingsTypes.checkbox,
            value: true,
            callback: this.reset_cursor,
        } as any;

        this.settings.cursorImagePresets = {
            text: 'Cursor Presets',
            type: SettingsTypes.range,
            value: 1,
            callback: this.reset_cursor,
        } as any;

        this.settings.cursorCustomImage = {
            text: 'Cursor Custom Image',
            type: SettingsTypes.text,
            value: "",
            callback: this.reset_cursor,
        } as any;
    }

    // Don't think it's feasible to use the copy alredy in the game files unfortunately, need a separate png
    private images = [
        Legendary_scimitar,
        Celadon_scimitar,
        Coronium_scimitar,
        Palladium_scimitar,
        Steel_scimitar,
        Iron_scimitar,
        Bronze_scimitar,
        Damoguis_staff,
        Hydro_staff,
        Forest_staff,
        Ember_staff,
        Waters_Fury,
        Natures_Fury,
        Fires_Fury,
        Leaf,
        Golden_leaf,
        Chicken_39,
        Rooster_117,
        Raw_marlin,
        Marlin,
        Shovel,
        Chisel,
        Knife,
        Gnomes_hat
      ]

    get_png_from_preset() {
        if(this.images[this.settings.cursorImagePresets.value]) {
            return `${this.images[this.settings.cursorImagePresets.value]}`;
        }
        return this.images[0];
    }

    get_cursor_url() {
        return `url(${this.settings.cursorCustomImage.value || this.get_png_from_preset()})`
    }

    init(): void {
        this.log('Initialized CustomCursor');
    }

    start(): void {
        this.log('Started CustomCursor');
        if(this.settings.enable.value) {
            this.set_cursor()
        }
    }

    stop(): void {
        this.log('Stopped CustomCursor');
        this.clear_cursor();
    }

    private addCSSStyles(cursorName?: string): void {
        const preexistingStyle = document.head.querySelector('#cursorStyle');
        if(preexistingStyle) {
            document.head.removeChild(preexistingStyle);
        }
        if(cursorName) {
            const style = document.createElement('style');
            style.id = "cursorStyle";
            style.textContent = `
                /* Ensure panel takes full width and height */
                .hs-screen-mask {
                    cursor: ${cursorName};
                }
                :hover {
                    cursor: ${cursorName};
                }
                html {
                    cursor: ${cursorName};
                }
            `;
            document.head.appendChild(style);
        }
    }

    set_cursor() {
        if(this.settings.enable.value) {
            this.addCSSStyles(`${this.get_cursor_url()}, ${this.settings.cursorOffset.value || 'auto'} ${this.settings.cursorImportant.value ? '!important' : ''}`);
        }
    }

    reset_cursor() {
        this.clear_cursor();
        this.set_cursor();
    }

    clear_cursor() {
        this.addCSSStyles();
    }
}
