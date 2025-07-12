export interface Ingredient {
    _amount: number;
    _itemId: number;

    get Amount(): number;
    get ItemID(): number;
}
