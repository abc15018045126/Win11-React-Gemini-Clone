const { app, BrowserWindow } = require('electron');
const path = require('path');
require('dotenv').config();

const { isDev } = require('./constants');
const { setupInitialFilesystem } = require('./setup');
const { initializeIpcHandlers } = require('./ipc');
const { startApiServer } = require('./api');
const { startTerminusServer } = require('./ws-terminus');
const { startSftpServer } = require('./ws-sftp');

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

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
