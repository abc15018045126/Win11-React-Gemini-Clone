
const WebSocket = require('ws');
const net = require('net');
const { createWebSocketStream } = require('ws');

const LOCAL_PORT = 1081; // Using a non-standard port to avoid conflicts.

// Configuration for the remote WebSocket server, based on user-provided files.
const config = {
    serverAddress: 'pages.cloudflare.com',
    serverPort: 443,
    webSocketPath: '/proxyip=ProxyIP.US.CMLiussss.net',
    hostHeader: 'nless.abc15018045126.ip-dynamic.org'
};

/**
 * Starts the proxy server for Chrome 3.
 * It listens locally as a SOCKS5 server and forwards traffic
 * to the remote WebSocket proxy server.
 */
function startChrome3Proxy() {
    const server = net.createServer(clientSocket => {
        let stage = 0;

        const onData = (data) => {
            if (stage === 0) {
                // SOCKS5 Greeting: We only support NO AUTHENTICATION (0x00)
                clientSocket.write(Buffer.from([0x05, 0x00]));
                stage = 1;
                return;
            }

            if (stage === 1) {
                // SOCKS5 Connection Request
                clientSocket.removeListener('data', onData);
                const [ver, cmd, rsv, atyp] = data;
                if (ver !== 5 || cmd !== 1) {
                    console.error('[CH3PRX] Unsupported SOCKS version/command');
                    clientSocket.end();
                    return;
                }

                let remoteAddr, remotePort, initialData;
                if (atyp === 0x01) { // IPv4
                    remoteAddr = data.slice(4, 8).join('.');
                    remotePort = data.readUInt16BE(8);
                    initialData = data.slice(10);
                } else if (atyp === 0x03) { // Domain
                    const addrLen = data[4];
                    remoteAddr = data.slice(5, 5 + addrLen).toString('utf8');
                    remotePort = data.readUInt16BE(5 + addrLen);
                    initialData = data.slice(5 + addrLen + 2);
                } else {
                    console.error(`[CH3PRX] Unsupported address type: ${atyp}`);
                    clientSocket.end();
                    return;
                }

                const headers = { 'User-Agent': 'Mozilla/5.0', 'Host': config.hostHeader };
                const wsUrl = `wss://${config.serverAddress}:${config.serverPort}${config.webSocketPath}`;
                
                const remoteConnection = new WebSocket(wsUrl, { headers, rejectUnauthorized: false });
                
                const handleOpen = () => {
                    const nlessVersion = Buffer.from([0x01]);
                    const portBytes = Buffer.alloc(2);
                    portBytes.writeUInt16BE(remotePort);
                    
                    let atypNless, addrBytes;
                    if (atyp === 0x01) {
                        atypNless = Buffer.from([0x01]);
                        addrBytes = Buffer.from(remoteAddr.split('.').map(s => parseInt(s, 10)));
                    } else { // atyp === 0x03
                        atypNless = Buffer.from([0x02]);
                        const domainBytes = Buffer.from(remoteAddr, 'utf8');
                        const lenByte = Buffer.alloc(1);
                        lenByte.writeUInt8(domainBytes.length);
                        addrBytes = Buffer.concat([lenByte, domainBytes]);
                    }

                    const header = Buffer.concat([nlessVersion, atypNless, addrBytes, portBytes, initialData]);
                    remoteConnection.send(header);

                    remoteConnection.once('message', msg => {
                        // The remote server should reply with [version, 0x00] on success
                        if (Buffer.isBuffer(msg) && msg.length >= 2 && msg[1] === 0x00) {
                            // Send SOCKS success reply to the browser
                            const successResponse = Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]);
                            clientSocket.write(successResponse);
                            
                            // Begin piping data
                            const duplex = createWebSocketStream(remoteConnection, { readable: true, writable: true });
                            clientSocket.pipe(duplex).pipe(clientSocket);

                            const cleanup = () => {
                                if (!clientSocket.destroyed) clientSocket.destroy();
                                if (duplex && !duplex.destroyed) duplex.destroy();
                                if (remoteConnection.readyState === WebSocket.OPEN) remoteConnection.close();
                            };

                            clientSocket.on('error', cleanup);
                            clientSocket.on('close', cleanup);
                            duplex.on('error', cleanup);
                            duplex.on('close', cleanup);
                        } else {
                            console.error('[CH3PRX] Remote server rejected connection.');
                            clientSocket.end();
                            remoteConnection.close();
                        }
                    });
                };
                
                if (remoteConnection.readyState === WebSocket.OPEN) {
                    handleOpen();
                } else {
                    remoteConnection.on('open', handleOpen);
                }

                const cleanupOnError = () => {
                    if (!clientSocket.destroyed) clientSocket.destroy();
                };
                remoteConnection.on('error', cleanupOnError);
                remoteConnection.on('close', cleanupOnError);
            }
        };
        clientSocket.on('data', onData);
        clientSocket.on('error', err => { /* ignore client errors */ });
    });

    server.on('error', e => {
        if (e.code === 'EADDRINUSE') {
            console.error(`[CH3PRX] FATAL: Port ${LOCAL_PORT} is already in use. Proxy server cannot start.`);
        } else {
            console.error('[CH3PRX] Server error:', e);
        }
    });

    server.listen(LOCAL_PORT, '127.0.0.1', () => {
        console.log(`✅ Chrome 3 Proxy listening on 127.0.0.1:${LOCAL_PORT}`);
    });
}

module.exports = { startChrome3Proxy };
