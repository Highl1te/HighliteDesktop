import type { Ingredient } from './Ingredient.class';

export interface Recipe {
    _ingredients: Array<Ingredient>;

    get Ingredients(): Array<Ingredient>;
}
