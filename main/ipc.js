const { ipcMain } = require('electron');
const { launchExternalAppByPath } = require('./launcher');

function initializeIpcHandlers() {
    ipcMain.handle('app:launchExternal', (event, relativeAppPath) => {
        return launchExternalAppByPath(relativeAppPath);
    });
}

module.exports = { initializeIpcHandlers };