const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const { SFTP_WS_PORT, SFTP_TEMP_DIR } = require('./constants');

function startSftpServer() {
    const sftpWss = new WebSocketServer({ port: SFTP_WS_PORT });
    const sftpConnections = new Map();
    const sftpTrackedFiles = new Map(); // For auto-upload feature
    
    sftpWss.on('connection', (ws) => {
        const connectionId = `sftp-${Math.random().toString(36).substring(2, 9)}`;
        console.log(`[SFTP] WebSocket client connected: ${connectionId}`);

        const sendError = (payload) => ws.send(JSON.stringify({ type: 'error', payload }));
        const sendSuccess = (message, dirToRefresh) => ws.send(JSON.stringify({ type: 'operation_success', payload: { message, dirToRefresh } }));

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                const connDetails = sftpConnections.get(connectionId);
                const sftp = connDetails?.sftp;

                if (data.type === 'connect') {
                    const { host, port, username, password } = data.payload;
                    const conn = new Client();
                    sftpConnections.set(connectionId, { ws, ssh: conn });

                    conn.on('ready', () => {
                        conn.sftp((err, sftp) => {
                            if (err) { sendError(`SFTP Error: ${err.message}`); return; }
                            sftpConnections.get(connectionId).sftp = sftp;
                            ws.send(JSON.stringify({ type: 'status', payload: 'connected' }));
                        });
                    }).on('error', (err) => {
                        sendError(`Connection Error: ${err.message}`);
                        sftpConnections.delete(connectionId);
                    }).on('close', () => {
                        ws.send(JSON.stringify({ type: 'status', payload: 'disconnected' }));
                        sftpConnections.delete(connectionId);
                    }).connect({ host, port: parseInt(port, 10) || 22, username, password, readyTimeout: 20000 });

                } else if (data.type === 'list' && sftp) {
                    const { path: reqPath, isRoot } = data.payload;
                    sftp.readdir(reqPath, (err, list) => {
                        if (err) { sendError(`SFTP list error: ${err.message}`); return; }
                        const items = list.map(item => ({
                            name: item.filename,
                            path: path.posix.join(reqPath, item.filename),
                            type: item.longname.startsWith('d') ? 'folder' : 'file',
                            size: item.attrs.size,
                            modified: item.attrs.mtime,
                        }));
                        ws.send(JSON.stringify({ type: 'list', payload: { path: reqPath, items, isRoot } }));
                    });

                } else if (data.type === 'download_and_track' && sftp) {
                    const remotePath = data.payload;
                    const localFileName = path.basename(remotePath);
                    const localPath = path.join(SFTP_TEMP_DIR, `${connectionId}-${Date.now()}-${localFileName}`);

                    sftp.fastGet(remotePath, localPath, (err) => {
                        if (err) { sendError(`Download failed: ${err.message}`); return; }
                        ws.send(JSON.stringify({ type: 'download_complete', payload: { localPath: localPath.replace(path.join(__dirname, '..'), '').replace(/\\/g, '/'), remotePath } }));

                        const watcher = fs.watch(localPath, (eventType) => {
                            if (eventType === 'change') {
                                const trackInfo = sftpTrackedFiles.get(localPath);
                                if (!trackInfo) return;

                                clearTimeout(trackInfo.debounceTimeout);
                                trackInfo.debounceTimeout = setTimeout(() => {
                                    ws.send(JSON.stringify({ type: 'upload_status', payload: { status: 'started', remotePath } }));
                                    sftp.fastPut(localPath, remotePath, (uploadErr) => {
                                        if (uploadErr) {
                                            ws.send(JSON.stringify({ type: 'upload_status', payload: { status: 'error', remotePath, error: uploadErr.message } }));
                                        } else {
                                            ws.send(JSON.stringify({ type: 'upload_status', payload: { status: 'complete', remotePath } }));
                                        }
                                    });
                                }, 500);
                            }
                        });

                        sftpTrackedFiles.set(localPath, { ws, sftp, remotePath, connectionId, watcher, debounceTimeout: null });
                    });

                } else if (data.type === 'upload' && sftp) {
                    const { remoteDir, fileName, fileData } = data.payload;
                    const remotePath = path.posix.join(remoteDir, fileName);
                    const tempFilePath = path.join(SFTP_TEMP_DIR, `upload-${Date.now()}-${fileName}`);
                    const buffer = Buffer.from(fileData, 'base64');

                    fs.writeFile(tempFilePath, buffer, (writeErr) => {
                        if (writeErr) { sendError(`Failed to write temp file for upload: ${writeErr.message}`); return; }

                        sftp.fastPut(tempFilePath, remotePath, (uploadErr) => {
                            fs.unlink(tempFilePath, () => { }); // Clean up temp file
                            if (uploadErr) { sendError(`Upload failed: ${uploadErr.message}`); return; }
                            sendSuccess(`Uploaded ${fileName} successfully.`, remoteDir);
                        });
                    });

                } else if (data.type === 'create_folder' && sftp) {
                    const { parentDir, name } = data.payload;
                    const newPath = path.posix.join(parentDir, name);
                    sftp.mkdir(newPath, (err) => {
                        if (err) { sendError(`Failed to create folder: ${err.message}`); return; }
                        sendSuccess(`Created folder ${name}.`, parentDir);
                    });

                } else if (data.type === 'create_file' && sftp) {
                    const { parentDir, name } = data.payload;
                    const newPath = path.posix.join(parentDir, name);
                    const emptyBuffer = Buffer.from('');
                    const stream = sftp.createWriteStream(newPath);
                    stream.on('error', (err) => sendError(`Failed to create file: ${err.message}`));
                    stream.on('finish', () => sendSuccess(`Created file ${name}.`, parentDir));
                    stream.end(emptyBuffer);

                } else if (data.type === 'delete_item' && sftp) {
                    const { item } = data.payload;
                    const dir = path.posix.dirname(item.path);
                    const op = item.type === 'folder' ? sftp.rmdir.bind(sftp) : sftp.unlink.bind(sftp);
                    op(item.path, (err) => {
                        if (err) { sendError(`Failed to delete ${item.name}: ${err.message}`); return; }
                        sendSuccess(`Deleted ${item.name}.`, dir);
                    });

                } else if (data.type === 'rename_item' && sftp) {
                    const { item, newName } = data.payload;
                    const dir = path.posix.dirname(item.path);
                    const newPath = path.posix.join(dir, newName);
                    sftp.rename(item.path, newPath, (err) => {
                        if (err) { sendError(`Failed to rename ${item.name}: ${err.message}`); return; }
                        sendSuccess(`Renamed ${item.name} to ${newName}.`, dir);
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

            // Cleanup tracked files and watchers for this connection
            for (const [localPath, trackInfo] of sftpTrackedFiles.entries()) {
                if (trackInfo.connectionId === connectionId) {
                    trackInfo.watcher.close();
                    clearTimeout(trackInfo.debounceTimeout);
                    fs.promises.unlink(localPath).catch(err => console.error(`Failed to delete temp file ${localPath}:`, err));
                    sftpTrackedFiles.delete(localPath);
                }
            }
        });
    });

    console.log(`✅ SFTP WebSocket server listening on ws://localhost:${SFTP_WS_PORT}`);
}

module.exports = { startSftpServer };
