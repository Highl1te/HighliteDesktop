// Update Progress
const updateStatus = document.getElementById('update-status');

// Obtain the update progress from the main process
window.electron.ipcRenderer.on('download-progress', (_, progress) => {
    // Round the progress to the nearest integer
    progress = Math.round(progress);
    updateStatus.textContent = `Downloading update...`;
    document.getElementById("progressText").innerText = `${progress}%`;
});

window.electron.ipcRenderer.on('update-downloaded', (_) => {
    console.log('Update downloaded');
    updateStatus.textContent = `Update Ready!`;
    document.getElementById('progressLoader').style.visibility = 'hidden';
    document.getElementById('restartNow').style.display = 'block';
    document.getElementById('restartLater').style.display = 'block'
    document.getElementById('updateNow').style.display = 'none';
    document.getElementById('updateLater').style.display = 'none';
    
});

window.electron.ipcRenderer.on('update-available', (_, releaseInfo) => {
    updateStatus.textContent = "Update to " + releaseInfo.releaseName + " Available!";
    document.getElementById('progressLoader').style.visibility = 'hidden';
    document.getElementById('updateNow').style.display = 'block';
    document.getElementById('updateLater').style.display = 'block';
    document.getElementById('update-change').style.display = 'flex';

    document.getElementById('releaseNotes').innerHTML = releaseInfo.releaseNotes;
});

// When updateNow is clicked, send the install-update event to the main process
document.getElementById('updateNow').addEventListener('click', () => {
    window.electron.ipcRenderer.send('download-update');


    // Disable the buttons
    document.getElementById('update-change').style.display = 'none';
    document.getElementById('updateNow').style.display = 'none';
    document.getElementById('updateLater').style.display = 'none';

    updateStatus.textContent = `Downloading update...`;
    document.getElementById('progressLoader').style.visibility = 'visible';
    document.getElementById("progressText").style.display = 'flex';

    document.getElementById("progressText").innerText = `0%`;
});

document.getElementById('restartNow').addEventListener('click', () => {
    window.electron.ipcRenderer.send('install-update');
    // Disable the buttons
    (document.getElementById('restartNow') as HTMLButtonElement).disabled = true;
    (document.getElementById('restartLater') as HTMLButtonElement).disabled = true;
});

document.getElementById('restartLater').addEventListener('click', () => {
    window.electron.ipcRenderer.send('delay-update');
    // Disable the buttons
    (document.getElementById('restartNow') as HTMLButtonElement).disabled = true;
    (document.getElementById('restartLater') as HTMLButtonElement).disabled = true;
});

document.getElementById('updateLater').addEventListener('click', () => {
    window.electron.ipcRenderer.send('delay-update');
    // Disable the buttons
    (document.getElementById('updateNow') as HTMLButtonElement).disabled = true;
    (document.getElementById('updateLater')as HTMLButtonElement).disabled = true;
});