import { IndexDBWrapper } from './helpers/IndexDBWrapper';
import { Highlite } from './highlite/core/core';
import { HPAlert } from './highlite/plugins/HPAlert';
import { IdleAlert } from './highlite/plugins/IdleAlert/IdleAlert';
import { Lookup } from './highlite/plugins/Lookup';
import { Nameplates } from './highlite/plugins/Nameplates';
import { EnhancedHPBars } from './highlite/plugins/EnhancedHPBars';
import { EnhancedLoginScreen } from './highlite/plugins/EnhancedLoginScreen';
import { ContextMenuOptions } from './highlite/plugins/ContextMenuOptions';
import { TradeAlerts } from './highlite/plugins/TradeAlerts';
import { PMAlerts } from './highlite/plugins/PMAlerts';
import { CoinCounter } from './highlite/plugins/CoinCounter';
import { ExperienceTracker } from './highlite/plugins/ExperienceTracker';
import { WorldMap } from './highlite/plugins/Map';
import { MinimapMarker } from './highlite/plugins/MinimapMarker';
import { DropLog } from './highlite/plugins/DropLog';
import { ChatItemTooltip } from './highlite/plugins/ChatItemTooltip';
import { XPOrb } from './highlite/plugins/XPOrb';
import { TreasureMapHelper } from './highlite/plugins/TreasureMapHelper';
import { BankSearch } from './highlite/plugins/BankSearch';
import { FPSLimiter } from './highlite/plugins/FPSLimiter';
import { DefinitionsPanel } from './highlite/plugins/DefinitionsPanel';
import { CurrentStatus } from './highlite/plugins/CurrentStatus';
import { MinimapIcons } from './highlite/plugins/MinimapIcons';
import { AutoSprint } from './highlite/plugins/AutoSprint';
import { EntityHighlight } from './highlite/plugins/EntityHighlight';
import { InventoryTooltips } from './highlite/plugins/InventoryTooltips';
import { PacketQueue } from './highlite/plugins/PacketQueue';
import { ChatEnhancer } from './highlite/plugins/ChatEnhancer';
import { CustomCursor } from './highlite/plugins/CustomCursor';
import { QuickActionMouseTooltip } from './highlite/plugins/QuickActionMouseTooltip';
import { ExtraInfoBar } from './highlite/plugins/ExtraInfoBar';
import { SpellTooltips } from './highlite/plugins/SpellTooltips';
import { ShiftClickDrop } from './highlite/plugins/ShiftClickDrop';

import '@iconify/iconify';
import '@static/css/index.css';
import '@static/css/overrides.css';
import '@static/css/item-tooltip.css';

import './helpers/titlebarHelpers.js';
import { setupWorldSelectorObserver } from './helpers/worldSelectHelper';


