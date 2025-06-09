let ogError = console.error;
console.error = function(...args) {
    ogError(...args);
    const warningIndicator = document.querySelector('#warningIndicator');
    if (warningIndicator) {
        warningIndicator.style.color = 'red';
        warningIndicator.display = 'unset';
    }
    // On click open dev tools
    warningIndicator.onclick = () => {
        window.electron.ipcRenderer.send('show-dev-tools');
        warningIndicator.style.display = 'none';
    };
};

let ogWarn = console.warn;
console.warn = function(...args) {
    ogWarn(...args);
    const warningIndicator = document.querySelector('#warningIndicator');
    if (warningIndicator) {
        if (warningIndicator.style.color !== 'red') {
            warningIndicator.style.color = 'yellow';
        }
        warningIndicator.style.display = 'unset';
    }
    // On click open dev tools
    warningIndicator.onclick = () => {
        window.electron.ipcRenderer.send('show-dev-tools');
        warningIndicator.style.display = 'none';
    };
};
setInterval(() => {
    const titlebar = document.querySelector('#iconbar');
    if (titlebar) {
        titlebar.style.left = `calc(env(titlebar-area-width, 100%) - ${titlebar.offsetWidth}px - 10px)`;
    }
}, 100);



// Obtain references to the minimize, maximize, and close buttons
const minimizeButton = document.querySelector('#minimizeBtn');
const maximizeButton = document.querySelector('#maximizeBtn');
const closeButton = document.querySelector('#closeBtn');

// Add click event listeners to the buttons
minimizeButton.addEventListener('click', () => {
    window.electron.ipcRenderer.send('minimize-window');
});
maximizeButton.addEventListener('click', () => {
    window.electron.ipcRenderer.send('toggle-maximize-window');
});
closeButton.addEventListener('click', () => {
    window.electron.ipcRenderer.send('close-window');
});

window.electron.ipcRenderer.on('is-darwin', (event, isDarwin) => {
    // Hide the window controls if the OS is Darwin (macOS)
    closeButton.style.display = isDarwin ? 'none' : 'block';
    minimizeButton.style.display = isDarwin ? 'none' : 'block';
    maximizeButton.style.display = isDarwin ? 'none' : 'block';
});

export function setTitle(title) {
    document.title = title;
    const logoText = document.getElementById('logoText');
    if (logoText) {
        logoText.textContent = title;
    }
};