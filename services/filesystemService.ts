
import { ProjectFile, FilesystemItem } from '../types';

// This service is designed to work within an Electron environment.
// It acts as a bridge to the Electron main process, which has access
// to the real Node.js 'fs' module. The 'electronAPI' object is exposed
// by a preload script (which is not part of this codebase).

const api = window.electronAPI;

// If the Electron API is not available (e.g., running in a standard browser),
// it falls back to a mock that logs actions and returns empty/default values.
if (!api) {
    console.warn(
        "Electron API not found. Running in browser mode with a mock filesystem. " +
        "File operations will not be performed."
    );
}

// A mock API to prevent the app from crashing when run in a browser.
const mockApi = {
    listDirectory: async (path: string): Promise<FilesystemItem[]> => {
        console.log(`[Mock FS] listDirectory: ${path}`);
        return [];
    },
    readFile: async (path: string): Promise<ProjectFile | null> => {
        console.log(`[Mock FS] readFile: ${path}`);
        return null;
    },
    saveFile: async (path: string, content: string): Promise<boolean> => {
        console.log(`[Mock FS] saveFile: ${path}`);
        return true;
    },
    findUniqueName: async (destinationPath: string, baseName: string, isFolder: boolean, extension: string = ''): Promise<string> => {
        console.log(`[Mock FS] findUniqueName in ${destinationPath} for ${baseName}`);
        return `${baseName}${extension}`;
    },
    createFolder: async (path: string, name: string): Promise<boolean> => {
        console.log(`[Mock FS] createFolder: ${path}/${name}`);
        return true;
    },
    createFile: async (path: string, name: string, content: string): Promise<boolean> => {
        console.log(`[Mock FS] createFile: ${path}/${name}`);
        return true;
    },
    deleteItem: async (item: FilesystemItem): Promise<boolean> => {
        console.log(`[Mock FS] deleteItem: ${item.path}`);
        return true;
    },
    renameItem: async (item: FilesystemItem, newName: string): Promise<boolean> => {
        console.log(`[Mock FS] renameItem: ${item.path} to ${newName}`);
        return true;
    },
    moveItem: async (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => {
        console.log(`[Mock FS] moveItem: ${sourceItem.path} to ${destinationPath}`);
        return true;
    },
    copyItem: async (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => {
        console.log(`[Mock FS] copyItem: ${sourceItem.path} to ${destinationPath}`);
        return true;
    },
};

const fsApi = api || mockApi;

// --- Exported API ---
// These functions will either call the real Electron API or the mock filesystem.
export const listDirectory = (path: string): Promise<FilesystemItem[]> => fsApi.listDirectory(path);
export const readFile = (path: string): Promise<ProjectFile | null> => fsApi.readFile(path);
export const saveFile = (path: string, content: string): Promise<boolean> => fsApi.saveFile(path, content);
export const findUniqueName = (destinationPath: string, baseName: string, isFolder: boolean, extension: string = ''): Promise<string> => fsApi.findUniqueName(destinationPath, baseName, isFolder, extension || '');
export const createFolder = (path: string, name: string): Promise<boolean> => fsApi.createFolder(path, name);
export const createFile = (path: string, name: string, content: string): Promise<boolean> => fsApi.createFile(path, name, content);
export const deleteItem = (item: FilesystemItem): Promise<boolean> => fsApi.deleteItem(item);
export const renameItem = (item: FilesystemItem, newName: string): Promise<boolean> => fsApi.renameItem(item, newName);
export const moveItem = (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => fsApi.moveItem(sourceItem, destinationPath);
export const copyItem = (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => fsApi.copyItem(sourceItem, destinationPath);
