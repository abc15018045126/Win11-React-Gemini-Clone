
const { session } = require('electron');

/**
 * Attaches a web request listener to a specific session partition to strip
 * headers that prevent content from being displayed in a <webview>.
 * @param {string} partitionName The name of the session partition (e.g., "persist:chrome3").
 */
function setupHeaderStripping(partitionName) {
    if (!partitionName) {
        console.error('[HeaderStripper] A partition name must be provided.');
        return;
    }

    try {
        const ses = session.fromPartition(partitionName);
        console.log(`[HeaderStripper] Attaching to partition: ${partitionName}`);

        const filter = {
            urls: ['*://*/*']
        };

        ses.webRequest.onHeadersReceived(filter, (details, callback) => {
            if (details.responseHeaders) {
                const headers = details.responseHeaders;
                const headerKeys = Object.keys(headers);

                headerKeys.forEach(key => {
                    const lowerCaseKey = key.toLowerCase();

                    // Remove X-Frame-Options, which is a common way to block iframing.
                    if (lowerCaseKey === 'x-frame-options') {
                        delete headers[key];
                    }

                    // Modify Content-Security-Policy to remove the 'frame-ancestors' directive.
                    if (lowerCaseKey === 'content-security-policy') {
                        const cspValues = headers[key];
                        const newCspValues = cspValues.map(value =>
                            // This regex removes 'frame-ancestors' and its values, then cleans up.
                            value.replace(/frame-ancestors[^;]+;?/gi, '').trim()
                        ).filter(v => v); // Filter out any empty strings that result

                        if (newCspValues.length > 0) {
                            headers[key] = newCspValues;
                        } else {
                            // If removing frame-ancestors leaves the CSP empty, remove the header entirely.
                            delete headers[key];
                        }
                    }
                });
            }
            callback({ responseHeaders: details.responseHeaders });
        });
        
        console.log(`[HeaderStripper] Successfully attached web request listener to partition: ${partitionName}`);

    } catch (error) {
        console.error(`[HeaderStripper] Failed to attach to session for partition ${partitionName}:`, error);
    }
}

module.exports = { setupHeaderStripping };