// Plugin registry - single source of truth for all plugins
const PLUGIN_REGISTRY = [
    { class: HPAlert, path: './highlite/plugins/HPAlert' },
    { class: IdleAlert, path: './highlite/plugins/IdleAlert/IdleAlert' },
    { class: Lookup, path: './highlite/plugins/Lookup' },
    { class: Nameplates, path: './highlite/plugins/Nameplates' },
    { class: EnhancedHPBars, path: './highlite/plugins/EnhancedHPBars' },
    {
        class: EnhancedLoginScreen,
        path: './highlite/plugins/EnhancedLoginScreen',
    },
    {
        class: ContextMenuOptions,
        path: './highlite/plugins/ContextMenuOptions',
    },
    { class: TradeAlerts, path: './highlite/plugins/TradeAlerts' },
    { class: PMAlerts, path: './highlite/plugins/PMAlerts' },
    { class: CoinCounter, path: './highlite/plugins/CoinCounter' },
    { class: ExperienceTracker, path: './highlite/plugins/ExperienceTracker' },
    { class: WorldMap, path: './highlite/plugins/Map' },
    { class: MinimapMarker, path: './highlite/plugins/MinimapMarker' },
    { class: DropLog, path: './highlite/plugins/DropLog' },
    { class: ChatItemTooltip, path: './highlite/plugins/ChatItemTooltip' },
    { class: XPOrb, path: './highlite/plugins/XPOrb' },
    { class: TreasureMapHelper, path: './highlite/plugins/TreasureMapHelper' },
    { class: FPSLimiter, path: './highlite/plugins/FPSLimiter' },
    { class: DefinitionsPanel, path: './highlite/plugins/DefinitionsPanel' },
    { class: MinimapIcons, path: './highlite/plugins/MinimapIcons' },
    { class: PacketQueue, path: './highlite/plugins/PacketQueue' },
    { class: CurrentStatus, path: './highlite/plugins/CurrentStatus' },
    { class: EntityHighlight, path: './highlite/plugins/EntityHighlight' },
    { class: BankSearch, path: './highlite/plugins/BankSearch' },
    { class: AutoSprint, path: './highlite/plugins/AutoSprint' },
    { class: InventoryTooltips, path: './highlite/plugins/InventoryTooltips' },
    { class: ChatEnhancer, path: './highlite/plugins/ChatEnhancer' },
    { class: CustomCursor, path: './highlite/plugins/CustomCursor' },
    { class: QuickActionMouseTooltip, path: './highlite/plugins/QuickActionMouseTooltip' },
    { class: ExtraInfoBar, path: './highlite/plugins/ExtraInfoBar' },
    { class: SpellTooltips, path: './highlite/plugins/SpellTooltips' },
    { class: ShiftClickDrop, path: './highlite/plugins/ShiftClickDrop' },
];

async function obtainGameClient() {
    const highspellAssetsURL = 'https://highspell.com:3002/assetsClient';
    const highliteDB = new IndexDBWrapper();
    await highliteDB.init();

    // Check if clientLastVersion is set
    const clientLastVersion = await highliteDB.getItem('clientLastVersion');

    // Get Asset JSON to determine latest version
    const highSpellAssetJSON = await (await fetch(highspellAssetsURL)).json();
    const remoteLastVersion = highSpellAssetJSON.data.latestClientVersion;

    let highSpellClient = '';
    if (
        clientLastVersion == undefined ||
        clientLastVersion < remoteLastVersion
    ) {
        console.log(
            '[Highlite Loader] High Spell Client Version is outdated, updating...'
        );
        const highSpellClientURL = `https://highspell.com/js/client/client.${highSpellAssetJSON.data.latestClientVersion}.js`;
        console.log(highSpellClientURL);
        highSpellClient = await (
            await fetch(highSpellClientURL + '?time=' + Date.now())
        ).text();
        console.log(highSpellClient);
        highSpellClient =
            highSpellClient.substring(0, highSpellClient.length - 9) +
            '; document.client = {};' +
            'document.client.get = function(a) {' +
            'return eval(a);' +
            '};' +
            'document.client.set = function(a, b) {' +
            "eval(a + ' = ' + b);" +
            '};' +
            highSpellClient.substring(highSpellClient.length - 9);
        await highliteDB.setItem('highSpellClient', highSpellClient);
        await highliteDB.setItem('clientLastVersion', remoteLastVersion);
        console.log(
            '[Highlite Loader] High Spell Client Version ' +
                highSpellAssetJSON.data.latestClientVersion +
                ' downloaded.'
        );
    } else {
        console.log(
            '[Highlite Loader] High Spell Client Version is up to date.'
        );
        highSpellClient = await highliteDB.getItem('highSpellClient');
    }

    return Promise.resolve(highSpellClient);
}

// Track if page is already generated to prevent hot reload conflicts (persist across hot reloads)
const getPageGenerated = () =>
    (window as any).__highlite_page_generated || false;
const setPageGenerated = (value: boolean) =>
    ((window as any).__highlite_page_generated = value);

