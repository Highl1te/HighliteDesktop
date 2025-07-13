import type { Item } from './Item.class';

export interface Inventory {
    _isWaitingOnItemAction: boolean;
    _items: Array<Item | null>;
    _type: number;

    get Items(): Array<Item | null>;
    get Type(): number;
}
