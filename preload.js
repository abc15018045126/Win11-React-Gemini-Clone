
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Security: Expose a custom function that calls ipcRenderer.invoke.
  // Do not expose ipcRenderer directly. The channel names must match
  // the names used in the ipcMain.handle() calls in main.js.
  getApiKey: () => ipcRenderer.invoke('get-api-key'),

  listDirectory: (path) => ipcRenderer.invoke('fs:listDirectory', path),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  saveFile: (path, content) => ipcRenderer.invoke('fs:saveFile', path, content),
  findUniqueName: (destinationPath, baseName, isFolder, extension) => 
    ipcRenderer.invoke('fs:findUniqueName', destinationPath, baseName, isFolder, extension),
  createFolder: (path, name) => ipcRenderer.invoke('fs:createFolder', path, name),
  createFile: (path, name, content) => ipcRenderer.invoke('fs:createFile', path, name, content),
  deleteItem: (item) => ipcRenderer.invoke('fs:deleteItem', item),
  renameItem: (item, newName) => ipcRenderer.invoke('fs:renameItem', item, newName),
  moveItem: (sourceItem, destinationPath) => ipcRenderer.invoke('fs:moveItem', sourceItem, destinationPath),
  copyItem: (sourceItem, destinationPath) => ipcRenderer.invoke('fs:copyItem', sourceItem, destinationPath),
  launchExternalApp: (path) => ipcRenderer.invoke('app:launchExternal', path),
});
