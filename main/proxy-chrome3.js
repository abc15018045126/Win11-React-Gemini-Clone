
const { WebSocketServer, createWebSocketStream } = require('ws');
const net = require('net');
const http = require('http');

// This server will listen on port 1080, as the previous proxy did.
// A client application will connect to this server to have its traffic proxied.
const PORT = 1080; 

/**
 * Parses the custom header format from a client.
 * Protocol: [version (1 byte)][atyp (1 byte)][address][port (2 bytes)][initial data]
 * atyp: 0x01 for IPv4 (4 bytes), 0x02 for domain (1 byte len + domain)
 * @param {Buffer} buffer The initial message from the WebSocket client.
 * @returns {{addressRemote: string, portRemote: number, rawData: Buffer, nlessVersion: Buffer}}
 */
function processNlessHeader(buffer) {
    const nlessVersion = buffer.slice(0, 1);
    const atyp = buffer[1];
    let offset = 2;
    let addressRemote = '';

    if (atyp === 0x01) { // IPv4
        addressRemote = buffer.slice(offset, offset + 4).join('.');
        offset += 4;
    } else if (atyp === 0x02) { // Domain name
        const addrLen = buffer[offset];
        offset += 1;
        addressRemote = buffer.slice(offset, offset + addrLen).toString('utf8');
        offset += addrLen;
    } else {
        throw new Error(`Unsupported address type: ${atyp}`);
    }

    const portRemote = buffer.readUInt16BE(offset);
    offset += 2;
    const rawData = buffer.slice(offset);

    return { addressRemote, portRemote, rawData, nlessVersion };
}

/**
 * Starts the WebSocket proxy server as requested by the user.
 * This server listens for incoming WebSocket connections, reads a custom header
 * to determine the destination, and tunnels the traffic to that destination.
 */
function startWsProxyServer() {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('This is a WebSocket proxy server endpoint.\n');
    });

    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        ws.once('message', (msg) => {
            try {
                const nlessBuffer = Buffer.isBuffer(msg) ? msg : (Array.isArray(msg) ? Buffer.concat(msg) : Buffer.from(msg));
                const { addressRemote, portRemote, rawData, nlessVersion } = processNlessHeader(nlessBuffer);
                
                ws.send(Buffer.concat([nlessVersion, Buffer.from([0])]));
                
                const duplex = createWebSocketStream(ws);
                
                const tcpSocket = net.connect({ host: addressRemote, port: portRemote }, function() {
                    this.write(rawData);
                    duplex.on('error', () => {}).pipe(this).on('error', () => {}).pipe(duplex);
                });

                tcpSocket.on('error', (err) => {
                    console.error(`[WS Proxy Server] TCP connection error to ${addressRemote}:${portRemote}:`, err.message);
                    duplex.destroy();
                });

            } catch (error) {
                console.error('[WS Proxy Server] Error processing initial message:', error.message);
                ws.close(1008, 'Invalid protocol format');
            }
        }).on('error', (err) => {
             console.error('[WS Proxy Server] WebSocket message error:', err);
        });
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`[WS Proxy Server] FATAL: Port ${PORT} is already in use. Proxy server cannot start.`);
        } else {
            console.error('[WS Proxy Server] Server error:', e);
        }
    });

    server.listen(PORT, () => {
        console.log(`✅ WebSocket Proxy Server listening on ws://localhost:${PORT}`);
    });
}

// Export the new server function
module.exports = { startWsProxyServer };
