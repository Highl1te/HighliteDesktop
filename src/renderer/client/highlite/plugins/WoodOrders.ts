import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';
import { NotificationManager } from '../core/managers/highlite/notificationManager';
import { SoundManager } from '../core/managers/highlite/soundsManager';
import { PanelManager } from '../core/managers/highlite/panelManager';

export class WoodOrders extends Plugin {
	pluginName = 'Wood Orders';
    author = 'Yoyo2324';
    private notificationManager: NotificationManager = new NotificationManager();
    private soundManager: SoundManager = new SoundManager();
    private panelManager: PanelManager = new PanelManager();

    private panelContent: HTMLElement | null = null;
    private itemListContainer: HTMLDivElement | null = null;
    private orderInput: HTMLDivElement | null = null;
    private orderBtn: HTMLElement | null = null;
    private modalOverlay: HTMLDivElement | null = null;
    private isLoggedIn: boolean = false;
    private updateId: undefined | ReturnType<typeof setInterval>;

    constructor() {
        super();
        // this.settings.volume = {
        //     text: 'Volume',
        //     type: SettingsTypes.range,
        //     value: 50,
        //     callback: () => {}, //TODO
        // };
        // this.settings.notification = {
        //     text: 'Notification',
        //     type: SettingsTypes.checkbox,
        //     value: false,
        //     callback: () => {}, //TODO
        // };
        // this.settings.sound = {
        //     text: 'Sound',
        //     type: SettingsTypes.checkbox,
        //     value: true,
        //     callback: () => {}, //TODO
        // };
        //if (this.settings.sound?.value as boolean) {
        //        this.soundManager.playSound(
        //            'https://cdn.pixabay.com/audio/2025/06/14/audio_48a2666bd1.mp3',
        //            (this.settings.volume?.value as number) / 100
        //        );
        //    }
    }

    start(): void {
    	this.log('Wood Orders Panel started');
        if (!this.settings.enable.value) {
            return;
        }

        // Create the panel
        this.createPanel();
        this.addStyles();
    }

    stop(): void {}

    init(): void {
        this.log('Wood Orders Panel initialized');

        // Add global reference for button onclick handlers
        (window as any).highliteItemPanel = this;
    }

    SocketManager_loggedIn(): void {
        // Mark as logged in
        this.isLoggedIn = true;
        this.buildPanelContent();
        this.updateOrders();
        this.updateId = setInterval(() => {this.updateOrders();}, 5000);
    }

    SocketManager_handleLoggedOut(): void {
        // Mark as logged out
        this.isLoggedIn = false;

        // Close any open modal
        this.closeModal();

        // Reset loaded states
        this.itemsLoaded = false;

        // Show loading state
        this.showLoadingState();

        clearInterval(this.updateId);
    }

    private createPanel(): void {
        try {
            // Request panel menu item
            const panelItems = this.panelManager.requestMenuItem(
                '🪓',
                'Wood Orders'
            );
            if (!panelItems) {
                this.error('Failed to create Wood Orders panel menu item');
                return;
            }

            // Get the panel content area
            this.panelContent = panelItems[1] as HTMLElement;

            // Set up the panel
            this.panelContent.className = 'wood-orders-panel';
            this.panelContent.style.width = '100%';
            this.panelContent.style.height = '100%';
            this.panelContent.style.display = 'flex';
            this.panelContent.style.flexDirection = 'column';

            // Build the panel content
            this.buildPanelContent();
        } catch (error) {
            this.error(`Failed to create panel: ${error}`);
        }
    }

    private buildPanelContent(): void {
        if (!this.panelContent) return;

        this.panelContent.innerHTML = '';

        // Create search bar
        const orderContainer = document.createElement('div');
        orderContainer.className = 'wood-orders-request-container';
        this.panelContent.appendChild(orderContainer);

        this.orderInput = document.createElement('div');
        this.orderInput.className = 'wood-orders-order-input-container';
        this.orderInput.innerHTML = `
            <h3>Request wood:</h3>
            <select name="type" id="orderType">
                <option value="logs">Logs</option>
                <option value="scrolls">Scrolls</option>
                <option value="pineLogs">Pine Logs</option>
                <option value="pineScrolls">Pine Scrolls</option>
                <option value="oakLogs">Oak Logs</option>
                <option value="oakScrolls">Oak Scrolls</option>
                <option value="palmLogs">Palm Logs</option>
                <option value="palmScrolls">Palm Scrolls</option>
                <option value="cherryLogs">Cherry Logs</option>
                <option value="cherryScrolls">Cherry Scrolls</option>
                <option value="luckyLogs">Lucky Logs</option>
                <option value="luckyScrolls">Lucky Scrolls</option>
                <option value="wizardLogs">Wizard Logs</option>
                <option value="wizardScrolls">Wizard Scrolls</option>
                <option value="deadwoodLogs">Deadwood Logs</option>
                <option value="deadwoodScrolls">Deadwood Scrolls</option>
            </select>
            <input name="amount" id="orderAmount" type="number" placeholder="Amount">
            <input name="price" id="orderPrice" type="number" placeholder="Price (per item)"><br>
        `;
        this.orderBtn = document.createElement('button');
        this.orderBtn.textContent = 'Submit Order';
        this.orderBtn.onclick = () => this.submitOrder();
        this.orderInput.appendChild(this.orderBtn);
        orderContainer.appendChild(this.orderInput);

        // Create item list container wrapper
        const listWrapper = document.createElement('div');
        listWrapper.className = 'item-panel-list-wrapper';
        this.panelContent.appendChild(listWrapper);

        this.itemListContainer = document.createElement('div');
        this.itemListContainer.className = 'wood-orders-list-container';
        listWrapper.appendChild(this.itemListContainer);

        // Show loading state initially
        this.showLoadingState();
    }

