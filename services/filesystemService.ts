
import { ProjectFile, FilesystemItem } from '../types';

// This service communicates with the backend Node.js server via a REST API.

// Helper function to handle fetch requests and errors
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
    try {
        const response = await fetch(endpoint, options);
        if (!response.ok) {
            console.error(`API Error on ${endpoint}: ${response.status} ${response.statusText}`);
            return null;
        }
        if (response.headers.get('Content-Type')?.includes('application/json')) {
            return response.json() as Promise<T>;
        }
        return response as T;
    } catch (error) {
        console.error(`Network Error on ${endpoint}:`, error);
        return null;
    }
}

// --- Exported API ---
export const listDirectory = async (path: string): Promise<FilesystemItem[]> => {
    const result = await apiRequest<FilesystemItem[]>(`/api/fs/list?path=${encodeURIComponent(path)}`);
    return result || [];
};

export const readFile = (path: string): Promise<ProjectFile | null> => {
    return apiRequest<ProjectFile>(`/api/fs/read?path=${encodeURIComponent(path)}`);
};

export const saveFile = async (path: string, content: string): Promise<boolean> => {
    const result = await apiRequest(`/api/fs/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
    });
    return !!result;
};

export const findUniqueName = async (destinationPath: string, baseName: string, isFolder: boolean, extension: string = ''): Promise<string> => {
    const result = await apiRequest<{ name: string }>(`/api/fs/findUniqueName`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationPath, baseName, isFolder, extension }),
    });
    return result?.name || `${baseName}${extension}`;
};

export const createFolder = async (path: string, name: string): Promise<boolean> => {
    const result = await apiRequest(`/api/fs/createFolder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, name }),
    });
    return !!result;
};

export const createFile = async (path: string, name: string, content: string): Promise<boolean> => {
    const result = await apiRequest(`/api/fs/createFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, name, content }),
    });
    return !!result;
};

export const createAppShortcut = async (appId: string, appName: string): Promise<boolean> => {
    const result = await apiRequest(`/api/fs/createAppShortcut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, appName })
    });
    return !!result;
};


export const deleteItem = async (item: FilesystemItem): Promise<boolean> => {
    const result = await apiRequest(`/api/fs/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
    });
    return !!result;
};

export const renameItem = async (item: FilesystemItem, newName: string): Promise<boolean> => {
    const result = await apiRequest(`/api/fs/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, newName }),
    });
    return !!result;
};

export const moveItem = async (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => {
    const result = await apiRequest(`/api/fs/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceItem, destinationPath }),
    });
    return !!result;
};

export const copyItem = async (sourceItem: FilesystemItem, destinationPath: string): Promise<boolean> => {
    const result = await apiRequest(`/api/fs/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceItem, destinationPath }),
    });
    return !!result;
};
