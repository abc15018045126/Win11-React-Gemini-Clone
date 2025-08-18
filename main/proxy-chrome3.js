const WebSocket = require('ws');
const net = require('net');

// --- VLESS Configuration ---
const config = {
    serverAddress: 'pages.cloudflare.com',
    serverPort: 443,
    uuid: '2ea73714-138e-4cc7-8cab-d7caf476d51b',
    localPort: 1080,
    webSocketPath: '/proxyip=ProxyIP.US.CMLiussss.net',
    hostHeader: 'nless.abc15018045126.ip-dynamic.org'
};

function startChrome3Proxy() {
    console.log('[Chrome 3 Proxy] Initializing...');

    const server = net.createServer(socket => {
        let stage = 0;
        let headerSent = false;

        const headers = { 'User-Agent': 'Mozilla/5.0' };
        if (config.hostHeader) {
            headers['Host'] = config.hostHeader;
        }

        const path = config.webSocketPath;
        const encodedPath = path.startsWith('/') ? '/' + encodeURIComponent(path.substring(1)) : encodeURIComponent(path);

        const ws = new WebSocket(`wss://${config.serverAddress}:${config.serverPort}${encodedPath}`, {
            rejectUnauthorized: false,
            headers: headers
        });

        ws.on('open', () => { /* Ready for VLESS header */ });
        ws.on('message', data => socket.write(data));
        ws.on('error', err => {
            console.error('[Chrome 3 Proxy] WebSocket error:', err.message);
            socket.destroy();
        });
        ws.on('close', () => socket.destroy());

        socket.on('data', (data) => {
            if (stage === 0) {
                socket.write(Buffer.from([0x05, 0x00])); // SOCKS5 greeting
                stage = 1;
                return;
            }

            if (stage === 1) { // SOCKS5 connection request
                const [ver, cmd, rsv, atyp] = data;
                if (ver !== 5 || cmd !== 1) {
                    console.error('[Chrome 3 Proxy] Unsupported SOCKS version or command');
                    socket.destroy();
                    return;
                }

                let remoteAddr, remotePort;
                if (atyp === 1) { // IPv4
                    remoteAddr = data.slice(4, 8).join('.');
                    remotePort = data.readUInt16BE(8);
                } else if (atyp === 3) { // Domain
                    const addrLen = data[4];
                    remoteAddr = data.slice(5, 5 + addrLen).toString('utf8');
                    remotePort = data.readUInt16BE(5 + addrLen);
                } else {
                    console.error(`[Chrome 3 Proxy] Unsupported address type: ${atyp}`);
                    socket.destroy();
                    return;
                }

                // Construct VLESS header
                const uuidBytes = Buffer.from(config.uuid.replace(/-/g, ''), 'hex');
                const portBytes = Buffer.alloc(2);
                portBytes.writeUInt16BE(remotePort);
                const vlessHeaderPart1 = Buffer.concat([ Buffer.from([0x00]), uuidBytes, Buffer.from([0x00]), Buffer.from([0x01]), portBytes ]);
                
                let vlessHeaderPart2;
                if (atyp === 1) {
                    vlessHeaderPart2 = Buffer.concat([Buffer.from([0x01]), data.slice(4, 8)]);
                } else {
                    const addrBytes = Buffer.from(remoteAddr, 'utf8');
                    const addrLenByte = Buffer.alloc(1);
                    addrLenByte.writeUInt8(addrBytes.length);
                    vlessHeaderPart2 = Buffer.concat([Buffer.from([0x02]), addrLenByte, addrBytes]);
                }
                const vlessHeader = Buffer.concat([vlessHeaderPart1, vlessHeaderPart2]);

                const sendVlessHeader = () => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(vlessHeader);
                        headerSent = true;
                        const successResponse = Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]);
                        socket.write(successResponse);
                        stage = 2; // Data piping stage
                    }
                };
                
                if (ws.readyState === WebSocket.OPEN) {
                    sendVlessHeader();
                } else {
                    ws.once('open', sendVlessHeader);
                }
                return;
            }

            if (stage === 2 && headerSent) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(data);
                }
            }
        });

        socket.on('error', err => {
            // Silently handle errors, client will disconnect
            ws.close();
        });
        socket.on('close', () => ws.close());
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`[Chrome 3 Proxy] FATAL: Port 1080 is already in use by another application. Proxy cannot start.`);
        } else {
            console.error('[Chrome 3 Proxy] Server error:', e);
        }
    });

    server.listen(config.localPort, () => {
        console.log(`✅ Chrome 3 SOCKS5 proxy listening on 127.0.0.1:${config.localPort}`);
    });
}

module.exports = { startChrome3Proxy };
