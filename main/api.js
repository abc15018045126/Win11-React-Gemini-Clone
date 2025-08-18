const express = require('express');
const cors = require('cors');
const os = require('os');
const fsRouter = require('./filesystem');
const { launchExternalAppByPath } = require('./launcher');
const { API_PORT } = require('./constants');

function startApiServer() {
    const apiApp = express();
    apiApp.use(cors());
    apiApp.use(express.json({ limit: '50mb' }));

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

    // New route to launch external apps
    apiApp.post('/api/launch', (req, res) => {
        const { path: relativeAppPath, args } = req.body;
        if (!relativeAppPath) {
            return res.status(400).json({ error: 'Missing path in request body' });
        }
        
        const success = launchExternalAppByPath(relativeAppPath, args);
        
        if (success) {
            res.json({ success: true, message: 'App launch initiated.' });
        } else {
            res.status(500).json({ error: 'Failed to launch application.' });
        }
    });

    // All filesystem APIs are prefixed with /api/fs
    apiApp.use('/api/fs', fsRouter);

    apiApp.listen(API_PORT, () => {
        console.log(`✅ API server listening on http://localhost:${API_PORT}`);
    });
}

module.exports = { startApiServer };