async function generatePage() {
    // Prevent regenerating page during hot reload
    if (getPageGenerated() && (import.meta as any).hot) {
        console.log('[HMR] Skipping page regeneration during hot reload');
        return;
    }
    // POST Request to https://highspell.com/game
    const urlencoded = new URLSearchParams();
    urlencoded.append('submit', 'World+1');
    urlencoded.append('serverid', '1');
    urlencoded.append('serverurl', 'https://server1.highspell.com:8888');

    const response = await fetch('https://highspell.com/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: urlencoded,
        redirect: 'follow',
    });
    const text = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const clientJS = doc.querySelector('script[src*="/js/client/client"]');
    if (clientJS) {
        clientJS.remove();
    }

    // Replace head and body content (non-script)
    Array.from(doc.head.children).forEach(child => {
        if (child.tagName.toLowerCase() !== 'script') {
            // If child has a relative href, update it to absolute
            if (child.hasAttribute('href')) {
                const href = child.getAttribute('href');
                if (href && href.startsWith('/')) {
                    child.setAttribute('href', 'https://highspell.com' + href);
                }
            }
            document.head.appendChild(child.cloneNode(true));
        }
    });

    Array.from(doc.body.children).forEach(child => {
        if (child.tagName.toLowerCase() !== 'script') {
            // If child has a relative href, update it to absolute
            if (child.hasAttribute('href')) {
                const href = child.getAttribute('href');
                if (href && href.startsWith('/')) {
                    child.setAttribute('href', 'https://highspell.com' + href);
                }
            }

            // Append the child
            document.body.appendChild(child.cloneNode(true));
        }
    });

    // Process and inject scripts manually
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => {
        const newScript = script.cloneNode(true);
        // if script was in head, append to head
        if (
            script.parentNode &&
            (script.parentNode as Element).tagName?.toLowerCase() === 'head'
        ) {
            document.head.appendChild(newScript);
        } else {
            // if script was in body, append to body
            document.body.appendChild(newScript);
        }
    });

    /* Find DOM elements with the attribute to= */
    const toElements = document.querySelectorAll('[to]');
    toElements.forEach(element => {
        const to = element.getAttribute('to');
        if (!to) return;
        const targetElement = document.querySelector(to);

        // Check if the element has a before or after attribute
        const before = element.getAttribute('before');
        const after = element.getAttribute('after');

        // If before is set, insert the element before the target element
        if (before && !after) {
            const beforeElement = document.querySelector(before);
            if (beforeElement && beforeElement.parentNode) {
                element.remove();
                beforeElement.parentNode.insertBefore(element, beforeElement);
            }
        } else if (after && !before) {
            // If after is set, insert the element after the target element
            const afterElement = document.querySelector(after);
            if (afterElement && afterElement.parentNode) {
                element.remove();
                afterElement.parentNode.insertBefore(
                    element,
                    afterElement.nextSibling
                );
            }
        } else if (!after && !before) {
            // If neither before nor after is set, append the element to the target element
            // This is the default behavior
            if (targetElement) {
                element.remove();
                targetElement.appendChild(element);
            }
        } else if (after && before) {
            // If both before and after are set, log a warning
            console.warn(
                'Element has both before and after attributes. Peforming default behavior.'
            );
            if (targetElement) {
                element.remove();
                targetElement.appendChild(element);
            }
        }
    });

    // Inject World Selector into Login Screen
    setupWorldSelectorObserver();

    // Page Setup Completed, Add Game Client Script
    const clientScript = document.createElement('script');
    clientScript.id = 'highspellClientScript';
    clientScript.textContent = await obtainGameClient();
    document.body.append(clientScript);

    // Page Setup Completed, Add User Helper Script
    import('./helpers/userHelper').then(module => {
        module.createUserHelper();
    });

    let highlite = document.highlite?.core;
    if (!highlite) {
        highlite = new Highlite();
        document.highlite = document.highlite || {};
        document.highlite.core = highlite;
    }

    const plugins = PLUGIN_REGISTRY.map(p => ({ class: p.class }));

    // Only register plugins and start if this is initial load
    if (!getPageGenerated()) {
        // Register all plugins
        plugins.forEach(plugin => {
            highlite.pluginManager.registerPlugin(plugin.class as any);
        });

        // Start the highlite instance
        highlite.start();
    }

    // Store plugins globally for HMR access
    if (!getPageGenerated()) {
        (window as any).__highlite_plugins = plugins;
        (window as any).__highlite_core = highlite;
    }

    window.electron.ipcRenderer.send('ui-ready');

    // Fire a new DOMContentLoaded event
    document.dispatchEvent(
        new Event('DOMContentLoaded', {
            bubbles: true,
            cancelable: true,
        })
    );

    // Mark page as generated
    setPageGenerated(true);
}

