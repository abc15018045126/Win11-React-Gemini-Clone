const express = require('express');
const cors = require('cors');
const os = require('os');
const fsRouter = require('./filesystem');
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

    // All filesystem APIs are prefixed with /api/fs
    apiApp.use('/api/fs', fsRouter);

    apiApp.listen(API_PORT, () => {
        console.log(`✅ API server listening on http://localhost:${API_PORT}`);
    });
}

module.exports = { startApiServer };
