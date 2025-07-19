import { Plugin } from '../core/interfaces/highlite/plugin/plugin.class';
import { SettingsTypes } from '../core/interfaces/highlite/plugin/pluginSettings.interface';

export class BankSearch extends Plugin {
    pluginName = 'Bank Search';
    author = 'Oatelaus';

    private searchBox: HTMLElement | null = null;
    private resizeListener: (() => void) | null = null;
    private lastQuery: string = '';

    constructor() {
        super();

        this.settings.memory = {
            text: 'Remember search between banking session',
            type: SettingsTypes.checkbox,
            value: false,
            callback: () => {},
        }
    }

    start(): void {
        if (!this.settings.enable.value) {
            return;
        }
        this.injectSearchBox();
        this.updateSearchBoxVisibility();
    }

    init(): void {
    }

    stop(): void {
        this.destroy();
    }

    BankUIManager_showBankMenu() {
        if (!this.settings.enable.value) {
            return;
        }
        this.injectSearchBox();
        this.updateSearchBoxVisibility();

        const mainPlayer = document.highlite?.gameHooks?.EntityManager?.Instance?.MainPlayer;
        const bankStorage = mainPlayer.BankStorageItems;

        if (mainPlayer && bankStorage) {
            bankStorage.OnInventoryChangeListener.add(this.updateSearch.bind(this));
            bankStorage.OnReorganizedItemsListener.add(this.updateSearch.bind(this));
        }
    }


    BankUIManager_handleCenterMenuWillBeRemoved() {
        this.destroy();
    }

    updateSearch() {
        this.highlightBankQuery(this.lastQuery)
    }

    updateSearchBoxVisibility() {
        const bankMenu = document.getElementById('hs-bank-menu');
        if (!bankMenu) {
            this.removeSearchBox();
            return;
        }

        // Check if bank is visible
        const isVisible = this.isBankVisible(bankMenu);

        if (isVisible && !this.searchBox) {
            this.injectSearchBox();
        } else if (!isVisible && this.searchBox) {
            this.removeSearchBox();
        }
    }

    isBankVisible(bankMenu: HTMLElement): boolean {
        // Check if the bank menu is visible
        const style = window.getComputedStyle(bankMenu);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        // Check if parent containers are visible
        let parent = bankMenu.parentElement;
        while (parent) {
            const parentStyle = window.getComputedStyle(parent);
            if (
                parentStyle.display === 'none' ||
                parentStyle.visibility === 'hidden'
            ) {
                return false;
            }
            parent = parent.parentElement;
        }

        // Check if bank menu has any content (indicating it's actually open)
        const hasItems = bankMenu.querySelectorAll('[data-slot]').length > 0;
        return hasItems;
    }

