const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');


// Load environment variables from a .env file if it exists
require('dotenv').config();

const isDev = !app.isPackaged;
const API_PORT = 3001;
const WS_PORT = 3002;
const SFTP_WS_PORT = 3003;

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

apiApp.get('/api/os-user', (req, res) => {
    try {
        res.json({ username: os.userInfo().username });
    } catch (error) {
        console.error('API Error getting OS user:', error);
        res.status(500).json({ error: 'Failed to get OS username' });
    }
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

// --- Terminus SSH WebSocket Server ---
const wss = new WebSocketServer({ port: WS_PORT });
const sshConnections = new Map();

wss.on('connection', (ws) => {
    const connectionId = Math.random().toString(36).substring(2, 15);
    console.log(`[Terminus] WebSocket client connected: ${connectionId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'connect') {
                const { host, username, password } = data.payload;
                const conn = new Client();
                sshConnections.set(connectionId, { ws, ssh: conn });

                conn.on('ready', () => {
                    ws.send(JSON.stringify({ type: 'status', payload: 'connected' }));
                    conn.shell({ term: 'xterm-256color' }, (err, stream) => {
                        if (err) {
                            ws.send(JSON.stringify({ type: 'error', payload: err.message }));
                            return;
                        }
                        
                        sshConnections.get(connectionId).stream = stream;

                        stream.on('close', () => {
                            conn.end();
                        }).on('data', (data) => {
                            ws.send(JSON.stringify({ type: 'data', payload: data.toString('utf8') }));
                        }).stderr.on('data', (data) => {
                            ws.send(JSON.stringify({ type: 'data', payload: data.toString('utf8') }));
                        });
                    });
                }).on('error', (err) => {
                    ws.send(JSON.stringify({ type: 'error', payload: `Connection Error: ${err.message}` }));
                    sshConnections.delete(connectionId);
                }).on('close', () => {
                    ws.send(JSON.stringify({ type: 'status', payload: 'disconnected' }));
                    sshConnections.delete(connectionId);
                }).connect({
                    host,
                    port: 22,
                    username,
                    password,
                    readyTimeout: 20000,
                });

            } else if (data.type === 'data') {
                const connection = sshConnections.get(connectionId);
                if (connection && connection.stream) {
                    connection.stream.write(data.payload);
                }
            } else if (data.type === 'resize') {
                const connection = sshConnections.get(connectionId);
                if (connection && connection.stream) {
                    connection.stream.setWindow(data.payload.rows, data.payload.cols);
                }
            } else if (data.type === 'disconnect') {
                const connection = sshConnections.get(connectionId);
                if (connection && connection.ssh) {
                    connection.ssh.end();
                }
            }

        } catch (e) {
            console.error('[Terminus] Error processing WebSocket message:', e);
        }
    });

    ws.on('close', () => {
        console.log(`[Terminus] WebSocket client disconnected: ${connectionId}`);
        const connection = sshConnections.get(connectionId);
        if (connection && connection.ssh) {
            connection.ssh.end();
        }
        sshConnections.delete(connectionId);
    });
});

// --- SFTP WebSocket Server ---
const sftpWss = new WebSocketServer({ port: SFTP_WS_PORT });
const sftpConnections = new Map();

sftpWss.on('connection', (ws) => {
    const connectionId = `sftp-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[SFTP] WebSocket client connected: ${connectionId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const connDetails = sftpConnections.get(connectionId);
            
            if (data.type === 'connect') {
                const { host, port, username, password } = data.payload;
                const conn = new Client();
                sftpConnections.set(connectionId, { ws, ssh: conn });

                conn.on('ready', () => {
                    conn.sftp((err, sftp) => {
                        if (err) {
                            ws.send(JSON.stringify({ type: 'error', payload: `SFTP Error: ${err.message}` }));
                            return;
                        }
                        sftpConnections.get(connectionId).sftp = sftp;
                        ws.send(JSON.stringify({ type: 'status', payload: 'connected' }));
                    });
                }).on('error', (err) => {
                    ws.send(JSON.stringify({ type: 'error', payload: `Connection Error: ${err.message}` }));
                    sftpConnections.delete(connectionId);
                }).on('close', () => {
                    ws.send(JSON.stringify({ type: 'status', payload: 'disconnected' }));
                    sftpConnections.delete(connectionId);
                }).connect({ host, port: parseInt(port, 10) || 22, username, password, readyTimeout: 20000 });
            
            } else if (data.type === 'list' && connDetails?.sftp) {
                const sftp = connDetails.sftp;
                const reqPath = data.payload || '.';
                sftp.readdir(reqPath, (err, list) => {
                    if (err) {
                        ws.send(JSON.stringify({ type: 'error', payload: `SFTP list error: ${err.message}` }));
                        return;
                    }
                    const items = list.map(item => ({
                        name: item.filename,
                        path: path.join(reqPath, item.filename).replace(/\\/g, '/'), // Normalize path
                        type: item.longname.startsWith('d') ? 'folder' : 'file',
                        size: item.attrs.size,
                        modified: item.attrs.mtime,
                    }));
                    ws.send(JSON.stringify({ type: 'list', payload: { path: reqPath, items } }));
                });
            } else if (data.type === 'disconnect' && connDetails?.ssh) {
                connDetails.ssh.end();
            }

        } catch (e) {
            console.error(`[SFTP] Error processing WebSocket message from ${connectionId}:`, e);
        }
    });

    ws.on('close', () => {
        console.log(`[SFTP] WebSocket client disconnected: ${connectionId}`);
        const connDetails = sftpConnections.get(connectionId);
        if (connDetails?.ssh) {
            connDetails.ssh.end();
        }
        sftpConnections.delete(connectionId);
    });
});


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
  
  // Log WebSocket server start
  console.log(`✅ Terminus WebSocket server listening on ws://localhost:${WS_PORT}`);
  console.log(`✅ SFTP WebSocket server listening on ws://localhost:${SFTP_WS_PORT}`);


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