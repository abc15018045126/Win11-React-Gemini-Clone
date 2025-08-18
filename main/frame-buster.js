// This script is preloaded into the webview.
// Its purpose is to defeat "frame-busting" scripts on websites
// that try to prevent themselves from being embedded.

try {
    // Many frame-busters check if `window.top` is different from `window.self`.
    // By overriding `top` and `parent` to point to `self`, we can trick these scripts.
    Object.defineProperty(window, 'top', {
        value: window.self,
        writable: false,
        configurable: false
    });

    Object.defineProperty(window, 'parent', {
        value: window.self,
        writable: false,
        configurable: false
    });
    
    // Some more aggressive scripts might try to change `top.location`.
    // This is harder to prevent without breaking functionality, but the above
    // should handle many cases.

    console.log('[FrameBuster] Preload script executed successfully.');

} catch (e) {
    console.error('[FrameBuster] Error executing preload script:', e);
}
