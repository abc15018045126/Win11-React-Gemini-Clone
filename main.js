const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Load environment variables from a .env file if it exists
require('dotenv').config();

const isDev = !app.isPackaged;

// --- Filesystem Setup ---
// Per user request, the root directory is now the application's directory (__dirname).
// WARNING: This allows the frontend to read and write files relative to the application's
// root directory. This is not secure for a production application but is implemented as requested.
const FS_ROOT = __dirname;

// Function to resolve a relative path from the frontend to a full path on the filesystem.
// The sandboxing from the original safeJoin has been removed as per user instructions.
function resolvePath(relativePath) {
  return path.join(FS_ROOT, relativePath);
}

// Function to ensure essential directories for the UI (like Desktop) exist.
function setupInitialFilesystem() {
    console.log('Ensuring essential directories exist in project root...');

    const directoriesToEnsure = ['Desktop', 'Documents', 'Downloads'];
    
    directoriesToEnsure.forEach(dir => {
        const dirPath = path.join(FS_ROOT, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Created directory: ${dirPath}`);
        }
    });
    
    // Create default app shortcuts on the desktop only if they don't exist.
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

  if (isDev) {
    // In development, load from the Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built HTML file
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
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

ipcMain.handle('app:launchExternal', (event, relativeAppPath) => {
    try {
        const appDir = path.join(__dirname, relativeAppPath);

        console.log(`Attempting to launch external app from: ${appDir}`);
        
        // process.execPath is the path to the electron executable
        const child = spawn(process.execPath, ['.'], {
            cwd: appDir,
            detached: true,
            stdio: 'inherit', // 'inherit' is useful for debugging child process output
        });

        child.on('error', (err) => {
            console.error(`Failed to start subprocess for ${appDir}:`, err);
        });
        
        child.on('exit', (code, signal) => {
            console.log(`External app process exited with code ${code} and signal ${signal}`);
        });

        child.unref();
        return true;
    } catch (error) {
        console.error('Error launching external app:', error);
        return false;
    }
});

ipcMain.handle('fs:listDirectory', async (event, relativePath) => {
    try {
        const dirPath = resolvePath(relativePath);
        if (!fs.existsSync(dirPath)) return [];

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
                // If it's an app shortcut, read its content to get the appId
                if (file.endsWith('.app')) {
                    try {
                        const content = await fs.promises.readFile(itemPath, 'utf-8');
                        item.content = content;
                    } catch (e) { /* ignore read errors for content */ }
                }
                return item;
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
        const filePath = resolvePath(relativePath);
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
        const filePath = resolvePath(relativePath);
        await fs.promises.writeFile(filePath, content, 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error saving file ${relativePath}:`, error);
        return false;
    }
});

ipcMain.handle('fs:findUniqueName', async (event, destRelativePath, baseName, isFolder, extension) => {
    const destPath = resolvePath(destRelativePath);
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
        const folderPath = resolvePath(path.join(relativePath, name));
        await fs.promises.mkdir(folderPath, { recursive: true });
        return true;
    } catch (error) {
        console.error(`Error creating folder ${relativePath}/${name}:`, error);
        return false;
    }
});

ipcMain.handle('fs:createFile', async (event, relativePath, name, content) => {
    try {
        const filePath = resolvePath(path.join(relativePath, name));
        await fs.promises.writeFile(filePath, content, 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error creating file ${relativePath}/${name}:`, error);
        return false;
    }
});

ipcMain.handle('fs:createAppShortcut', async (event, appId, appName) => {
    try {
        const shortcutPath = resolvePath(path.join('Desktop', `${appName}.app`));
        const shortcutContent = JSON.stringify({ appId });
        await fs.promises.writeFile(shortcutPath, shortcutContent, 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error creating app shortcut for ${appName}:`, error);
        return false;
    }
});

ipcMain.handle('fs:deleteItem', async (event, item) => {
    try {
        const itemPath = resolvePath(item.path);
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
        const oldPath = resolvePath(item.path);
        const newPath = resolvePath(path.join(path.dirname(item.path), newName));
        await fs.promises.rename(oldPath, newPath);
        return true;
    } catch (error) {
        console.error(`Error renaming item ${item.path} to ${newName}:`, error);
        return false;
    }
});

ipcMain.handle('fs:moveItem', async (event, sourceItem, destRelativePath) => {
    try {
        const sourcePath = resolvePath(sourceItem.path);
        const destPath = resolvePath(path.join(destRelativePath, sourceItem.name));
        await fs.promises.rename(sourcePath, destPath);
        return true;
    } catch (error) {
        console.error(`Error moving item ${sourceItem.path} to ${destRelativePath}:`, error);
        return false;
    }
});

ipcMain.handle('fs:copyItem', async (event, sourceItem, destRelativePath) => {
    try {
        const sourcePath = resolvePath(sourceItem.path);
        const destPath = resolvePath(path.join(destRelativePath, sourceItem.name));
        await fs.promises.cp(sourcePath, destPath, { recursive: true });
        return true;
    } catch (error) {
        console.error(`Error copying item ${sourceItem.path} to ${destRelativePath}:`, error);
        return false;
    }
});