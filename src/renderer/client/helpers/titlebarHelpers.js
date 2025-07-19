let ogError = console.error;
console.error = function (...args) {
    ogError(...args);
    const warningIndicator = document.querySelector('#warningIndicator');
    const warningIcon = document.querySelector(
        '#warningIndicator .warning-icon'
    );
    if (warningIndicator && warningIcon) {
        // Remove any existing warning classes and add error class
        warningIcon.classList.remove('warning');
        warningIcon.classList.add('error');
        warningIndicator.style.display = 'flex';
    }
    // On click open dev tools
    if (warningIndicator) {
        warningIndicator.onclick = () => {
            window.electron.ipcRenderer.send('show-dev-tools');
            // Clear the warning classes and hide the indicator
            const warningIcon = document.querySelector(
                '#warningIndicator .warning-icon'
            );
            if (warningIcon) {
                warningIcon.classList.remove('warning', 'error');
            }
            warningIndicator.style.display = 'none';
        };
    }
};

let ogWarn = console.warn;
console.warn = function (...args) {
    ogWarn(...args);
    const warningIndicator = document.querySelector('#warningIndicator');
    const warningIcon = document.querySelector(
        '#warningIndicator .warning-icon'
    );
    if (warningIndicator && warningIcon) {
        // Only set warning class if there's no error class (errors take precedence)
        if (!warningIcon.classList.contains('error')) {
            warningIcon.classList.add('warning');
        }
        warningIndicator.style.display = 'flex';
    }
    // On click open dev tools
    if (warningIndicator) {
        warningIndicator.onclick = () => {
            window.electron.ipcRenderer.send('show-dev-tools');
            // Clear the warning classes and hide the indicator
            const warningIcon = document.querySelector(
                '#warningIndicator .warning-icon'
            );
            if (warningIcon) {
                warningIcon.classList.remove('warning', 'error');
            }
            warningIndicator.style.display = 'none';
        };
    }
};

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

const isDarwin = window.electron.process.platform === 'darwin';

// Hide the window controls if the OS is Darwin (macOS)
if(isDarwin) {
    document.getElementById('window-controls').remove();
} else {
    document.getElementById('darwin-spacer').remove();
}

export function setTitle(title) {
    document.title = title;
    const logoText = document.getElementById('logoText');
    if (logoText) {
        logoText.textContent = title;
    }
}
