import type { DBSchema } from "idb";

export interface HighliteSchema extends DBSchema {
    resources: {
        key: string; //resource name
        value: {
            updatedAt: number; //timestamp of last update
            data: string; //base64 encoded data
        };
    }
    settings: {
        key: string; //plugin name
        value: Record<string, boolean | number | string>;
    };
    drop_logs: {
        key: number; //NPC defId
        value: {
            defId: number;
            name: string;
            killCount: number;
            drops: { [itemId: number]: { name: string, quantity: number, totalDropped: number } };
            lastUpdated: number;
        };
    };
}