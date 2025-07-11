import { Plugin } from "../core/interfaces/highlite/plugin/plugin.class";


export class BankSearch extends Plugin {
  pluginName = "Bank Search";
  author = "Oatelaus";

  private searchBox: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private resizeListener: (() => void) | null = null;
  private lastQuery: string = "";


  start(): void {
    if (!this.settings.enable.value) {
        return;
    }
    this.setupBankObserver();
  }

  init(): void {
  }

  stop(): void {
    this.destroy()
  }
  constructor() {
      super();
  }

  setupBankObserver() {
    // Find the bank menu
    const bankMenu = document.getElementById('hs-bank-menu');
    if (!bankMenu) {
      // Try again later if not found
      setTimeout(() => this.setupBankObserver(), 1000);
      return;
    }

    // Create mutation observer to watch for bank visibility changes
    this.observer = new MutationObserver((mutations) => {
      // Check if bank menu was removed
      const bankMenuStillExists = document.getElementById('hs-bank-menu');
      if (!bankMenuStillExists) {
        this.removeSearchBox();
        return;
      }
      
      this.updateSearchBoxVisibility();
    });

    // Observe changes to the bank menu's style and class attributes
    this.observer.observe(bankMenu, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      subtree: false
    });

    // Also watch for changes to the bank menu's display property
    this.observer.observe(bankMenu.parentElement || bankMenu, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      subtree: true
    });

    // Watch for when the bank menu is removed from DOM
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial check
    this.updateSearchBoxVisibility();
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
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
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
    if (this.searchBox || document.getElementById('bank-helper-search-box')) return;

    // Find the bank menu container to position relative to it
    const bankMenu = document.getElementById('hs-bank-menu');
    if (!bankMenu) return;

    // Create the search box container
    const searchContainer = document.createElement('div');
    searchContainer.id = 'bank-helper-search-box';
    searchContainer.classList.add('hs-menu');
    searchContainer.classList.add('bank-helper-search-container');
    this.searchBox = searchContainer;
    searchContainer.style.position = 'fixed';
    searchContainer.style.zIndex = '9999';
    searchContainer.style.display = 'flex';
    searchContainer.style.alignItems = 'center';
    searchContainer.style.gap = '8px';
    searchContainer.style.width = '300px';
    searchContainer.style.boxSizing = 'border-box';

    // Create the input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Find bank item...';
    input.classList.add('bank-helper-search-input');
    input.style.width = '180px';
    input.style.outline = 'none';
    input.value = this.lastQuery; // Set input value to last query

    // Prevent game from processing keystrokes while typing
    input.addEventListener('keydown', (e) => e.stopPropagation());
    input.addEventListener('keyup', (e) => e.stopPropagation());
    input.addEventListener('keypress', (e) => e.stopPropagation());

    // Add focus styling and prevent focus stealing (matching other plugins)
    input.addEventListener('focus', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.classList.add('bank-helper-search-input-focused');
    });
    input.addEventListener('blur', () => {
      input.classList.remove('bank-helper-search-input-focused');
    });

    // Prevent focus stealing on mousedown
    searchContainer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.focus();
    });

    // Add search icon
    const icon = document.createElement('span');
    icon.textContent = '🔍';
    icon.classList.add('bank-helper-search-icon');

    searchContainer.appendChild(input);
    searchContainer.appendChild(icon);
    
    // Position the search box below the bank menu
    this.positionSearchBox(searchContainer, bankMenu);
    
    // Append to document body to avoid overflow clipping
    document.body.appendChild(searchContainer);
    
    // Add resize listener to reposition search box
    this.resizeListener = () => {
      if (this.searchBox) {
        const bankMenu = document.getElementById('hs-bank-menu');
        if (bankMenu) {
          this.positionSearchBox(this.searchBox, bankMenu);
        }
      }
    };
    window.addEventListener('resize', this.resizeListener);

    // Add highlight style
    if (!document.getElementById('bank-helper-highlight-style')) {
      const style = document.createElement('style');
      style.id = 'bank-helper-highlight-style';
      style.textContent = `
        .bank-helper-search-container {
          padding: 0px;
        }
        
        .bank-helper-search-input {
          padding: 6px 10px;
          border: 1px solid #555;
          border-radius: 4px;
          background: #222;
          color: #fff;
          font-size: 14px;
        }
        
        .bank-helper-search-input-focused {
          border: 1px solid #4a9eff !important;
          box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2) !important;
        }

        .bank-helper-search-icon {
          font-size: 16px;
          opacity: 0.7;
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
    input.addEventListener('input', (e) => {
      const query = input.value.trim().toLowerCase();
      this.lastQuery = query; // Store the last query
      this.highlightBankQuery(query);
    });
    // If there is a last query, immediately highlight
    if (this.lastQuery) {
      this.highlightBankQuery(this.lastQuery);
    }
  }

  positionSearchBox(searchContainer: HTMLElement, bankMenu: HTMLElement) {
    const bankRect = bankMenu.getBoundingClientRect();
    
    // Position the search box below the bank menu
    searchContainer.style.left = `${bankRect.left}px`;
    searchContainer.style.top = `${bankRect.bottom + 8}px`;
  }

  removeSearchBox() {
    // Remove all instances of the search box (in case of duplicates)
    const existingSearchBoxes = document.querySelectorAll('#bank-helper-search-box');
    existingSearchBoxes.forEach(box => box.remove());
    
    this.searchBox = null;
    
    // Remove resize listener
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
  }

  highlightBankQuery(query) {
    // Get bank items from the game data
    const bankItems = ((document as any).highlite?.gameHooks?.EntityManager?.Instance?.MainPlayer?._bankItems?.Items) || [];
    
    // Find all bank item elements by data-slot attribute
    const bankMenu = document.getElementById('hs-bank-menu');
    if (!bankMenu) return;
    
    // Query all elements with data-slot attribute
    const itemElements = Array.from(bankMenu.querySelectorAll('[data-slot]'));
    
    // If query is empty, remove all grey-out effects
    if (!query) {
      itemElements.forEach(el => {
        el.classList.remove('bank-helper-greyed-out');
      });
      return;
    }
    
    // Loop through bank items and apply grey-out effect to non-matching items
    for (let i = 0; i < bankItems.length; i++) {
      const bankItem = bankItems[i];
      if (!bankItem) continue; // Skip null/empty slots
      
      // Get item definition
      const itemDef = ((document as any).highlite?.gameHooks?.ItemDefMap?.ItemDefMap?.get)
        ? (document as any).highlite.gameHooks.ItemDefMap.ItemDefMap.get(bankItem._id)
        : null;
      
      const itemName = itemDef ? (itemDef._nameCapitalized || itemDef._name || `Item ${bankItem._id}`) : `Item ${bankItem._id}`;
      
      // Find the corresponding DOM element by data-slot value
      const itemEl = itemElements.find(el => el.getAttribute('data-slot') === i.toString());
      if (itemEl) {
        if (itemName.toLowerCase().includes(query)) {
          // Remove grey-out effect for matching items
          itemEl.classList.remove('bank-helper-greyed-out');
        } else {
          // Add grey-out effect for non-matching items
          itemEl.classList.add('bank-helper-greyed-out');
        }
      }
    }
  }

  // Cleanup method
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.removeSearchBox();
    
    // Ensure resize listener is removed
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
  }
}
