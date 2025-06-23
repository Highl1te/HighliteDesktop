import { IndexDBWrapper } from "./helpers/IndexDBWrapper";
import { Highlite } from "./highlite/core/core";
import { HPAlert } from "./highlite/plugins/HPAlert";
import { IdleAlert } from "./highlite/plugins/IdleAlert/IdleAlert";
import { Lookup } from "./highlite/plugins/Lookup";
import { Nameplates } from "./highlite/plugins/Nameplates";
import { EnhancedHPBars } from "./highlite/plugins/EnhancedHPBars";
import { EnhancedLoginScreen } from "./highlite/plugins/EnhancedLoginScreen";
import { ContextMenuOptions } from "./highlite/plugins/ContextMenuOptions";
import { TradeAlerts } from "./highlite/plugins/TradeAlerts";
import { PMAlerts } from "./highlite/plugins/PMAlerts";
import { CoinCounter } from "./highlite/plugins/CoinCounter";
import { ExperienceTracker } from "./highlite/plugins/ExperienceTracker";
import { WorldMap } from "./highlite/plugins/Map";
import { MinimapMarker } from "./highlite/plugins/MinimapMarker";
import { DropLog } from "./highlite/plugins/DropLog";
import { ChatItemTooltip } from "./highlite/plugins/ChatItemTooltip";
import "../../../static/css/index.css"
import "../../../static/css/overrides.css"
import "@fortawesome/fontawesome-free/css/all.css"

import "./helpers/titlebarHelpers.js";
import { TreasureMapHelper } from "./highlite/plugins/TreasureMapLocator";


async function obtainGameClient() {
    const highspellAssetsURL = "https://highspell.com:3002/assetsClient";
    const highliteDB = new IndexDBWrapper();
    await highliteDB.init();

    // Check if clientLastVersion is set
    const clientLastVersion = await highliteDB.getItem("clientLastVersion");

    // Get Asset JSON to determine latest version
    const highSpellAssetJSON = (await (await fetch(highspellAssetsURL)).json());
    const remoteLastVersion = highSpellAssetJSON.data.latestClientVersion;

    let highSpellClient = "";
    if (clientLastVersion == undefined || clientLastVersion < remoteLastVersion) {
        console.log("[Highlite Loader] High Spell Client Version is outdated, updating...");
        const highSpellClientURL = `https://highspell.com/js/client/client.${highSpellAssetJSON.data.latestClientVersion}.js`;
        console.log(highSpellClientURL);
        highSpellClient = (await (await fetch(highSpellClientURL + "?time=" + Date.now())).text());
        console.log(highSpellClient);
        highSpellClient = highSpellClient.substring(0, highSpellClient.length - 9)
        + "; document.client = {};"
        + "document.client.get = function(a) {"
        + "return eval(a);"
        + "};"
        + "document.client.set = function(a, b) {"
        + "eval(a + ' = ' + b);"
        + "};"
        + highSpellClient.substring(highSpellClient.length - 9)
        await highliteDB.setItem("highSpellClient", highSpellClient);
        await highliteDB.setItem("clientLastVersion", remoteLastVersion);
        console.log("[Highlite Loader] High Spell Client Version " + highSpellAssetJSON.data.latestClientVersion + " downloaded.");
    } else {
        console.log("[Highlite Loader] High Spell Client Version is up to date.");
        highSpellClient = await highliteDB.getItem("highSpellClient");
    }

    return Promise.resolve(highSpellClient);
}

