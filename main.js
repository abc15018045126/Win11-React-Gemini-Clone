const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Load environment variables from a .env file if it exists
require('dotenv').config();

// --- Filesystem Setup ---
const VIRTUAL_FS_ROOT = path.join(app.getPath('userData'), 'VirtualFS');

// Security: Ensure a given path is safely within our virtual filesystem root
function safeJoin(relativePath) {
  const absolutePath = path.join(VIRTUAL_FS_ROOT, relativePath);
  if (!absolutePath.startsWith(VIRTUAL_FS_ROOT)) {
    throw new Error('Path traversal attempt detected');
  }
  return absolutePath;
}

// Function to set up the initial directory structure and files on first launch
function setupInitialFilesystem() {
    if (fs.existsSync(VIRTUAL_FS_ROOT)) return;

    console.log('Performing first-time filesystem setup...');
    fs.mkdirSync(VIRTUAL_FS_ROOT, { recursive: true });

    const desktopPath = path.join(VIRTUAL_FS_ROOT, 'Desktop');
    fs.mkdirSync(desktopPath, { recursive: true });
    
    // Create default app shortcuts
    const defaultApps = [
        { appId: 'chrome', name: 'Chrome' },
        { appId: 'geminiChat', name: 'Gemini Chat' },
        { appId: 'fileExplorer', name: 'File Explorer' },
        { appId: 'hyper', name: 'Hyper' },
        { appId: 'about', name: 'About This PC' },
    ];

    defaultApps.forEach(app => {
        const appShortcutPath = path.join(desktopPath, `${app.name}.app`);
        const shortcutContent = JSON.stringify({ appId: app.appId });
        fs.writeFileSync(appShortcutPath, shortcutContent);
    });
}

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
      sandbox: false, // Required for preload script to work with fs
    },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
  });

  mainWindow.loadFile('index.html');

  // Open DevTools for debugging
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  setupInitialFilesystem();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers for Filesystem API ---

ipcMain.handle('get-api-key', () => {
  return process.env.API_KEY;
});

ipcMain.handle('fs:listDirectory', async (event, relativePath) => {
    try {
        const dirPath = safeJoin(relativePath);
        if (!fs.existsSync(dirPath)) return [];

        const files = await fs.promises.readdir(dirPath);
        const items = await Promise.all(
            files.map(async (file) => {
                const itemPath = path.join(dirPath, file);
                const stats = await fs.promises.stat(itemPath);
                return {
                    name: file,
                    path: path.join(relativePath, file).replace(/\\/g, '/'),
                    type: stats.isDirectory() ? 'folder' : 'file',
                };
            })
        );
        return items;
    } catch (error) {
        console.error(`Error listing directory ${relativePath}:`, error);
        return [];
    }
});

ipcMain.handle('fs:readFile', async (event, relativePath) => {
    try {
        const filePath = safeJoin(relativePath);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return {
            name: path.basename(relativePath),
            path: relativePath,
            content: content,
        };
    } catch (error) {
        console.error(`Error reading file ${relativePath}:`, error);
        return null;
    }
});

ipcMain.handle('fs:saveFile', async (event, relativePath, content) => {
    try {
        const filePath = safeJoin(relativePath);
        await fs.promises.writeFile(filePath, content, 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error saving file ${relativePath}:`, error);
        return false;
    }
});

ipcMain.handle('fs:findUniqueName', async (event, destRelativePath, baseName, isFolder, extension) => {
    const destPath = safeJoin(destRelativePath);
    let counter = 0;
    let newName = `${baseName}${isFolder ? '' : extension}`;
    let fullPath = path.join(destPath, newName);

    while (fs.existsSync(fullPath)) {
        counter++;
        newName = `${baseName} (${counter})${isFolder ? '' : extension}`;
        fullPath = path.join(destPath, newName);
    }
    return newName;
});

ipcMain.handle('fs:createFolder', async (event, relativePath, name) => {
    try {
        const folderPath = safeJoin(path.join(relativePath, name));
        await fs.promises.mkdir(folderPath, { recursive: true });
        return true;
    } catch (error) {
        console.error(`Error creating folder ${relativePath}/${name}:`, error);
        return false;
    }
});

ipcMain.handle('fs:createFile', async (event, relativePath, name, content) => {
    try {
        const filePath = safeJoin(path.join(relativePath, name));
        await fs.promises.writeFile(filePath, content, 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error creating file ${relativePath}/${name}:`, error);
        return false;
    }
});

ipcMain.handle('fs:deleteItem', async (event, item) => {
    try {
        const itemPath = safeJoin(item.path);
        if (item.type === 'folder') {
            await fs.promises.rm(itemPath, { recursive: true, force: true });
        } else {
            await fs.promises.unlink(itemPath);
        }
        return true;
    } catch (error) {
        console.error(`Error deleting item ${item.path}:`, error);
        return false;
    }
});

ipcMain.handle('fs:renameItem', async (event, item, newName) => {
    try {
        const oldPath = safeJoin(item.path);
        const newPath = safeJoin(path.join(path.dirname(item.path), newName));
        await fs.promises.rename(oldPath, newPath);
        return true;
    } catch (error) {
        console.error(`Error renaming item ${item.path} to ${newName}:`, error);
        return false;
    }
});

ipcMain.handle('fs:moveItem', async (event, sourceItem, destRelativePath) => {
    try {
        const sourcePath = safeJoin(sourceItem.path);
        const destPath = safeJoin(path.join(destRelativePath, sourceItem.name));
        await fs.promises.rename(sourcePath, destPath);
        return true;
    } catch (error) {
        console.error(`Error moving item ${sourceItem.path} to ${destRelativePath}:`, error);
        return false;
    }
});

ipcMain.handle('fs:copyItem', async (event, sourceItem, destRelativePath) => {
    try {
        const sourcePath = safeJoin(sourceItem.path);
        const destPath = safeJoin(path.join(destRelativePath, sourceItem.name));
        await fs.promises.cp(sourcePath, destPath, { recursive: true });
        return true;
    } catch (error) {
        console.error(`Error copying item ${sourceItem.path} to ${destRelativePath}:`, error);
        return false;
    }
});
