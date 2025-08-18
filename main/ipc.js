const { ipcMain, session } = require('electron');
const { launchExternalAppByPath } = require('./launcher');

function initializeIpcHandlers() {
    ipcMain.handle('app:launchExternal', (event, relativeAppPath, args) => {
        return launchExternalAppByPath(relativeAppPath, args);
    });

    // Handle setting a proxy for a specific webview session
    ipcMain.handle('session:set-proxy', async (event, partition, config) => {
        if (!partition) return;
        try {
            const ses = session.fromPartition(partition);
            await ses.setProxy(config);
            console.log(`Proxy set for partition ${partition} with rules: ${config.proxyRules}`);
        } catch (error) {
            console.error(`Failed to set proxy for partition ${partition}:`, error);
        }
    });

    // Handle clearing the proxy for a specific webview session
    ipcMain.handle('session:clear-proxy', async (event, partition) => {
        if (!partition) return;
        try {
            const ses = session.fromPartition(partition);
            await ses.setProxy({ proxyRules: '' }); // Setting empty rules clears the proxy
             console.log(`Proxy cleared for partition ${partition}`);
        } catch (error) {
            console.error(`Failed to clear proxy for partition ${partition}:`, error);
        }
    });
}

module.exports = { initializeIpcHandlers };