    injectSearchBox() {
        // Prevent duplicate injection - check both internal reference and DOM presence
        if (this.searchBox || document.getElementById('bank-helper-search-box'))
            return;

        // Find the bank menu and header
        const bankMenu = document.getElementById('hs-bank-menu');
        if (!bankMenu) return;
        const header = bankMenu.querySelector('.hs-menu-header');
        if (!header) return;

        // Create the search box container
        const searchContainer = document.createElement('div');
        searchContainer.id = 'bank-helper-search-box';
        searchContainer.classList.add('bank-helper-search-container');
        searchContainer.style.marginLeft = 'auto'; // Remove left margin
        this.searchBox = searchContainer;

        // Create the input
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search...';
        input.classList.add('bank-helper-search-input');
        input.classList.add('hs-text-input');
        input.style.width = '160px'; // Slightly more compact
        input.style.outline = 'none';
        input.style.marginRight = '8px'; // Small space between input and close button
        input.value = this.settings.memory.value ? this.lastQuery : '';

        // Prevent game from processing keystrokes while typing
        input.addEventListener('keydown', e => e.stopPropagation());
        input.addEventListener('keyup', e => e.stopPropagation());
        input.addEventListener('keypress', e => e.stopPropagation());

        // Add focus styling and prevent focus stealing (matching other plugins)
        input.addEventListener('focus', e => {
            e.preventDefault();
            e.stopPropagation();
        });

        // Prevent focus stealing on mousedown
        searchContainer.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            input.focus();
        });

        searchContainer.appendChild(input);

        // Insert the search bar immediately before the close button
        const closeBtn = header.querySelector('button');
        if (closeBtn) {
            header.insertBefore(searchContainer, closeBtn);
        } else {
            header.appendChild(searchContainer);
        }

        // Add highlight style if not present
        if (!document.getElementById('bank-helper-highlight-style')) {
            const style = document.createElement('style');
            style.id = 'bank-helper-highlight-style';
            style.textContent = `
        .bank-helper-search-container {
          padding: 0px;
        }
        .bank-helper-search-input {
          padding: 6px 10px;
          color: #fff;
          font-size: 14px;
        }
        .bank-helper-greyed-out {
          opacity: 0.3 !important;
          filter: grayscale(100%) !important;
          transition: opacity 0.2s, filter 0.2s;
        }
      `;
            document.head.appendChild(style);
        }

        // Input event
        input.addEventListener('input', e => {
            const query = input.value.trim().toLowerCase();
            this.lastQuery = query; // Store the last query
            this.highlightBankQuery(query);
        });
        // If there is a last query, immediately highlight
        if (this.lastQuery) {
            this.highlightBankQuery(this.lastQuery);
        }
    }

    // In removeSearchBox, just remove from DOM (header) and cleanup
    removeSearchBox() {
        const existingSearchBoxes = document.querySelectorAll('#bank-helper-search-box');
        existingSearchBoxes.forEach(box => box.remove());
        this.searchBox = null;
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
            this.resizeListener = null;
        }
    }

    highlightBankQuery(query) {
        // Get bank items from the game data
        const bankItems =
            document.highlite?.gameHooks?.EntityManager?.Instance?.MainPlayer
                ?._bankItems?.Items || [];

        // Find all bank item elements by data-slot attribute
        const bankMenu = document.getElementById('hs-bank-menu');
        if (!bankMenu) return;

        // Query all elements with data-slot attribute
        const itemElements = Array.from(
            bankMenu.querySelectorAll('[data-slot]')
        );

        // If query is empty, show all items
        if (!query) {
            itemElements.forEach(el => {
                (el as HTMLElement).style.display = '';
            });
            return;
        }

        // Loop through all itemElements (slots)
        itemElements.forEach((el, i) => {
            const bankItem = bankItems[i];
            if (!bankItem) {
                // No item in this slot, always hide when searching
                (el as HTMLElement).style.display = 'none';
                return;
            }

            // Get item definition
            const itemDef = document.highlite?.gameHooks?.ItemDefMap?.ItemDefMap
                ?.get
                ? document.highlite.gameHooks.ItemDefMap.ItemDefMap.get(
                      bankItem._id
                  )
                : null;

            const itemName = itemDef
                ? itemDef._nameCapitalized ||
                  itemDef._name ||
                  `Item ${bankItem._id}`
                : `Item ${bankItem._id}`;

            if (itemName.toLowerCase().includes(query)) {
                (el as HTMLElement).style.display = '';
            } else {
                (el as HTMLElement).style.display = 'none';
            }
        });
    }

    // Cleanup method
    destroy() {
        const mainPlayer = document.highlite?.gameHooks?.EntityManager?.Instance?.MainPlayer;
        const bankStorage = mainPlayer.BankStorageItems;

        if (mainPlayer && bankStorage) {
            bankStorage.OnInventoryChangeListener.remove(this.updateSearch);
            bankStorage.OnReorganizedItemsListener.remove(this.updateSearch);
        }
      
        if (!this.settings.memory.value) {
            this.lastQuery = '';
        }

        // Find all bank item elements by data-slot attribute
        const bankMenu = document.getElementById('hs-bank-menu');
        if (!bankMenu) return;

        // Query all elements with data-slot attribute
        const itemElements = Array.from(
            bankMenu.querySelectorAll('[data-slot]')
        );

        itemElements.forEach(el => {
            (el as HTMLElement).style.display = ''; // Ensure all items are visible on destroy
        });

        this.removeSearchBox();

        // Ensure resize listener is removed
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
            this.resizeListener = null;
        }
    }
}
