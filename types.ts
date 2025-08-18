
import { ReactNode } from 'react';

export interface AppIconProps {
  className?: string;
  isSmall?: boolean; // For smaller icon variants, e.g. in taskbar
}

export interface ProjectFile {
    name: string;
    path: string;
    content: string;
}

export interface FilesystemItem extends Partial<ProjectFile> {
    name: string;
    path: string;
    type: 'file' | 'folder';
}

export type ClipboardItem = {
    item: FilesystemItem;
    operation: 'copy' | 'cut';
};

export type AppComponentProps = {
  appInstanceId: string;
  onClose: () => void;
  setTitle: (title: string) => void; 
  wallpaper?: string;
  onWallpaperChange?: (newWallpaper: string) => void;
  // Allow apps to open other apps
  openApp?: (appId: string, initialData?: any) => void;
  initialData?: any; // To pass data on open

  // Filesystem related props for apps like File Explorer and Desktop
  clipboard?: ClipboardItem | null;
  handleCopy?: (item: FilesystemItem) => void;
  handleCut?: (item: FilesystemItem) => void;
  handlePaste?: (destinationPath: string) => void;
};

export type AppComponentType = React.FC<AppComponentProps>;

export interface AppDefinition {
  id: string;
  name: string;
  icon: React.FC<AppIconProps>;
  component: AppComponentType;
  defaultSize?: { width: number; height: number };
  isPinnedToTaskbar?: boolean; // To show on taskbar by default
  isExternal?: boolean; // If true, this app is launched as a separate process
  externalPath?: string; // Path to the external app's root directory
}

export interface OpenApp extends AppDefinition {
  instanceId: string;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  title: string; 
  previousPosition?: { x: number; y: number }; // For restoring from maximized
  previousSize?: { width: number; height: number }; // For restoring from maximized
  initialData?: any; // Data passed when the app is opened
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  isLoading?: boolean;
}

// --- Electron API Bridge Types ---
export interface IElectronAPI {
  getApiKey: () => Promise<string | undefined>;
  listDirectory: (path: string) => Promise<FilesystemItem[]>;
  readFile: (path: string) => Promise<ProjectFile | null>;
  saveFile: (path: string, content: string) => Promise<boolean>;
  findUniqueName: (destinationPath: string, baseName: string, isFolder: boolean, extension?: string) => Promise<string>;
  createFolder: (path: string, name: string) => Promise<boolean>;
  createFile: (path: string, name: string, content: string) => Promise<boolean>;
  createAppShortcut: (appId: string, appName: string) => Promise<boolean>;
  deleteItem: (item: FilesystemItem) => Promise<boolean>;
  renameItem: (item: FilesystemItem, newName: string) => Promise<boolean>;
  moveItem: (sourceItem: FilesystemItem, destinationPath: string) => Promise<boolean>;
  copyItem: (sourceItem: FilesystemItem, destinationPath: string) => Promise<boolean>;
  launchExternalApp: (path: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}