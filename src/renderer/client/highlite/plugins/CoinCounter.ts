import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { UIManager, UIManagerScope } from '../core/managers/highlite/uiManager';
import { abbreviateValue } from '../core/utilities/abbreviateValue';

export class CoinCounter extends Plugin {
    pluginName = 'Coin Counter';
    author = 'Highlite';
    private uiManager = new UIManager();
    private coinCounterUI: HTMLElement | null = null;
    private coinCounterValueUI: HTMLElement | null = null;
    private coinCount = 0;
    private isLoggedIn = false;

    private bankedCoins = 0;
    private inventoryCoins = 0;

    constructor() {
        super();
    }

    start(): void {
        this.log('Started');
        if (
            this.settings.enable!.value &&
            this.isLoggedIn &&
            !this.coinCounterUI
        ) {
            this.createCoinCounterUI();
        }
    }

    stop(): void {
        this.log('Stopped');
        if (this.coinCounterUI) {
            this.coinCounterUI.remove();
            this.coinCounterUI = null;
        }
    }

    init(): void {
        this.log('Initialized');
    }

    // Create UI Element
    createCoinCounterUI(): void {
        if (this.coinCounterUI) {
            this.coinCounterUI.remove();
        }

        this.coinCounterUI = this.uiManager.createElement(
            UIManagerScope.ClientInternal
        );

        if (!this.coinCounterUI) {
            this.log('Failed to create coin counter UI element.');
            this.settings.enable!.value = false;
            return;
        }

        // Assign CSS Styling
        this.coinCounterUI.style.position = 'absolute';
        this.coinCounterUI.style.height = 'auto';
        this.coinCounterUI.style.zIndex = '1000';
        this.coinCounterUI.style.right = '235px';
        this.coinCounterUI.style.bottom = '66px';
        this.coinCounterUI.style.display = 'flex';
        this.coinCounterUI.style.flexDirection = 'column';
        this.coinCounterUI.style.justifyContent = 'space-evenly';
        this.coinCounterUI.style.width = 'auto';
        this.coinCounterUI.style.padding = '10px';
        this.coinCounterUI.classList.add('hs-menu', 'hs-game-menu');

        // Create Sub-Span Element
        const coinCounterSpan = document.createElement('span');
        coinCounterSpan.style.display = 'flex';
        coinCounterSpan.style.justifyContent = 'center';

        // Create Sub-Span-I Element
        const coinCounterSpanI = document.createElement('i');
        coinCounterSpanI.className = 'iconify';
        coinCounterSpanI.setAttribute(
            'data-icon',
            'material-symbols:monetization-on'
        );
        coinCounterSpanI.ariaHidden = 'true';
        coinCounterSpanI.style.marginRight = '10px';
        coinCounterSpan.appendChild(coinCounterSpanI);

        // Create Sub-Span-Value Element
        this.coinCounterValueUI = document.createElement('span');
        this.coinCounterValueUI.innerText = `${this.coinCount}`;
        coinCounterSpan.appendChild(this.coinCounterValueUI);

        // Append to UI Element
        this.coinCounterUI.appendChild(coinCounterSpan);
    }

    // Logged In
    SocketManager_loggedIn(): void {
        this.isLoggedIn = true;
        // If not enabled, return
        if (!this.settings.enable.value) {
            return;
        }

        if (this.coinCounterUI) {
            this.coinCounterUI.remove();
            this.coinCounterUI = null;
        }
        this.createCoinCounterUI();
    }

    // Logged Out
    SocketManager_handleLoggedOut(): void {
        this.isLoggedIn = false;
        if (this.coinCounterUI) {
            this.coinCounterUI.remove();
            this.coinCounterUI = null;
        }
    }

    // Update Coin Count
    GameLoop_update(): void {
        if (!this.settings.enable!.value) {
            return;
        }

        if (!this.coinCounterUI) {
            return;
        }

        // If there is no UI Element with the class hs-game-menu--opened
        if (
            document.getElementsByClassName('hs-game-menu--opened').length === 0
        ) {
            this.coinCounterUI.style.right = '6px';
            this.coinCounterUI.style.transition = 'all 0.1s ease-in-out';
        } else {
            this.coinCounterUI.style.right = '235px';
            this.coinCounterUI.style.transition = 'none';
        }

        // Loop over: this.gameHooks.EntityManager.Instance.MainPlayer._bankItems.Items
        // Element with property _id == 6 is Coins
        // Property _amount is the amount of coins
        const bankItems =
            this.gameHooks.EntityManager.Instance.MainPlayer._bankItems.Items;
        const coins = bankItems.find(
            (item: any) => item != null && item._id === 6
        );
        if (coins) {
            this.bankedCoins = coins._amount;
        } else {
            this.bankedCoins = 0;
        }

        // Loop over: this.gameHooks.EntityManager.Instance.MainPlayer._inventory.Items
        // Element with property _id == 6 is Coins
        // Property _amount is the amount of coins
        const inventoryItems =
            this.gameHooks.EntityManager.Instance.MainPlayer._inventory.Items;
        const inventoryCoins = inventoryItems.find(
            (item: any) => item != null && item._id === 6
        );
        if (inventoryCoins) {
            this.inventoryCoins = inventoryCoins._amount;
        } else {
            this.inventoryCoins = 0;
        }

        this.coinCount = this.bankedCoins + this.inventoryCoins;
        if (this.coinCounterValueUI) {
            this.coinCounterValueUI.innerText = `${abbreviateValue(this.coinCount)}`;
        } else {
            this.log('Coin Counter UI Element not found.');
        }
    }
}
