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

        // Add CSS styles
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

        // Update stats
        this.updateStats();

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

        // Create header with toggle
        const header = document.createElement('div');
        header.className = 'wood-orders-header';

        const titleSection = document.createElement('div');
        titleSection.className = 'header-title-section';
        titleSection.innerHTML = '<h3>Wood Orders</h3>';
        header.appendChild(titleSection);

        this.panelContent.appendChild(header);

        // Create search bar
        const orderContainer = document.createElement('div');
        orderContainer.className = 'item-panel-search-container';
        this.panelContent.appendChild(orderContainer);

        this.orderInput = document.createElement('div');
        this.orderInput.className = 'item-list-container';
        this.orderInput.innerHTML = `
            <label for="type">Select type:</label>
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
            <label for="amount">Amount:</label>
            <input name="amount" id="orderAmount" type="number">
            <label for="price">Price (Per item):</label>
            <input name="price" id="orderPrice" type="number"><br>
        `;
        orderContainer.appendChild(this.orderInput);

        this.orderBtn = document.createElement('button');
        this.orderBtn.textContent = 'Submit Order';
        this.orderBtn.onclick =  () => this.submitOrder();
        orderContainer.appendChild(this.orderBtn);

        // Create item list container wrapper
        const listWrapper = document.createElement('div');
        listWrapper.className = 'item-panel-list-wrapper';
        this.panelContent.appendChild(listWrapper);

        this.itemListContainer = document.createElement('div');
        this.itemListContainer.className = 'item-list-container';
        listWrapper.appendChild(this.itemListContainer);

        // Create pagination
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        listWrapper.appendChild(paginationContainer);

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

        // if (!this.orderInput) return;

        // this.orderInput.innerHTML = `
        //     <div class="item-loading">
        //         <p>Loading form...</p>
        //         <p class="item-loading-hint">Please log in to submit orders</p>
        //     </div>
        // `;
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
            itemContainer.className = 'item-container';
            itemContainer.innerHTML =  `
                <h3>Requested by: ` + results[index][1] + `</h3>
                <span class="item-container-row">Type: ` + results[index][2] + `</span>
                <span class="item-container-row">Amount: ` + results[index][3] + `</span>
                <span class="item-container-row">Price per item: ` + results[index][4] + `</span>
                <span class="item-container-row">Location: X: ` + results[index][5] + ` Z: ` + results[index][7] + `</span>
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
            .item-definition-panel {
                width: 100% !important;
                height: 100% !important;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            /* Header */
            .item-panel-header {
                padding: 12px 15px;
                border-bottom: 1px solid #333;
                flex-shrink: 0;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .header-title-section {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .item-panel-header h3 {
                margin: 0;
                color: #fff;
                font-size: 18px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* View Toggle */
            .view-toggle-container {
                display: flex;
                gap: 8px;
                background: rgba(0, 0, 0, 0.3);
                padding: 4px;
                border-radius: 6px;
            }
            
            .view-toggle-button {
                padding: 6px 16px;
                background: transparent;
                border: 1px solid transparent;
                border-radius: 4px;
                color: #aaa;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                white-space: nowrap;
            }
            
            .view-toggle-button:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.1);
            }
            
            .view-toggle-button.active {
                background: rgba(74, 158, 255, 0.3);
                border-color: #4a9eff;
                color: #fff;
            }
            
            .item-panel-stats {
                display: flex;
                gap: 20px;
                font-size: 13px;
                color: #aaa;
                flex-wrap: wrap;
            }
            
            .stat-type {
                color: #4a9eff;
                font-weight: 600;
            }
            
            /* Search */
            .item-panel-search-container {
                padding: 12px 15px;
                border-bottom: 1px solid #333;
                flex-shrink: 0;
            }
            
            .item-panel-search {
                width: 100%;
                padding: 10px 15px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #555;
                border-radius: 4px;
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .item-panel-search::placeholder {
                color: #888;
            }
            
            .item-panel-search:focus {
                outline: none;
                border-color: #4a9eff;
                box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
            }
            
            /* List Wrapper */
            .item-panel-list-wrapper {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-height: 0;
                overflow: hidden;
            }
            
            /* Scrollbars */
            .item-list-container::-webkit-scrollbar {
                width: 10px;
            }
            
            .item-list-container::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            
            .item-list-container::-webkit-scrollbar-thumb {
                background: #4a9eff;
                border-radius: 4px;
            }
            
            .item-list-container::-webkit-scrollbar-thumb:hover {
                background: #66b3ff;
            }
            
            /* Item List */
            .item-list-container {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 15px;
                box-sizing: border-box;
            }

            .item-list-item {
                display: flex;
                align-items: center;
                padding: 12px 15px;
                margin-bottom: 10px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid transparent;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                box-sizing: border-box;
                width: 100%;
                overflow: hidden;
            }
            
            .item-list-item:hover {
                background: rgba(74, 158, 255, 0.2);
                border-color: #4a9eff;
                transform: translateX(3px);
            }
            
            .item-sprite {
                width: var(--hs-inventory-item-size);
                height: var(--hs-inventory-item-size);
                background-position: 0rem 0rem;
                background-repeat: no-repeat;
                background-size: calc(var(--hs-url-inventory-items-width)) calc(var(--hs-url-inventory-items-height));
                background-image: var(--hs-url-inventory-items);
                border: 2px solid #555;
                border-radius: 8px;
                margin-right: 15px;
                flex-shrink: 0;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }
            
            .item-list-item:hover .item-sprite {
                border-color: #4a9eff;
            }
            
            /* Pagination */
            .pagination-container {
                padding: 12px;
                border-top: 1px solid #333;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 12px;
                flex-shrink: 0;
                background: rgba(0, 0, 0, 0.3);
            }
            
            .pagination-button {
                padding: 6px 12px;
                background: rgba(74, 158, 255, 0.2);
                border: 1px solid #4a9eff;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                flex-shrink: 0;
            }
            
            .pagination-button:hover:not(:disabled) {
                background: rgba(74, 158, 255, 0.4);
            }
            
            .pagination-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .pagination-info {
                color: white;
                font-size: 14px;
                white-space: nowrap;
            }
            
            /* Modal Styles */
            .item-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(4px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .item-modal-container {
                background: rgba(16, 16, 16, 0.95);
                border: 2px solid #4a9eff;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(74, 158, 255, 0.5);
                width: 90%;
                max-width: 700px;
                max-height: 90vh;
                overflow: hidden;
                position: relative;
                animation: slideIn 0.3s ease-out;
            }
            
            @keyframes slideIn {
                from { 
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .item-modal-close {
                position: absolute;
                top: 15px;
                right: 15px;
                width: 36px;
                height: 36px;
                background: #ff4444;
                border: none;
                border-radius: 50%;
                color: white;
                font-size: 24px;
                font-weight: bold;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                z-index: 10;
                line-height: 1;
            }
            
            .item-modal-close:hover {
                background: #ff6666;
                transform: scale(1.1);
            }
            
            .item-modal-content {
                padding: 30px;
                overflow-y: auto;
                max-height: 90vh;
                color: white;
            }
            
            /* Modal scrollbar */
            .item-modal-content::-webkit-scrollbar {
                width: 10px;
            }
            
            .item-modal-content::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
            }
            
            .item-modal-content::-webkit-scrollbar-thumb {
                background: #4a9eff;
                border-radius: 4px;
            }
            
            .item-modal-content::-webkit-scrollbar-thumb:hover {
                background: #66b3ff;
            }
            
            /* Properties Grid */
            .detail-properties {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
            }
            
            .property {
                display: flex;
                justify-content: space-between;
                padding: 10px 15px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.08);
                overflow: hidden;
            }
            
            .property:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(74, 158, 255, 0.3);
            }
            
            .property-label {
                color: #999;
                font-size: 15px;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-right: 10px;
            }
            
            .property-value {
                color: white;
                font-size: 15px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .property-value.gold {
                color: #ffd700;
            }
            
            .property-value.yes {
                color: #4ecdc4;
            }
            
            .property-value.no {
                color: #ff6b6b;
            }
            
            /* Actions */
            .detail-actions {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            
            .action-button {
                padding: 12px 24px;
                background: rgba(74, 158, 255, 0.2);
                border: 2px solid #4a9eff;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                font-size: 16px;
                font-weight: 500;
                transition: all 0.2s;
                white-space: nowrap;
            }
            
            .action-button:hover {
                background: rgba(74, 158, 255, 0.4);
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(74, 158, 255, 0.3);
            }
            
            .action-button:active {
                transform: translateY(0);
                box-shadow: 0 2px 4px rgba(74, 158, 255, 0.3);
            }
        `;
        document.head.appendChild(style);
    }
}