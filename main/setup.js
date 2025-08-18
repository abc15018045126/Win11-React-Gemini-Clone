const fs = require('fs');
const path = require('path');
const { FS_ROOT, SFTP_TEMP_DIR } = require('./constants');

function setupInitialFilesystem() {
    console.log('Ensuring essential directories exist in project root...');
    const directoriesToEnsure = ['Desktop', 'Documents', 'Downloads'];
    directoriesToEnsure.forEach(dir => {
        const dirPath = path.join(FS_ROOT, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });
    // Create temp directory for SFTP downloads
    if (!fs.existsSync(SFTP_TEMP_DIR)) {
        fs.mkdirSync(SFTP_TEMP_DIR);
    }
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

module.exports = { setupInitialFilesystem };
