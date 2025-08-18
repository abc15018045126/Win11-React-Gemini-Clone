const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

const isDev = process.env.NODE_ENV !== 'production';

// --- Filesystem Setup ---
const FS_ROOT = __dirname;

function resolvePath(relativePath) {
  // Basic security to prevent path traversal
  if (relativePath.includes('..')) {
    throw new Error('Path traversal is not allowed.');
  }
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

// --- API Endpoints ---

app.get('/api/key', (req, res) => {
  res.json({ apiKey: process.env.API_KEY });
});

// All filesystem endpoints are wrapped in a try/catch for safety.
app.get('/api/fs/list', async (req, res) => {
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
        console.error(`Error listing directory ${req.query.path}:`, error);
        res.status(500).send('Server Error');
    }
});

app.get('/api/fs/read', async (req, res) => {
    try {
        const relativePath = req.query.path;
        if (!relativePath) return res.status(400).send('Path is required');
        const filePath = resolvePath(relativePath);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        res.json({
            name: path.basename(relativePath),
            path: relativePath,
            content: content,
        });
    } catch (error) {
        console.error(`Error reading file ${req.query.path}:`, error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/fs/save', async (req, res) => {
    try {
        const { path: relativePath, content } = req.body;
        const filePath = resolvePath(relativePath);
        await fs.promises.writeFile(filePath, content, 'utf-8');
        res.sendStatus(200);
    } catch (error) {
        console.error(`Error saving file:`, error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/fs/findUniqueName', (req, res) => {
    try {
        const { destinationPath, baseName, isFolder, extension } = req.body;
        const destPath = resolvePath(destinationPath);
        let counter = 0;
        let newName = `${baseName}${isFolder ? '' : extension}`;
        let fullPath = path.join(destPath, newName);

        while (fs.existsSync(fullPath)) {
            counter++;
            newName = `${baseName} (${counter})${isFolder ? '' : extension}`;
            fullPath = path.join(destPath, newName);
        }
        res.json({ name: newName });
    } catch (error) {
        console.error('Error finding unique name:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/fs/createFolder', async (req, res) => {
    try {
        const { path: relativePath, name } = req.body;
        const folderPath = resolvePath(path.join(relativePath, name));
        await fs.promises.mkdir(folderPath, { recursive: true });
        res.sendStatus(200);
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/fs/createFile', async (req, res) => {
    try {
        const { path: relativePath, name, content } = req.body;
        const filePath = resolvePath(path.join(relativePath, name));
        await fs.promises.writeFile(filePath, content, 'utf-8');
        res.sendStatus(200);
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/fs/createAppShortcut', async (req, res) => {
    try {
        const { appId, appName } = req.body;
        const shortcutPath = resolvePath(path.join('Desktop', `${appName}.app`));
        const shortcutContent = JSON.stringify({ appId });
        await fs.promises.writeFile(shortcutPath, shortcutContent, 'utf-8');
        res.sendStatus(200);
    } catch (error) {
        console.error(`Error creating app shortcut for ${appName}:`, error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/fs/delete', async (req, res) => {
    try {
        const { item } = req.body;
        const itemPath = resolvePath(item.path);
        if (item.type === 'folder') {
            await fs.promises.rm(itemPath, { recursive: true, force: true });
        } else {
            await fs.promises.unlink(itemPath);
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/fs/rename', async (req, res) => {
    try {
        const { item, newName } = req.body;
        const oldPath = resolvePath(item.path);
        const newPath = resolvePath(path.join(path.dirname(item.path), newName));
        await fs.promises.rename(oldPath, newPath);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error renaming item:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/fs/move', async (req, res) => {
    try {
        const { sourceItem, destinationPath } = req.body;
        const sourcePath = resolvePath(sourceItem.path);
        const destPath = resolvePath(path.join(destinationPath, sourceItem.name));
        await fs.promises.rename(sourcePath, destPath);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error moving item:', error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/fs/copy', async (req, res) => {
    try {
        const { sourceItem, destinationPath } = req.body;
        const sourcePath = resolvePath(sourceItem.path);
        const destPath = resolvePath(path.join(destinationPath, sourceItem.name));
        await fs.promises.cp(sourcePath, destPath, { recursive: true });
        res.sendStatus(200);
    } catch (error) {
        console.error('Error copying item:', error);
        res.status(500).send('Server Error');
    }
});

// --- Static File Serving ---
if (!isDev) {
    app.use(express.static(path.join(__dirname, 'dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
}

// --- Server Initialization ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    setupInitialFilesystem();
    console.log(`Server listening on port ${PORT}`);
    if (isDev) {
        console.log('Running in development mode. Frontend is available via Vite dev server on port 5173.');
    } else {
        console.log(`Frontend served from http://localhost:${PORT}`);
    }
});
