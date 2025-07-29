function element(selector: string): HTMLElement {
    return document.getElementById(selector)!;
}

// Update Progress
const updateStatus = element('update-status')!;

// Obtain the update progress from the main process
window.electron.ipcRenderer.on('download-progress', (_, progress) => {
    // Round the progress to the nearest integer
    progress = Math.round(progress);
    updateStatus.textContent = `Downloading update...`;
    element('progressText')!.innerText = `${progress}%`;
});

window.electron.ipcRenderer.on('update-downloaded', _ => {
    console.log('Update downloaded');
    updateStatus.textContent = `Update Ready!`;
    element('progressLoader').style.visibility = 'hidden';
    element('restartNow').style.display = 'block';
    element('restartLater').style.display = 'block';
    element('updateNow').style.display = 'none';
    element('updateLater').style.display = 'none';
});

window.electron.ipcRenderer.on('update-available', (_, releaseInfo) => {
    updateStatus.textContent =
        'Update to ' + releaseInfo.releaseName + ' Available!';
    element('progressLoader').style.visibility = 'hidden';
    element('updateNow').style.display = 'block';
    element('updateLater').style.display = 'block';
    element('update-change').style.display = 'flex';

    element('releaseNotes').innerHTML = releaseInfo.releaseNotes;
});

// When updateNow is clicked, send the install-update event to the main process
element('updateNow').addEventListener('click', () => {
    window.electron.ipcRenderer.send('download-update');

    // Disable the buttons
    element('update-change').style.display = 'none';
    element('updateNow').style.display = 'none';
    element('updateLater').style.display = 'none';

    updateStatus.textContent = `Downloading update...`;
    element('progressLoader').style.visibility = 'visible';
    element('progressText').style.display = 'flex';

    element('progressText').innerText = `0%`;
});

element('restartNow').addEventListener('click', () => {
    window.electron.ipcRenderer.send('install-update');
    // Disable the buttons
    (element('restartNow') as HTMLButtonElement).disabled = true;
    (element('restartLater') as HTMLButtonElement).disabled = true;
});

element('restartLater').addEventListener('click', () => {
    window.electron.ipcRenderer.send('delay-update');
    // Disable the buttons
    (element('restartNow') as HTMLButtonElement).disabled = true;
    (element('restartLater') as HTMLButtonElement).disabled = true;
});

element('updateLater').addEventListener('click', () => {
    window.electron.ipcRenderer.send('delay-update');
    // Disable the buttons
    (element('updateNow') as HTMLButtonElement).disabled = true;
    (element('updateLater') as HTMLButtonElement).disabled = true;
});