// Only run initial page generation, not during hot reload
if (!(import.meta as any).hot || !getPageGenerated()) {
    await generatePage();
}

// Setup HMR outside of generatePage to ensure it persists across hot reloads
if (import.meta.hot && import.meta.env.DEV) {
    console.log('[HMR] Setting up persistent hot module replacement...');

    // Get plugins from global state
    const getPlugins = () => (window as any).__highlite_plugins || [];
    const getHighlite = () => (window as any).__highlite_core;

    const pluginPaths = PLUGIN_REGISTRY.map(p => p.path);
    import.meta.hot.accept(pluginPaths, () => {
        console.log(
            '[HMR] Plugin modules updated, handled by custom hot reload system'
        );
    });

    const setupPluginHotReload = () => {
        const plugins = getPlugins() as Array<{ class: any }>;
        const highlite = getHighlite();

        if (!plugins.length || !highlite) {
            console.log(
                '[HMR] Waiting for plugins and highlite to be available...'
            );
            return;
        }

        console.log('[HMR] Setting up plugin hot reloading...');

        const pluginMap = new Map(
            plugins.map((p: { class: any }) => {
                const className = p.class.name;
                return [className, p];
            })
        );

        const reloadingPlugins = new Set<string>();

        import.meta.hot!.on(
            'plugin-hot-reload',
            async (data: { pluginName: string; file: string }) => {
                console.log(
                    `[Plugin HMR] Hot reload event received for: ${data.pluginName}`
                );

                // Prevent duplicate reloads for the same plugin
                if (reloadingPlugins.has(data.pluginName)) {
                    console.log(
                        `[Plugin HMR] Already reloading ${data.pluginName}, skipping...`
                    );
                    return;
                }

                const plugin = pluginMap.get(data.pluginName);
                if (!plugin) {
                    console.error(
                        `[Plugin HMR] Plugin ${data.pluginName} not found in registry`
                    );
                    return;
                }

                reloadingPlugins.add(data.pluginName);

                try {
                    if (!highlite || !highlite.pluginManager) {
                        console.error(
                            `[Plugin HMR] Highlite or plugin manager not available`
                        );
                        return;
                    }

                    const moduleUrl = `./highlite/plugins/${data.file}.ts?t=${Date.now()}`;
                    console.log(
                        `[Plugin HMR] Importing updated module: ${moduleUrl}`
                    );
                    const reloadedModule = await import(
                        /* @vite-ignore */ moduleUrl
                    );
                    const pluginClass = reloadedModule[data.pluginName];

                    if (
                        pluginClass &&
                        typeof highlite.pluginManager.hotReloadPlugin ===
                            'function'
                    ) {
                        console.log(
                            `[Plugin HMR] Hot reloading ${data.pluginName}`
                        );
                        const success =
                            highlite.pluginManager.hotReloadPlugin(pluginClass);
                        if (success) {
                            console.log(
                                `[Plugin HMR] Successfully hot reloaded ${data.pluginName}`
                            );
                            plugin.class = pluginClass;
                        } else {
                            console.error(
                                `[Plugin HMR] Failed to hot reload ${data.pluginName}`
                            );
                        }
                    } else {
                        console.error(
                            `[Plugin HMR] Could not find plugin class ${data.pluginName} in reloaded module or hotReloadPlugin method not available`
                        );
                    }
                } catch (error) {
                    console.error(
                        `[Plugin HMR] Error hot reloading ${data.pluginName}:`,
                        error
                    );
                } finally {
                    reloadingPlugins.delete(data.pluginName);
                }
            }
        );
    };

    // Check if we need to set up hot reload immediately or wait
    if (getPlugins().length > 0 && getHighlite()) {
        setupPluginHotReload();
    } else {
        // Wait a bit for plugins to be available
        setTimeout(() => {
            if (getPlugins().length > 0 && getHighlite()) {
                setupPluginHotReload();
            }
        }, 100);
    }
}
