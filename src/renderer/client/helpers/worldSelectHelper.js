// Fetches and parses world data from https://highspell.com/play
export async function fetchWorlds() {
    const res = await fetch('https://highspell.com/play');
    const html = await res.text();
    // Parse worlds using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const worldRows = Array.from(doc.querySelectorAll('#server_data .hs_data__row')).slice(1); // skip header
    return worldRows.map(row => {
        const worldName = row.querySelector('input[type="submit"]')?.value || '';
        const serverId = row.querySelector('input[name="serverid"]')?.value || '';
        const serverUrl = row.querySelector('input[name="serverurl"]')?.value || '';
        const playerCount = row.querySelector('.server_data__row__playercount')?.textContent?.trim() || '';
        return {
            worldName,
            serverId,
            serverUrl,
            playerCount: Number(playerCount)
        };
    });
}

// Global state to prevent multiple instances
let worldSelectorInstance = null;
let observer = null;
let checkInterval = null; // <-- Add this line

// Function to show loading screen
function showLoadingScreen(worldName) {
    // Create loading overlay
    const loadingOverlay = document.createElement("div");
    loadingOverlay.id = "world-select-loading";
    loadingOverlay.style.position = "fixed";
    loadingOverlay.style.top = "0";
    loadingOverlay.style.left = "0";
    loadingOverlay.style.width = "100%";
    loadingOverlay.style.height = "100%";
    loadingOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    loadingOverlay.style.backdropFilter = "blur(4px)";
    loadingOverlay.style.display = "flex";
    loadingOverlay.style.flexDirection = "column";
    loadingOverlay.style.justifyContent = "center";
    loadingOverlay.style.alignItems = "center";
    loadingOverlay.style.zIndex = "9999";
    loadingOverlay.style.color = "#fff";
    loadingOverlay.style.fontFamily = "'Segoe UI', 'Roboto', 'Arial', sans-serif";
    
    // Create spinner
    const spinner = document.createElement("div");
    spinner.style.width = "60px";
    spinner.style.height = "60px";
    spinner.style.border = "4px solid rgba(255, 255, 255, 0.3)";
    spinner.style.borderTop = "4px solid #ffd700";
    spinner.style.borderRadius = "50%";
    spinner.style.animation = "spin 1s linear infinite";
    spinner.style.marginBottom = "1.5rem";
    
    // Create message
    const message = document.createElement("div");
    message.style.fontSize = "1.25rem";
    message.style.fontWeight = "600";
    message.style.textAlign = "center";
    message.style.lineHeight = "1.4";
    message.innerHTML = `🌍 Switching to <strong>${worldName}</strong><br><span style="font-size: 0.9rem; opacity: 0.8; font-weight: 400;">Please wait...</span>`;
    
    // Add CSS animation
    const style = document.createElement("style");
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Append elements
    loadingOverlay.appendChild(spinner);
    loadingOverlay.appendChild(message);
    document.body.appendChild(loadingOverlay);
    
    // Remove loading screen after a short delay
    setTimeout(() => {
        if (loadingOverlay.parentNode) {
            loadingOverlay.remove();
        }
        // Clear the URL parameter
        const url = new URL(window.location);
        url.searchParams.delete('loading');
        window.history.replaceState({}, '', url);
    }, 3000);
}

// Function to check and show loading screen on page load
function checkAndShowLoadingScreen() {
    const url = new URL(window.location);
    const loadingWorld = url.searchParams.get('loading');
    if (loadingWorld) {
        showLoadingScreen(loadingWorld);
    }
}

// Function to get URL parameter
function getUrlParam(name) {
    const url = new URL(window.location);
    return url.searchParams.get(name);
}

// Function to set URL parameter
function setUrlParam(name, value) {
    const url = new URL(window.location);
    if (value) {
        url.searchParams.set(name, value);
    } else {
        url.searchParams.delete(name);
    }
    window.history.replaceState({}, '', url);
}

// Call this on page load
checkAndShowLoadingScreen();

// Clean up existing world selector
function cleanupWorldSelector() {
    if (worldSelectorInstance) {
        worldSelectorInstance.remove();
        worldSelectorInstance = null;
    }
}

