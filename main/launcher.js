const path = require('path');
const { spawn } = require('child_process');
const { FS_ROOT } = require('./constants');

function launchExternalAppByPath(relativeAppPath, args = []) {
    try {
        const appDir = path.join(FS_ROOT, relativeAppPath);
        const spawnArgs = ['.', ...args];
        console.log(`Attempting to launch external app from: ${appDir} with args: ${spawnArgs.join(' ')}`);
        
        const child = spawn(process.execPath, spawnArgs, {
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