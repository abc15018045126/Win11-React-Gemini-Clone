const path = require('path');
const { spawn } = require('child_process');
const { FS_ROOT } = require('./constants');

function launchExternalAppByPath(relativeAppPath) {
    try {
        const appDir = path.join(FS_ROOT, relativeAppPath);
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
}

module.exports = { launchExternalAppByPath };