// Creates and injects the world selector dropdown
export function createWorldSelector() {
    const gameContainer = document.querySelector("#game-container");
    
    console.log("createWorldSelector called", { 
        gameContainer: !!gameContainer, 
        existingWorldSelect: !!document.getElementById("world-select") 
    });
    
    // Prevent multiple instances
    if (!gameContainer || document.getElementById("world-select")) {
        console.log("Early return - no game container or world select already exists");
        return;
    }
    
    // Clean up any existing instance
    cleanupWorldSelector();
    
    // Create world selector container
    const worldSelectorContainer = document.createElement("div");
    worldSelectorContainer.id = "world-select";
    worldSelectorContainer.style.position = "absolute";
    worldSelectorContainer.style.bottom = "0px";
    worldSelectorContainer.style.left = "0px";
    worldSelectorContainer.style.margin = "0rem 1rem 1rem";
    worldSelectorContainer.style.zIndex = "1000";
    worldSelectorContainer.style.padding = "0.5rem 1rem";
    worldSelectorContainer.style.background = "rgba(34, 34, 34, 0.85)";
    worldSelectorContainer.style.backdropFilter = "blur(6px)";
    worldSelectorContainer.style.borderRadius = "0.75rem";
    worldSelectorContainer.style.boxShadow = "0 2px 12px 0 rgba(0,0,0,0.18)";
    worldSelectorContainer.style.display = "flex";
    worldSelectorContainer.style.flexDirection = "column";
    worldSelectorContainer.style.alignItems = "flex-start";
    worldSelectorContainer.style.gap = "0.25rem";
    
    // Create a flex row for emoji and select
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexDirection = "row";
    row.style.alignItems = "center";
    row.style.gap = "0.5rem";

    // Create globe emoji
    const globe = document.createElement("span");
    globe.textContent = "🌍";
    globe.style.fontSize = "1rem";
    globe.style.display = "inline-block";
    globe.style.verticalAlign = "middle";
    globe.style.marginRight = "0.05rem";

    // Create select element
    const select = document.createElement("select");
    select.id = "world-select-dropdown";
    select.style.background = "rgba(48, 48, 48, 0.95)";
    select.style.color = "#fff";
    select.style.border = "1px solid #444";
    select.style.borderRadius = "0.375rem";
    select.style.padding = "0.375rem 2rem 0.375rem 0.75rem";
    select.style.fontSize = "0.875rem";
    select.style.fontWeight = "500";
    select.style.fontFamily = "'Segoe UI', 'Roboto', 'Arial', sans-serif";
    select.style.cursor = "pointer";
    select.style.width = "200px";
    select.style.boxShadow = "0 1px 4px 0 rgba(0,0,0,0.10)";
    select.style.transition = "border-color 0.2s, box-shadow 0.2s, background 0.2s";
    select.style.outline = "none";
    select.style.appearance = "none";
    select.style.backgroundImage = "url('data:image/svg+xml;utf8,<svg fill=\'%23fff\' height=\'16\' viewBox=\'0 0 24 24\' width=\'16\' xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M7 10l5 5 5-5z\'/></svg>')";
    select.style.backgroundRepeat = "no-repeat";
    select.style.backgroundPosition = "right 0.5rem center";
    select.style.backgroundSize = "1rem";

    // Add focus and hover effect
    select.addEventListener('focus', () => {
        select.style.borderColor = "#6cf";
        select.style.boxShadow = "0 0 0 2px #6cf55a44";
        select.style.background = "rgba(60, 60, 60, 1)";
    });
    select.addEventListener('blur', () => {
        select.style.borderColor = "#444";
        select.style.boxShadow = "0 2px 8px 0 rgba(0,0,0,0.10)";
        select.style.background = "rgba(48, 48, 48, 0.95)";
    });
    select.addEventListener('mouseenter', () => {
        select.style.background = "rgba(60, 60, 60, 1)";
    });
    select.addEventListener('mouseleave', () => {
        select.style.background = "rgba(48, 48, 48, 0.95)";
    });

    // Function to update form inputs
    function updateFormInputs(world) {
        console.log("Updating form inputs for world:", world);
        const serverIdInput = document.getElementById('server-id-input');
        const serverUrlInput = document.getElementById('server-url');
        if (serverIdInput) serverIdInput.value = world.serverId;
        if (serverUrlInput) serverUrlInput.value = world.serverUrl;
    }
    
    // Add change event listener
    select.addEventListener('change', (e) => {
        const selectedWorld = worlds.find(w => w.serverId === e.target.value);
        if (selectedWorld) {
            console.log("World selected:", selectedWorld);
            // Store selected serverId in localStorage
            setUrlParam('selectedServerId', selectedWorld.serverId);
            // Store loading state in sessionStorage for the reload
            setUrlParam('loading', selectedWorld.worldName);
            // Reload the page
            window.location.reload();
        }
    });
    
    // Fetch and populate worlds
    let worlds = [];
    fetchWorlds().then(fetchedWorlds => {
        worlds = fetchedWorlds;
        console.log("Fetched worlds:", worlds);
        
        // Create options
        worlds.forEach((world) => {
            const option = document.createElement("option");
            option.value = world.serverId;
            option.textContent = `${world.worldName} (${world.playerCount} players)`;
            select.appendChild(option);
        });
        
        // Now safe to use worlds:
        let storedServerId = getUrlParam('selectedServerId');
        if (storedServerId) {
            const storedWorld = worlds.find(w => w.serverId === storedServerId);
            if (storedWorld) {
                select.value = storedWorld.serverId;
                updateFormInputs(storedWorld);
            }
            setUrlParam('selectedServerId', null); // Clear URL parameter after use
        } else {
            // Try to select based on hidden input value
            const serverIdInput = document.getElementById('server-id-input');
            let selectedWorld = null;
            if (serverIdInput && serverIdInput.value) {
                selectedWorld = worlds.find(w => w.serverId === serverIdInput.value);
            }
            // Fallback to default
            if (!selectedWorld) {
                selectedWorld = worlds.find(w => w.serverId === '1') || worlds[0];
            }
            if (selectedWorld) {
                select.value = selectedWorld.serverId;
                updateFormInputs(selectedWorld);
            }
        }
        
        console.log("World selector setup complete");
    }).catch(error => {
        console.error('Failed to fetch worlds:', error);
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Failed to load worlds";
        select.appendChild(option);
    });
    
    // Append row to container
    row.appendChild(globe);
    row.appendChild(select);
    worldSelectorContainer.appendChild(row);
    // Always append the container to the game container
    gameContainer.appendChild(worldSelectorContainer);
    worldSelectorInstance = worldSelectorContainer;
    console.log("World selector created and appended", worldSelectorContainer);
}

