const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Most APIs have been moved to the Express server running in the main process.
  // We only expose functions here that are unique to the Electron renderer environment
  // and cannot be handled over a standard web API, like launching another Electron process.
  launchExternalApp: (path) => ipcRenderer.invoke('app:launchExternal', path),
});