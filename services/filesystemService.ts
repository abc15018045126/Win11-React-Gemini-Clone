
import { ProjectFile, FilesystemItem } from '../types';

const api = window.electronAPI;

// A mock API for running in a browser without the Electron backend during development.
// This allows the UI to run without crashing, but filesystem operations will do nothing.
const mockApi = {
    listDirectory: async (path: string): Promise<FilesystemItem[]> => { 
        console.warn(`[Mock FS]: listDirectory called for "${path}". This is a mock response as the Electron backend is not available.`); 
        return []; 
    },
    readFile: async (path: string): Promise<ProjectFile | null> => { 
        console.warn(`[Mock FS]: readFile called for "${path}". This is a mock response.`); 
        return null; 
    },
    saveFile: async (path: string, content: string): Promise<boolean> => { 
        console.warn(`[Mock FS]: saveFile called for "${path}". This is a mock response.`); 
        return false; 
    },
    findUniqueName: async (destinationPath: string, baseName: string, isFolder: boolean, extension: string = ''): Promise<string> => { 
        console.warn(`[Mock FS]: findUniqueName called for "${baseName}". This is a mock response.`); 
        return `${baseName} (1)${isFolder ? '' : extension}`; 
    },
    createFolder: async (path: string, name: string): Promise<boolean> => { 
        console.warn(`[Mock FS]: createFolder called for "${name}" in "${path}". This is a mock response.`); 
        return false; 
    },
    createFile: async (path: string, name: string, content: string): Promise<boolean> => { 
        console.warn(`[Mock FS]: createFile called for "${name}" in "${path}". This is a mock response.`); 
        return false; 
    },
    createAppShortcut: async (appId: string, appName: string): Promise<boolean> => { 
        console.warn(`[Mock FS]: createAppShortcut called for "${appName}". This is a mock response.`); 
        return false; 
    },
    deleteItem: async (item: FilesystemItem): Promise<boolean> => { 
        console.warn(`[Mock FS]: deleteItem called for "${item.path}". This is a mock response.`); 
        return false; 
    },
    renameItem: async (item: FilesystemItem, newName: string): Promise<boolean> => { 
        console.warn(`[Mock FS]: renameItem called for "${item.path}" to "${newName}". This is a mock response.`); 
        return false; 
    },
    moveItem: async (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => { 
        console.warn(`[Mock FS]: moveItem called for "${sourceItem.path}" to "${destinationPath}". This is a mock response.`); 
        return false; 
    },
    copyItem: async (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => { 
        console.warn(`[Mock FS]: copyItem called for "${sourceItem.path}" to "${destinationPath}". This is a mock response.`); 
        return false; 
    },
};

const service = api || mockApi;

if (!api) {
    console.log("Running in web mode. Filesystem operations will be mocked to allow UI development.");
}

export const listDirectory = service.listDirectory;
export const readFile = service.readFile;
export const saveFile = service.saveFile;
export const findUniqueName = service.findUniqueName;
export const createFolder = service.createFolder;
export const createFile = service.createFile;
export const createAppShortcut = service.createAppShortcut;
export const deleteItem = service.deleteItem;
export const renameItem = service.renameItem;
export const moveItem = service.moveItem;
export const copyItem = service.copyItem;