// Observer to watch for login screen and game container, and inject/remove world selector
export function setupWorldSelectorObserver() {
    // Clean up existing observer
    if (observer) {
        observer.disconnect();
    }
    // Clean up existing interval
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }

    function shouldShowWorldSelect() {
        return document.querySelector('#login-screen-container') && document.querySelector('#game-container');
    }

    // Initial check
    if (shouldShowWorldSelect() && !document.getElementById("world-select")) {
        createWorldSelector();
    } else if (!shouldShowWorldSelect() && document.getElementById("world-select")) {
        cleanupWorldSelector();
    }

    observer = new MutationObserver(() => {
        if (shouldShowWorldSelect() && !document.getElementById("world-select")) {
            createWorldSelector();
        } else if (!shouldShowWorldSelect() && document.getElementById("world-select")) {
            cleanupWorldSelector();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Add a fallback periodic check
    checkInterval = setInterval(() => {
        if (shouldShowWorldSelect() && !document.getElementById("world-select")) {
            createWorldSelector();
        } else if (!shouldShowWorldSelect() && document.getElementById("world-select")) {
            cleanupWorldSelector();
        }
    }, 1000);

    // Clear the interval after 30 seconds
    setTimeout(() => {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }, 30000);
}

// Cleanup function for when the component is destroyed
export function cleanupWorldSelectorObserver() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    cleanupWorldSelector();
}

// Manual trigger function for testing
export function forceCreateWorldSelector() {
    console.log("Force creating world selector");
    cleanupWorldSelector();
    createWorldSelector();
}
