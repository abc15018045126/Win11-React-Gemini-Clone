import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppDefinition, AppComponentProps, FilesystemItem } from '../../types';
import * as FsService from '../../services/filesystemService';
import { FolderIcon, FileCodeIcon, FileJsonIcon, FileGenericIcon, StarIcon, NotebookIcon, FileExplorerIcon } from '../../constants';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';

const getFileIcon = (filename: string) => {
    if (filename.endsWith('.app')) return <FileGenericIcon className="w-12 h-12 text-blue-400" />;
    if (filename.endsWith('.tsx') || filename.endsWith('.ts') || filename.endsWith('.html')) return <FileCodeIcon className="w-12 h-12 text-cyan-400" />;
    if (filename.endsWith('.json')) return <FileJsonIcon className="w-12 h-12 text-yellow-400" />;
    if (filename.endsWith('.txt') || filename.endsWith('.md')) return <NotebookIcon isSmall className="w-12 h-12 text-zinc-300" />;
    return <FileGenericIcon className="w-12 h-12 text-zinc-400" />;
}

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; isActive: boolean }> = ({ icon, label, onClick, isActive }) => (
    <button onClick={onClick} className={`w-full flex items-center space-x-3 px-3 py-2 text-sm rounded ${isActive ? 'bg-blue-600/30 text-white' : 'hover:bg-zinc-700/50'}`}>
        {icon}
        <span>{label}</span>
    </button>
);