    private submitOrder(): void {
        if (this.isLoggedIn == false) {
            if (!this.orderInput) return;
            this.orderInput.innerHTML = `
                <div class="item-loading">
                    <p>Failed...</p>
                    <p class="item-loading-hint">Please log in to submit orders</p>
                </div>
            `;
        }else{
            let username = this.gameHooks.EntityManager.Instance.MainPlayer._name;
            let orderType = (document.getElementById('orderType') as HTMLSelectElement).value;
            let orderAmount = (document.getElementById('orderAmount') as HTMLSelectElement).value;
            let orderPrice = (document.getElementById('orderPrice') as HTMLSelectElement).value;
            let playerMapPos = this.gameHooks.EntityManager.Instance.MainPlayer.CurrentGamePosition;
            let orderX = playerMapPos.X;
            let orderY = this.gameHooks.EntityManager.Instance.MainPlayer.CurrentMapLevel;
            let orderZ = playerMapPos.Z;
            this.log('Sending order request!');
            fetch("https://highspellwoodcuttersunion.online/register_order.php/?username=" + username + "&type=" + orderType +
                "&amount=" + orderAmount + "&price=" + orderPrice + 
                "&x=" + orderX + "&y=" + orderY + "&z=" + orderZ)
            .then((response) => response.text())
            .then((result) => this.log(result))
            .catch((error) => this.error(error));
        }
    }

    private closeModal(): void {
        if (this.modalOverlay) {
            // Clean up sprites used in modal before removing
            this.modalOverlay.remove();
            this.modalOverlay = null;
        }
    }

    private showLoadingState(): void {
        if (!this.itemListContainer) return;

        this.itemListContainer.innerHTML = `
            <div class="item-loading">
                <p>Loading orders...</p>
                <p class="item-loading-hint">Please log in to view orders</p>
            </div>
        `;
    }

    private updateOrders(): void {
        fetch("https://highspellwoodcuttersunion.online/view_orders.php/")
            .then((response) => response.json())
            .then((result) => this.showOrders(result))
            .catch((error) => this.error(error));
    }

    private showOrders(results): void {
        if (!this.itemListContainer) return;
        this.itemListContainer.innerHTML = "";

        for (let index = 0; index < results.length; index++) {
            let itemContainer = document.createElement('div');
            itemContainer.className = 'wood-orders-order-container';
            itemContainer.innerHTML =  `
                <span>Requested by: ` + results[index][1] + `</span><br>
                <span>Type: ` + results[index][2] + `</span><br>
                <span>Amount: ` + results[index][3] + `</span><br>
                <span>Price per item: ` + results[index][4] + `</span><br>
                <span>Location: X: ` + results[index][5] + ` Z: ` + results[index][7] + `</span>
            `;
            if (results[index][1] == this.gameHooks.EntityManager.Instance.MainPlayer._name){
                let deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Mark Complete';
                deleteBtn.onclick =  () => this.markOrderComplete(results[index][0]);
                itemContainer.appendChild(deleteBtn);
            }
            this.itemListContainer.appendChild(itemContainer);
        }
    }

    private markOrderComplete(id): void {
        fetch("https://highspellwoodcuttersunion.online/complete_order.php/?id=" + id)
            .then((response) => response.json())
            .then((result) => this.updateOrders())
            .catch((error) => this.error(error));
    }

    private addStyles(): void {
        const style = document.createElement('style');
        style.setAttribute('data-item-panel', 'true');
        style.textContent = `
            /* Panel Container */
            .wood-orders-panel {
                width: 100% !important;
                height: 100% !important;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            /* Request */
            .wood-orders-request-container {
                padding: 12px 15px;
                border-bottom: 1px solid #333;
                flex-shrink: 0;
            }
            
            .wood-orders-request-container h3 {
                margin: 0;
                color: #fff;
                font-size: 18px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .wood-orders-order-input-container input {
                width: 100%;
                padding: 10px 15px;
                margin: 5px 0px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .wood-orders-order-input-container select {
                width: 100%;
                padding: 10px 15px;
                margin: 5px 0px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            }

            .wood-orders-order-input-container button {
                width: 100%;
                padding: 10px 15px;
                margin: 5px 0px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            }

            .wood-orders-order-input-container::placeholder {
                color: #888;
            }
            
            .wood-orders-order-input-container:focus {
                outline: none;
                border-color: #4a9eff;
                box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
            }

            .wood-orders-order-container {
                padding: 12px 15px;
                margin: 5px;
                border: 1px solid #333;
                flex-shrink: 0;
            }

            .wood-orders-order-container button {
                width: 100%;
                padding: 10px 15px;
                margin: 5px 0px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 10px;
                box-sizing: border-box;
            }
        `;
        document.head.appendChild(style);
    }
}