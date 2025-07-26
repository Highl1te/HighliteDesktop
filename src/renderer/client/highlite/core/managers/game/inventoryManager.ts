export class InventoryManager {
    private static instance: InventoryManager;
    // FIXME: The mouse input event has this as an attribute which seems like a
    // more appropriate way to get at this, but it would require wrapping a
    // higher level input hook which complicates the implementation here and
    // feels more brittle. This document-global shift-key tracking is a
    // compromise that seems to work fine in testing.
    private shiftKeyPressed: boolean = false;

    shiftKeyDrops: boolean = false;

    constructor() {
        if (InventoryManager.instance) {
            return InventoryManager.instance;
        }
        this.registerEventListeners(this);
        InventoryManager.instance = this;
        document.highlite.managers.InventoryManager = this;
    }

    private registerEventListeners(inventoryManager: InventoryManager) {
        document.addEventListener('keydown', e => {
            if (e.key === 'Shift') { inventoryManager.shiftKeyPressed = true; }
        });
        document.addEventListener('keyup', e => {
            if (e.key === 'Shift') { inventoryManager.shiftKeyPressed = false; }
        });
    }

    handleInventoryItemLeftClicked(
        hookName: string,
        originalThis: any,
        originalFunction: any,
        e, t
    ): void {
        const wrapped = () => originalFunction.apply(originalThis, [e, t]);

        const inventoryManager = new InventoryManager();
        const shiftKeyDropsAndIsPressed =
            inventoryManager.shiftKeyDrops &&
            inventoryManager.shiftKeyPressed;
        if (!shiftKeyDropsAndIsPressed) {
            return wrapped();
        }

        const GH = document.highlite.gameHooks;
        const playerStateKinds = document.client.get('BI');
        const contextMenuEntries = document.client.get('QA');

        const currentState =
            GH.EntityManager.Instance.MainPlayer.CurrentState.getCurrentState();
        const clickShouldNotDrop =
            GH.ItemManager.Instance.IsItemCurrentlySelected ||
            GH.SpellManager.Instance.IsSpellCurrentlySelected ||
            e.getMenuType() !== GH.MainPlayer.Inventory ||
            currentState === playerStateKinds.BankingState ||
            currentState === playerStateKinds.ShoppingState;
        if (clickShouldNotDrop) {
            return wrapped();
        }

        const slot = e.getSlot();
        const item = GH.EntityManager.Instance.MainPlayer.Inventory.Items[slot];
        const itemHasDropAction =
            item !== null &&
            item.Def.InventoryActions.includes(contextMenuEntries.drop);
        if (!itemHasDropAction) {
            return wrapped();
        }

        // Replace a call to wrapped with the same call to
        // invokeInventoryAction that it would make in this context, except we
        // change the action to 'drop'.
        GH.ItemManager.Instance.invokeInventoryAction(e.getMenuType(),
                                                      contextMenuEntries.drop,
                                                      slot,
                                                      item);
    }
}