async function generatePage() {
    // POST Request to https://highspell.com/game
    const urlencoded = new URLSearchParams();
    urlencoded.append("submit", "World+1");
    urlencoded.append("serverid", "1");
    urlencoded.append("serverurl", "https://server1.highspell.com:8888");

    const response = await fetch("https://highspell.com/game", { method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: urlencoded, redirect: "follow"});
    const text = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");
    const clientJS = doc.querySelector('script[src*="/js/client/client"]')
    if (clientJS) {
        clientJS.remove();
    }
    
    // Replace head and body content (non-script)
    Array.from(doc.head.children).forEach(child => {
        if (child.tagName.toLowerCase() !== "script") {
            // If child has a relative href, update it to absolute
            if (child.hasAttribute("href")) {
                const href = child.getAttribute("href");
                if (href.startsWith("/")) {
                    child.setAttribute("href", "https://highspell.com" + href);
                }
            }
            document.head.appendChild(child.cloneNode(true));
        }
    });

    Array.from(doc.body.children).forEach(child => {
        if (child.tagName.toLowerCase() !== "script") {
            // If child has a relative href, update it to absolute
            if (child.hasAttribute("href")) {
                const href = child.getAttribute("href");
                if (href.startsWith("/")) {
                    child.setAttribute("href", "https://highspell.com" + href);
                }
            }

            // Append the child
            document.body.appendChild(child.cloneNode(true));
        }
    });

    // Process and inject scripts manually
    const scripts = doc.querySelectorAll("script");
    scripts.forEach(script => {
        const newScript = script.cloneNode(true);
        // if script was in head, append to head
        if (script.parentNode.tagName.toLowerCase() === "head") {
            document.head.appendChild(newScript);
        } else {
            // if script was in body, append to body
            document.body.appendChild(newScript);
        }
    });

    /* Find DOM elements with the attribute to= */
    const toElements = document.querySelectorAll("[to]");
    toElements.forEach(element => {
        const to = element.getAttribute("to");
        const targetElement = document.querySelector(to);

        // Check if the element has a before or after attribute
        const before = element.getAttribute("before");
        const after = element.getAttribute("after");

        // If before is set, insert the element before the target element
        if (before && !after) {
            const beforeElement = document.querySelector(before);
            if (beforeElement) {
                element.remove();
                beforeElement.parentNode.insertBefore(element, beforeElement);
            }
        } else if (after && !before) {
            // If after is set, insert the element after the target element
            const afterElement = document.querySelector(after);
            if (afterElement) {
                element.remove();
                afterElement.parentNode.insertBefore(element, afterElement.nextSibling);
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
            console.warn("Element has both before and after attributes. Peforming default behavior.");
            if (targetElement) {
                element.remove();
                targetElement.appendChild(element);
            }
        }
    });


    // Page Setup Completed, Add Game Client Script
    const clientScript = document.createElement("script");
    clientScript.id = "highspellClientScript"
    clientScript.textContent = await obtainGameClient();
    document.body.append(clientScript);

    // Page Setup Completed, Add User Helper Script
    import("./helpers/userHelper").then((module) => {
        module.createUserHelper();
    });

    const highlite = new Highlite();

    highlite.pluginManager.registerPlugin(HPAlert);  
    highlite.pluginManager.registerPlugin(IdleAlert);
    highlite.pluginManager.registerPlugin(Lookup);
    highlite.pluginManager.registerPlugin(Nameplates);
    highlite.pluginManager.registerPlugin(EnhancedHPBars);
    highlite.pluginManager.registerPlugin(EnhancedLoginScreen);
    highlite.pluginManager.registerPlugin(ContextMenuOptions);
    highlite.pluginManager.registerPlugin(TradeAlerts);
    highlite.pluginManager.registerPlugin(PMAlerts);
    highlite.pluginManager.registerPlugin(CoinCounter);
    highlite.pluginManager.registerPlugin(ExperienceTracker);
    highlite.pluginManager.registerPlugin(WorldMap);
    highlite.pluginManager.registerPlugin(MinimapMarker);
    highlite.pluginManager.registerPlugin(DropLog);
    highlite.pluginManager.registerPlugin(ChatItemTooltip);
    highlite.pluginManager.registerPlugin(TreasureMapHelper);
    // Start the highlite instance
    highlite.start();

    window.electron.ipcRenderer.send("ui-ready");

    // Fire a new DOMContentLoaded event
    document.dispatchEvent(new Event("DOMContentLoaded", {
        bubbles: true,
        cancelable: true
    }));
}


await generatePage();
