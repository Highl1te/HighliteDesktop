import type { Appearance } from './Appearance.class';
import type { Combat } from './Combat.class';
import type { Inventory } from './Inventory.class';

export interface MainPlayer {
    _actions: Array<number>;
    _appearance: Appearance;
    _bankItems: Inventory;
    _chatToken: string;
    _combat: Combat;
    _combatLevel: number;
}
