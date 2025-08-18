import { ProjectFile, FilesystemItem } from '../types';

// This service intelligently adapts to its environment.
// It uses the fast Electron IPC if available, otherwise it falls back to the web API.

const api = window.electronAPI;
const isElectron = !!api;

// --- Web API Fetcher (only used if not in Electron) ---
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
        const response = await fetch(endpoint, options);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error on ${endpoint}: ${response.status} ${response.statusText} - ${errorText}`);
            // Return a sensible default or throw an error based on function signature
            if (endpoint.includes('list')) return [] as unknown as T;
            throw new Error(`API request failed: ${errorText}`);
        }
        // Handle responses with no content (e.g., successful POST/DELETE)
        if (response.status === 204 || response.headers.get('Content-Length') === '0') {
             return true as unknown as T;
        }
        return response.json();
    } catch (error) {
        console.error(`Network Error on ${endpoint}:`, error);
        if (endpoint.includes('list')) return [] as unknown as T;
        throw error;
    }
}

// --- Exported API ---

export const listDirectory = (path: string): Promise<FilesystemItem[]> => {
    if (isElectron) return api.listDirectory(path);
    return apiRequest<FilesystemItem[]>(`/api/fs/list?path=${encodeURIComponent(path)}`);
};

export const readFile = (path: string): Promise<ProjectFile | null> => {
    if (isElectron) return api.readFile(path);
    return apiRequest<ProjectFile | null>(`/api/fs/read?path=${encodeURIComponent(path)}`);
};

export const saveFile = (path: string, content: string): Promise<boolean> => {
    if (isElectron) return api.saveFile(path, content);
    return apiRequest(`/api/fs/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
    });
};

export const findUniqueName = (destinationPath: string, baseName: string, isFolder: boolean, extension: string = ''): Promise<string> => {
    if (isElectron) return api.findUniqueName(destinationPath, baseName, isFolder, extension);
    return apiRequest<{ name: string }>(`/api/fs/findUniqueName`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationPath, baseName, isFolder, extension }),
    }).then(result => result.name);
};

export const createFolder = (path: string, name: string): Promise<boolean> => {
    if (isElectron) return api.createFolder(path, name);
    return apiRequest(`/api/fs/createFolder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, name }),
    });
};

export const createFile = (path: string, name: string, content: string): Promise<boolean> => {
    if (isElectron) return api.createFile(path, name, content);
    return apiRequest(`/api/fs/createFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, name, content }),
    });
};

export const createAppShortcut = (appId: string, appName: string): Promise<boolean> => {
    if (isElectron) return api.createAppShortcut(appId, appName);
    return apiRequest(`/api/fs/createAppShortcut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, appName }),
    });
};

export const deleteItem = (item: FilesystemItem): Promise<boolean> => {
    if (isElectron) return api.deleteItem(item);
    return apiRequest(`/api/fs/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
    });
};

export const renameItem = (item: FilesystemItem, newName: string): Promise<boolean> => {
    if (isElectron) return api.renameItem(item, newName);
    return apiRequest(`/api/fs/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, newName }),
    });
};

export const moveItem = (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => {
    if (isElectron) return api.moveItem(sourceItem, destinationPath);
    return apiRequest(`/api/fs/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceItem, destinationPath }),
    });
};

export const copyItem = (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => {
    if (isElectron) return api.copyItem(sourceItem, destinationPath);
    return apiRequest(`/api/fs/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceItem, destinationPath }),
    });
};