const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const express = require('express');
const cors = require('cors');

// Load environment variables from a .env file if it exists
require('dotenv').config();

const isDev = !app.isPackaged;
const API_PORT = 3001;

// --- Filesystem Setup ---
const FS_ROOT = __dirname;

function resolvePath(relativePath) {
  // Ensure the resolved path does not go "above" the FS_ROOT. This is a security measure.
  const fullPath = path.join(FS_ROOT, relativePath);
  if (!fullPath.startsWith(FS_ROOT)) {
      throw new Error('Access denied: Path is outside of the allowed root directory.');
  }
  return fullPath;
}

function setupInitialFilesystem() {
    console.log('Ensuring essential directories exist in project root...');
    const directoriesToEnsure = ['Desktop', 'Documents', 'Downloads'];
    directoriesToEnsure.forEach(dir => {
        const dirPath = path.join(FS_ROOT, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });
    const desktopPath = path.join(FS_ROOT, 'Desktop');
    const defaultApps = [
        { appId: 'appStore', name: 'App Store' },
        { appId: 'fileExplorer', name: 'File Explorer' },
        { appId: 'settings', name: 'Settings' },
    ];
    defaultApps.forEach(appDef => {
        const appShortcutPath = path.join(desktopPath, `${appDef.name}.app`);
        if (!fs.existsSync(appShortcutPath)) {
            const shortcutContent = JSON.stringify({ appId: appDef.appId });
            fs.writeFileSync(appShortcutPath, shortcutContent);
        }
    });
}

// --- API Server Setup ---
const apiApp = express();
apiApp.use(cors()); // Allow requests from our Vite dev server
apiApp.use(express.json()); // Middleware to parse JSON bodies

// API endpoint to provide the API key
apiApp.get('/api/get-key', (req, res) => {
    res.json({ apiKey: process.env.API_KEY });
});

// All filesystem APIs are prefixed with /api/fs
const fsRouter = express.Router();

fsRouter.get('/list', async (req, res) => {
    try {
        const relativePath = req.query.path || '/';
        const dirPath = resolvePath(relativePath);
        if (!fs.existsSync(dirPath)) return res.json([]);
        const files = await fs.promises.readdir(dirPath);
        const items = await Promise.all(
            files.map(async (file) => {
                const itemPath = path.join(dirPath, file);
                const stats = await fs.promises.stat(itemPath);
                const item = {
                    name: file,
                    path: path.join(relativePath, file).replace(/\\/g, '/'),
                    type: stats.isDirectory() ? 'folder' : 'file',
                };
                if (file.endsWith('.app')) {
                    try {
                        item.content = await fs.promises.readFile(itemPath, 'utf-8');
                    } catch (e) { /* ignore */ }
                }
                return item;
            })
        );
        res.json(items);
    } catch (error) {
        console.error(`API Error listing directory ${req.query.path}:`, error);
        res.status(500).json({ error: 'Failed to list directory' });
    }
});

fsRouter.get('/read', async (req, res) => {
    try {
        const relativePath = req.query.path;
        const filePath = resolvePath(relativePath);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        res.json({ name: path.basename(relativePath), path: relativePath, content });
    } catch (error) {
        console.error(`API Error reading file ${req.query.path}:`, error);
        res.status(500).json({ error: 'Failed to read file' });
    }
});

fsRouter.post('/save', async (req, res) => {
    try {
        const { path: relativePath, content } = req.body;
        const filePath = resolvePath(relativePath);
        await fs.promises.writeFile(filePath, content, 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error(`API Error saving file ${req.body.path}:`, error);
        res.status(500).json({ error: 'Failed to save file' });
    }
});

fsRouter.post('/find-unique-name', (req, res) => {
    const { destinationPath: destRelativePath, baseName, isFolder, extension } = req.body;
    const destPath = resolvePath(destRelativePath);
    let counter = 0;
    let newName = `${baseName}${isFolder ? '' : extension}`;
    let fullPath = path.join(destPath, newName);
    while (fs.existsSync(fullPath)) {
        counter++;
        newName = `${baseName} (${counter})${isFolder ? '' : extension}`;
        fullPath = path.join(destPath, newName);
    }
    res.json({ name: newName });
});

fsRouter.post('/create-folder', async (req, res) => {
    try {
        const { path: relativePath, name } = req.body;
        await fs.promises.mkdir(resolvePath(path.join(relativePath, name)), { recursive: true });
        res.json({ success: true });
    } catch (error) {
        console.error(`API Error creating folder:`, error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

fsRouter.post('/create-file', async (req, res) => {
    try {
        const { path: relativePath, name, content } = req.body;
        await fs.promises.writeFile(resolvePath(path.join(relativePath, name)), content, 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error(`API Error creating file:`, error);
        res.status(500).json({ error: 'Failed to create file' });
    }
});

fsRouter.post('/create-shortcut', async (req, res) => {
    try {
        const { appId, appName } = req.body;
        const shortcutPath = resolvePath(path.join('Desktop', `${appName}.app`));
        const shortcutContent = JSON.stringify({ appId });
        await fs.promises.writeFile(shortcutPath, shortcutContent, 'utf-8');
        res.json({ success: true });
    } catch (error) {
        console.error(`API Error creating shortcut:`, error);
        res.status(500).json({ error: 'Failed to create shortcut' });
    }
});

fsRouter.post('/delete', async (req, res) => {
    try {
        const item = req.body.item;
        const itemPath = resolvePath(item.path);
        if (item.type === 'folder') {
            await fs.promises.rm(itemPath, { recursive: true, force: true });
        } else {
            await fs.promises.unlink(itemPath);
        }
        res.json({ success: true });
    } catch (error) {
        console.error(`API Error deleting item:`, error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

fsRouter.post('/rename', async (req, res) => {
    try {
        const { item, newName } = req.body;
        const oldPath = resolvePath(item.path);
        const newPath = resolvePath(path.join(path.dirname(item.path), newName));
        await fs.promises.rename(oldPath, newPath);
        res.json({ success: true });
    } catch (error) {
        console.error(`API Error renaming item:`, error);
        res.status(500).json({ error: 'Failed to rename item' });
    }
});

fsRouter.post('/move', async (req, res) => {
    try {
        const { sourceItem, destinationPath } = req.body;
        const sourcePath = resolvePath(sourceItem.path);
        const destPath = resolvePath(path.join(destinationPath, sourceItem.name));
        await fs.promises.rename(sourcePath, destPath);
        res.json({ success: true });
    } catch (error) {
        console.error(`API Error moving item:`, error);
        res.status(500).json({ error: 'Failed to move item' });
    }
});

fsRouter.post('/copy', async (req, res) => {
    try {
        const { sourceItem, destinationPath } = req.body;
        const sourcePath = resolvePath(sourceItem.path);
        const destPath = resolvePath(path.join(destinationPath, sourceItem.name));
        await fs.promises.cp(sourcePath, destPath, { recursive: true });
        res.json({ success: true });
    } catch (error) {
        console.error(`API Error copying item:`, error);
        res.status(500).json({ error: 'Failed to copy item' });
    }
});

apiApp.use('/api/fs', fsRouter);

// --- Electron App Window ---

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  setupInitialFilesystem();
  
  // Start the API server
  apiApp.listen(API_PORT, () => {
    console.log(`✅ API server listening on http://localhost:${API_PORT}`);
  });
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- Electron-Specific IPC Handlers ---
// This remains as an IPC handler because it's a capability unique to Electron.
ipcMain.handle('app:launchExternal', (event, relativeAppPath) => {
    try {
        const appDir = path.join(__dirname, relativeAppPath);
        console.log(`Attempting to launch external app from: ${appDir}`);
        const child = spawn(process.execPath, ['.'], {
            cwd: appDir,
            detached: true,
            stdio: 'inherit',
        });
        child.on('error', (err) => console.error(`Failed to start subprocess for ${appDir}:`, err));
        child.unref();
        return true;
    } catch (error) {
        console.error('Error launching external app:', error);
        return false;
    }
});