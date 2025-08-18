



const { app, BrowserWindow, session } = require('electron');
const path = require('path');
require('dotenv').config();

const { isDev } = require('./constants');
const { setupInitialFilesystem } = require('./setup');
const { initializeIpcHandlers } = require('./ipc');
const { startApiServer } = require('./api');
const { startTerminusServer } = require('./ws-terminus');
const { startSftpServer } = require('./ws-sftp');
const { startChrome3Proxy } = require('./proxy-chrome3'); // Import the new SOCKS5 proxy client
const { setupHeaderStripping } = require('./header-stripper');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            // Correct path to preload script, going up one level from 'main'
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true, // Enable <webview> tag for apps like Chrome 3
        },
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 15, y: 15 },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        // Correct path to production build, going up one level from 'main'
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }
}

app.whenReady().then(() => {
    setupInitialFilesystem();
    initializeIpcHandlers();
    
    startApiServer();
    startTerminusServer();
    startSftpServer();
    startChrome3Proxy(); // Start the new SOCKS5 proxy client for Chrome 3
    
    // Apply header stripping to enable loading restricted sites in webviews
    setupHeaderStripping('persist:chrome1');
    setupHeaderStripping('persist:chrome3');
    // Re-enabling header stripping for Chrome 4. Its absence may be causing renderer
    // crashes on sites with aggressive anti-embedding policies.
    setupHeaderStripping('persist:chrome4');

    const frameBusterPath = path.join(__dirname, 'frame-buster.js');

    // Add preload script to defeat frame-busting JS
    try {
        const chrome1Session = session.fromPartition('persist:chrome1');
        chrome1Session.setPreloads([frameBusterPath]);
        console.log(`[Main] Frame-buster preload script set for partition 'persist:chrome1'`);

        const chrome3Session = session.fromPartition('persist:chrome3');
        chrome3Session.setPreloads([frameBusterPath]);
        console.log(`[Main] Frame-buster preload script set for partition 'persist:chrome3'`);

        const chrome4Session = session.fromPartition('persist:chrome4');
        chrome4Session.setPreloads([frameBusterPath]);
        console.log(`[Main] Frame-buster preload script set for partition 'persist:chrome4'`);

    } catch (error) {
        console.error(`[Main] Failed to set preload scripts:`, error);
    }
    
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});