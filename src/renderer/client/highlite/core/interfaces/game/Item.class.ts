import type { ItemDefinition } from './ItemDefinition.class';

export interface Item {
    _amount: number;
    _def: ItemDefinition;
    _id: number;
    _isIOU: boolean;

    get Amount(): number;
    get Def(): ItemDefinition;
    get Id(): number;
    get IsIOU(): boolean;
}