const FileExplorerApp: React.FC<AppComponentProps> = ({ 
    setTitle, 
    openApp,
    initialData,
    clipboard,
    handleCopy,
    handleCut,
    handlePaste,
}) => {
    const startPath = initialData?.initialPath || '/';
    const [currentPath, setCurrentPath] = useState(startPath);
    const [history, setHistory] = useState([startPath]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [itemsInCurrentPath, setItemsInCurrentPath] = useState<FilesystemItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item?: FilesystemItem } | null>(null);
    const [renamingItemPath, setRenamingItemPath] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        const items = await FsService.listDirectory(currentPath);
        setItemsInCurrentPath(items);
        setIsLoading(false);
    }, [currentPath]);

    useEffect(() => {
        const pathName = currentPath === '/' ? 'Project Root' : currentPath.split('/').pop() || 'Files';
        setTitle(`File Explorer - ${pathName}`);
    }, [currentPath, setTitle]);
    
    useEffect(() => {
        fetchItems();
    }, [currentPath, fetchItems, initialData?.refreshId]);

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);
    
    const navigateTo = useCallback((path: string) => {
        if (path === currentPath) return;
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(path);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentPath(path);
        setContextMenu(null);
    }, [currentPath, history, historyIndex]);

    const goBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setCurrentPath(history[newIndex]);
        }
    };

    const goUp = () => {
        if (currentPath !== '/') {
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
            navigateTo(parentPath);
        }
    };
    
    const openItem = useCallback((item: FilesystemItem) => {
        if (renamingItemPath === item.path) return;
        if (item.type === 'folder') {
            navigateTo(item.path);
        } else if (item.name.endsWith('.app') && item.content) {
            try {
                const appInfo = JSON.parse(item.content);
                openApp?.(appInfo.appId);
            } catch (e) { console.error("Could not parse app shortcut", e); }
        } else if (item.type === 'file') {
            openApp?.('notebook', { file: { path: item.path, name: item.name } });
        }
    }, [navigateTo, openApp, renamingItemPath]);
    
    const handleItemContextMenu = (e: React.MouseEvent, item: FilesystemItem) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };

    const handleBackgroundContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if ((e.target as HTMLElement).closest('button')) return;
        setContextMenu({ x: e.clientX, y: e.clientY });
    }
    
    const handleRename = async () => {
        const item = itemsInCurrentPath.find(i => i.path === renamingItemPath);
        if (item && renameValue && item.name !== renameValue) {
            await FsService.renameItem(item, renameValue);
            fetchItems();
        }
        setRenamingItemPath(null);
    };

    const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
        if (!contextMenu) return [];
        const { item } = contextMenu;

        if (item && handleCopy && handleCut) {
            return [
                { type: 'item', label: 'Open', onClick: () => openItem(item) },
                { type: 'separator' },
                { type: 'item', label: 'Cut', onClick: () => handleCut(item) },
                { type: 'item', label: 'Copy', onClick: () => handleCopy(item) },
                { type: 'separator' },
                { type: 'item', label: 'Delete', onClick: async () => { await FsService.deleteItem(item); fetchItems(); } },
                { type: 'item', label: 'Rename', onClick: () => {
                    setRenamingItemPath(item.path);
                    setRenameValue(item.name);
                }},
            ];
        } else if (handlePaste) {
            const createNewFolder = async () => {
                const name = await FsService.findUniqueName(currentPath, "New folder", true);
                await FsService.createFolder(currentPath, name);
                fetchItems();
            }
             const createNewFile = async () => {
                const name = await FsService.findUniqueName(currentPath, "New Text Document", false, ".txt");
                await FsService.createFile(currentPath, name, "");
                fetchItems();
            }
            return [
                { type: 'item', label: 'New Folder', onClick: createNewFolder },
                { type: 'item', label: 'New Text File', onClick: createNewFile },
                { type: 'separator' },
                { type: 'item', label: 'Paste', onClick: () => handlePaste(currentPath), disabled: !clipboard },
                { type: 'item', label: 'Refresh', onClick: fetchItems },
            ];
        }
        return [];
    }, [contextMenu, openItem, handleCopy, handleCut, handlePaste, clipboard, currentPath, fetchItems]);


    const breadcrumbs = ['Project Root', ...currentPath.split('/').filter(p => p)];
    const handleBreadcrumbClick = (index: number) => {
        const newPath = index === 0 ? '/' : '/' + breadcrumbs.slice(1, index + 1).join('/');
        navigateTo(newPath);
    };

    const quickAccessItems = [
        { path: '/', label: 'Project Root', icon: <FileExplorerIcon isSmall className="w-5 h-5 text-blue-400"/> },
        { path: '/Desktop', label: 'Desktop', icon: <FolderIcon className="w-5 h-5 text-amber-400" isSmall/> },
        { path: '/Documents', label: 'Documents', icon: <FolderIcon className="w-5 h-5 text-amber-400" isSmall/> },
        { path: '/Downloads', label: 'Downloads', icon: <FolderIcon className="w-5 h-5 text-amber-400" isSmall/> },
    ];
    
    return (
        <div className="flex h-full bg-black text-zinc-200 select-none" onClick={() => setContextMenu(null)}>
            {/* Sidebar */}
            <aside className="w-56 flex-shrink-0 bg-zinc-900/50 p-2 flex flex-col border-r border-zinc-800">
                <h3 className="px-2 pb-2 text-xs font-semibold text-zinc-400">Quick access</h3>
                <div className="space-y-1">
                    {quickAccessItems.map(item => (
                        <SidebarItem 
                            key={item.path}
                            icon={item.icon}
                            label={item.label}
                            onClick={() => navigateTo(item.path)}
                            isActive={currentPath === item.path}
                        />
                    ))}
                </div>
            </aside>

            <main className="flex-grow flex flex-col">
                <div className="flex-shrink-0 flex items-center space-x-2 p-2 border-b border-zinc-800 bg-black/50">
                    <button onClick={goBack} disabled={historyIndex === 0} className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed" title="Back">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                     <button onClick={goUp} disabled={currentPath === '/'} className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed" title="Up">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                    </button>
                    <div className="flex items-center bg-zinc-900 rounded p-1 text-sm flex-grow">
                        {breadcrumbs.map((crumb, i) => (
                            <React.Fragment key={i}>
                                <button onClick={() => handleBreadcrumbClick(i)} className="px-2 py-0.5 hover:bg-zinc-800 rounded">
                                    {crumb}
                                </button>
                                {i < breadcrumbs.length - 1 && <span className="text-zinc-500 mx-1">&gt;</span>}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <div className="flex-grow p-4 overflow-y-auto custom-scrollbar relative" onContextMenu={handleBackgroundContextMenu}>
                    {isLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-400">Loading...</div>
                    ) : itemsInCurrentPath.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                            {itemsInCurrentPath.map(item => (
                                <button 
                                    key={item.path} 
                                    onDoubleClick={() => openItem(item)} 
                                    onContextMenu={(e) => handleItemContextMenu(e, item)}
                                    className="flex flex-col items-center p-2 rounded hover:bg-white/10 transition-colors text-center aspect-square relative focus:outline-none focus:bg-blue-500/30"
                                >
                                    {item.type === 'folder' ? <FolderIcon className="w-12 h-12 text-amber-400" /> : getFileIcon(item.name)}
                                    {renamingItemPath === item.path ? (
                                        <input 
                                            type="text"
                                            value={renameValue}
                                            onChange={e => setRenameValue(e.target.value)}
                                            onBlur={handleRename}
                                            onKeyDown={e => e.key === 'Enter' && handleRename()}
                                            className="text-xs text-center text-black bg-white w-full border border-blue-500 mt-1.5"
                                            autoFocus
                                            onFocus={e => e.target.select()}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="text-xs mt-1.5 break-words w-full truncate">{item.name}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-zinc-400 mt-10">This folder is empty.</div>
                    )}
                </div>
            </main>
            
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenuItems}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
};

export const appDefinition: AppDefinition = {
    id: 'fileExplorer',
    name: 'File Explorer',
    icon: FileExplorerIcon,
    component: FileExplorerApp,
    defaultSize: { width: 800, height: 600 },
    isPinnedToTaskbar: true,
};

export default FileExplorerApp;
