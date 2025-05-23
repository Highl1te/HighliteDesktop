const { ipcRenderer } = require('electron');

ipcRenderer.on('set-profile', (event, data) => {
    document.highliteProfile = data.profile;
});
