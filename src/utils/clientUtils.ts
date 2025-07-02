import { IndexDBWrapper } from "../renderer/client/helpers/IndexDBWrapper";

export async function obtainGameClient(ignoreDB: boolean = false) {
    const highspellAssetsURL = "https://highspell.com:3002/assetsClient";
    let highliteDB: IndexDBWrapper | null = null;
    let clientLastVersion: number = 0;
    if(!ignoreDB) {
        highliteDB = new IndexDBWrapper();
        await highliteDB.init();            
        // Check if clientLastVersion is set
        clientLastVersion = await highliteDB.getItem("clientLastVersion") || 0;
    }


    // Get Asset JSON to determine latest version
    const highSpellAssetJSON = (await (await fetch(highspellAssetsURL)).json());
    const remoteLastVersion = highSpellAssetJSON.data.latestClientVersion;

    let highSpellClient = "";
    if (clientLastVersion == undefined || clientLastVersion < remoteLastVersion) {
        console.log("[Highlite Loader] High Spell Client Version is outdated, updating...");
        const highSpellClientURL = `https://highspell.com/js/client/client.${highSpellAssetJSON.data.latestClientVersion}.js`;
        console.log(highSpellClientURL);
        highSpellClient = (await (await fetch(highSpellClientURL + "?time=" + Date.now())).text());
        highSpellClient = highSpellClient.substring(0, highSpellClient.length - 9)
        + "; document.client = {};"
        + "document.client.get = function(a) {"
        + "return eval(a);"
        + "};"
        + "document.client.set = function(a, b) {"
        + "eval(a + ' = ' + b);"
        + "};"
        + highSpellClient.substring(highSpellClient.length - 9)

        if(highliteDB) {
            await highliteDB.setItem("highSpellClient", highSpellClient);
            await highliteDB.setItem("clientLastVersion", remoteLastVersion);
        }
        console.log("[Highlite Loader] High Spell Client Version " + highSpellAssetJSON.data.latestClientVersion + " downloaded.");
    } else {
        console.log("[Highlite Loader] High Spell Client Version is up to date.");
        if(highliteDB) {
            highSpellClient = await highliteDB.getItem("highSpellClient");
        }
    }

    return Promise.resolve(highSpellClient);
}
