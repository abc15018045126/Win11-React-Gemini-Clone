import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppComponentProps, AppDefinition, FilesystemItem as BaseFilesystemItem } from '../../types';
import { FolderIcon, FileGenericIcon, SftpIcon } from '../../constants';
import * as FsService from '../../services/filesystemService';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';


type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface FilesystemItem extends BaseFilesystemItem {
    depth: number;
    size?: number;
    modified?: number;
}

const TreeArrow: React.FC<{ depth: number, isExpanded: boolean, isFolder: boolean, onClick: (e: React.MouseEvent) => void }> = 
({ depth, isExpanded, isFolder, onClick }) => (
    <div style={{ paddingLeft: `${depth * 16}px` }} className="flex-shrink-0 w-8 text-center" onClick={onClick}>
        {isFolder && (isExpanded ? '▾' : '▸')}
    </div>
);

const FileListItem: React.FC<{ 
    item: FilesystemItem, 
    onToggleExpand: () => void, 
    onDoubleClick: () => void, 
    isExpanded: boolean,
    onContextMenu: (e: React.MouseEvent) => void,
    isRenaming: boolean,
    renameValue: string,
    onRenameChange: (val: string) => void,
    onRenameSubmit: () => void
}> = ({ item, onToggleExpand, onDoubleClick, isExpanded, onContextMenu, isRenaming, renameValue, onRenameChange, onRenameSubmit }) => (
    <button onDoubleClick={onDoubleClick} onContextMenu={onContextMenu} className="w-full flex items-center p-1 hover:bg-zinc-700 rounded text-left text-sm">
        <TreeArrow depth={item.depth} isExpanded={isExpanded} isFolder={item.type === 'folder'} onClick={(e) => {
            e.stopPropagation();
            if (item.type === 'folder') onToggleExpand();
        }} />
        {item.type === 'folder' 
            ? <FolderIcon isSmall className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0"/> 
            : <FileGenericIcon isSmall className="w-5 h-5 text-zinc-400 mr-2 flex-shrink-0"/>
        }
        <div className="flex-grow whitespace-nowrap overflow-hidden">
            {isRenaming ? (
                 <input 
                    type="text"
                    value={renameValue}
                    onChange={e => onRenameChange(e.target.value)}
                    onBlur={onRenameSubmit}
                    onKeyDown={e => { if (e.key === 'Enter') onRenameSubmit(); if(e.key === 'Escape') onRenameChange(item.name); }}
                    className="text-sm text-black bg-white w-full border border-blue-500"
                    autoFocus
                    onFocus={e => e.target.select()}
                    onClick={e => e.stopPropagation()}
                />
            ) : (
                <span className="flex-grow whitespace-nowrap">{item.name}</span>
            )}
        </div>
        {item.size !== undefined && <span className="text-xs text-zinc-500 w-24 text-right flex-shrink-0 pr-2">{item.size}</span>}
    </button>
);


const FileListPane: React.FC<{ 
    title: string, 
    items: FilesystemItem[],
    onItemDoubleClick: (item: FilesystemItem) => void,
    onToggleExpand: (item: FilesystemItem) => void,
    expandedPaths: Set<string>,
    onItemContextMenu: (e: React.MouseEvent, item: FilesystemItem) => void,
    onBackgroundContextMenu: (e: React.MouseEvent) => void,
    renamingPath: string | null,
    renameValue: string,
    onRenameChange: (val: string) => void,
    onRenameSubmit: () => void
}> = ({ title, items, onItemDoubleClick, onToggleExpand, expandedPaths, onItemContextMenu, onBackgroundContextMenu, renamingPath, renameValue, onRenameChange, onRenameSubmit }) => {
    
    return (
        <div className="flex flex-col h-full bg-black/50 rounded-md border border-zinc-800" onContextMenu={onBackgroundContextMenu}>
            <div className="flex-shrink-0 p-2 border-b border-zinc-700">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-xs text-zinc-400 truncate flex-grow">{items[0]?.path ? path.dirname(items[0].path) : '/'}</p>
            </div>
            <div className="flex-grow overflow-y-auto overflow-x-auto custom-scrollbar p-1">
                <div className="space-y-0.5 min-w-full w-max">
                    {items.map(item => (
                        <FileListItem 
                            key={item.path} 
                            item={item} 
                            onDoubleClick={() => onItemDoubleClick(item)}
                            onToggleExpand={() => onToggleExpand(item)}
                            isExpanded={expandedPaths.has(item.path)}
                            onContextMenu={(e) => onItemContextMenu(e, item)}
                            isRenaming={renamingPath === item.path}
                            renameValue={renameValue}
                            onRenameChange={onRenameChange}
                            onRenameSubmit={onRenameSubmit}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};


const SFTPApp: React.FC<AppComponentProps> = ({ setTitle, openApp }) => {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [host, setHost] = useState('127.0.0.1');
    const [port, setPort] = useState('22');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [statusMessage, setStatusMessage] = useState('Not connected.');
    
    const [localPath, setLocalPath] = useState('/');
    const [remotePath, setRemotePath] = useState('.');
    const [localItems, setLocalItems] = useState<FilesystemItem[]>([]);
    const [remoteItems, setRemoteItems] = useState<FilesystemItem[]>([]);
    const [expandedLocal, setExpandedLocal] = useState(new Set<string>());
    const [expandedRemote, setExpandedRemote] = useState(new Set<string>());

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item?: FilesystemItem; isLocal: boolean, dirPath: string } | null>(null);
    const [renamingItem, setRenamingItem] = useState<{ path: string, isLocal: boolean } | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const ws = useRef<WebSocket | null>(null);

    // --- Effects ---
    useEffect(() => {
        setTitle(`SFTP - ${status}`);
    }, [setTitle, status]);

    useEffect(() => {
        fetch('http://localhost:3001/api/os-user')
            .then(res => res.ok ? res.json() : Promise.resolve({ username: 'user' }))
            .then(data => setUsername(data.username || 'user'));
        
        fetchLocalFiles(localPath, true);
    }, []);

    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        document.addEventListener('click', closeMenu);
        return () => {
            ws.current?.close();
            document.removeEventListener('click', closeMenu);
        };
    }, []);

    // --- Data Fetching & State Refreshing ---
    const refreshDirectory = useCallback((dirPath: string, isLocal: boolean) => {
        const [items, expanded, setExpanded, setItems, fetchFiles] = isLocal 
            ? [localItems, expandedLocal, setExpandedLocal, setLocalItems, fetchLocalFiles]
            : [remoteItems, expandedRemote, setExpandedRemote, setRemoteItems, fetchRemoteFiles];

        const dirItem = items.find(i => i.path === dirPath);

        // If it's a root path or not found (which it shouldn't be), just refetch the root
        if (!dirItem || (isLocal && dirPath === '/') || (!isLocal && dirPath === '.')) {
            isLocal ? fetchLocalFiles(dirPath, true) : fetchRemoteFiles(dirPath);
            return;
        }

        if (expanded.has(dirPath)) {
            // Collapse: remove children
            setItems(prevItems => {
                const parentIndex = prevItems.findIndex(it => it.path === dirPath);
                if (parentIndex === -1) return prevItems;
                let endIndex = parentIndex + 1;
                while(endIndex < prevItems.length && prevItems[endIndex].depth > dirItem.depth) {
                    endIndex++;
                }
                const newItems = [...prevItems];
                newItems.splice(parentIndex + 1, endIndex - (parentIndex + 1));
                return newItems;
            });
            
            // Re-expand after a short delay to fetch new children
            setTimeout(() => fetchFiles(dirPath, false), 50);
        }
    }, [localItems, remoteItems, expandedLocal, expandedRemote]);

    const fetchLocalFiles = useCallback(async (path: string, isRoot = false) => {
        const newItems = await FsService.listDirectory(path);
        const enhancedItems = newItems.map(item => ({...item, depth: (path.match(/\//g) || []).length - (path === '/' ? 1: 0) + 1}));
    
        if (isRoot) {
            setLocalItems(enhancedItems.map(i => ({...i, depth: 0})));
        } else {
            setLocalItems(prev => {
                const parentIndex = prev.findIndex(it => it.path === path);
                const newArr = [...prev];
                if(parentIndex !== -1) newArr.splice(parentIndex + 1, 0, ...enhancedItems);
                return newArr;
            });
        }
    }, []);
    
    const fetchRemoteFiles = useCallback((path: string, isRoot = false) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            setStatusMessage(`Listing directory ${path}...`);
            ws.current.send(JSON.stringify({ type: 'list', payload: { path, isRoot } }));
        }
    }, []);

    // --- WebSocket Connection ---
    const handleConnect = useCallback(() => {
        if (!host || !port || !username || !password) {
            setErrorMsg('All connection fields are required.');
            return;
        }
        setStatus('connecting');
        setErrorMsg('');
        setStatusMessage(`Connecting to ${host}...`);

        ws.current = new WebSocket('ws://localhost:3003');

        ws.current.onopen = () => {
            ws.current?.send(JSON.stringify({ type: 'connect', payload: { host, port, username, password } }));
        };

        ws.current.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case 'status':
                    if (msg.payload === 'connected') {
                        setStatus('connected');
                        setPassword('');
                        setStatusMessage('Connection established. Listing root directory...');
                        fetchRemoteFiles(remotePath, true);
                    } else {
                        setStatus('disconnected');
                        setStatusMessage('Disconnected.');
                    }
                    break;
                case 'list':
                    setStatusMessage(`Directory listing successful for ${msg.payload.path}`);
                     const newChildren = msg.payload.items
                        .sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1))
                        .map(child => ({...child, depth: (msg.payload.path.match(/[\\/]/g) || []).length + (msg.payload.path === '.' ? 0 : 1)}));

                    if (msg.payload.isRoot) {
                         setRemoteItems(newChildren.map(c => ({...c, depth: 0})));
                    } else {
                        setRemoteItems(prev => {
                            const parentIndex = prev.findIndex(it => it.path === msg.payload.path);
                            const newArr = [...prev];
                            if(parentIndex !== -1) newArr.splice(parentIndex + 1, 0, ...newChildren);
                            return newArr;
                        });
                    }
                    break;
                case 'download_complete':
                    setStatusMessage(`Downloaded ${path.basename(msg.payload.remotePath)}. Opening...`);
                    openApp?.('notebook', { file: { path: msg.payload.localPath } });
                    break;
                case 'operation_success':
                    setStatusMessage(msg.payload.message);
                    refreshDirectory(msg.payload.dirToRefresh, false);
                    break;
                case 'upload_status':
                    if (msg.payload.status === 'started') {
                        setStatusMessage(`Uploading changes to ${path.basename(msg.payload.remotePath)}...`);
                    } else if (msg.payload.status === 'complete') {
                        setStatusMessage(`Successfully saved ${path.basename(msg.payload.remotePath)} to server.`);
                    } else if (msg.payload.status === 'error') {
                        setStatusMessage(`Error saving ${path.basename(msg.payload.remotePath)}: ${msg.payload.error}`);
                    }
                    break;
                case 'error':
                    setErrorMsg(msg.payload);
                    setStatus('error');
                    setStatusMessage(`Error: ${msg.payload}`);
                    ws.current?.close();
                    break;
            }
        };

        ws.current.onerror = () => {
            const msg = 'WebSocket connection failed. Ensure the backend server is running.';
            setErrorMsg(msg);
            setStatus('error');
            setStatusMessage(msg);
        };

        ws.current.onclose = () => {
            if (status !== 'error') {
                setStatus('disconnected');
                setRemoteItems([]);
                setStatusMessage('Disconnected.');
            }
        };
    }, [host, port, username, password, remotePath, status, fetchRemoteFiles, openApp, refreshDirectory]);

    const handleDisconnect = () => {
        ws.current?.send(JSON.stringify({ type: 'disconnect' }));
        ws.current?.close();
    };

    // --- UI Actions & Handlers ---
    const handleToggleExpand = (item: FilesystemItem, isLocal: boolean) => {
        const [expanded, setExpanded, fetchFiles, setItems] = isLocal 
            ? [expandedLocal, setExpandedLocal, fetchLocalFiles, setLocalItems]
            : [expandedRemote, setExpandedRemote, fetchRemoteFiles, setRemoteItems];

        if (expanded.has(item.path)) {
            setExpanded(prev => { const newSet = new Set(prev); newSet.delete(item.path); return newSet; });
            setItems(prevItems => {
                const parentIndex = prevItems.findIndex(it => it.path === item.path);
                if(parentIndex === -1) return prevItems;
                let endIndex = parentIndex + 1;
                while(endIndex < prevItems.length && prevItems[endIndex].depth > item.depth) {
                    endIndex++;
                }
                const newItems = [...prevItems];
                newItems.splice(parentIndex + 1, endIndex - (parentIndex + 1));
                return newItems;
            });
        } else {
            setExpanded(prev => new Set(prev).add(item.path));
            fetchFiles(item.path, false);
        }
    };

    const handleItemDoubleClick = (item: FilesystemItem, isLocal: boolean) => {
        if (item.type === 'folder') {
            handleToggleExpand(item, isLocal);
        } else if (!isLocal) { // Remote file double-click
            setStatusMessage(`Downloading ${item.name}...`);
            ws.current?.send(JSON.stringify({ type: 'download_and_track', payload: item.path }));
        } else { // Local file double-click
            openApp?.('notebook', { file: { path: item.path } });
        }
    };
    
    // --- Context Menu Handlers ---
    const handleItemContextMenu = (e: React.MouseEvent, item: FilesystemItem, isLocal: boolean) => {
        e.preventDefault(); e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, item, isLocal, dirPath: item.type === 'folder' ? item.path : path.dirname(item.path) });
    };

    const handleBackgroundContextMenu = (e: React.MouseEvent, isLocal: boolean) => {
        e.preventDefault(); e.stopPropagation();
        const dirPath = isLocal ? localPath : remotePath;
        setContextMenu({ x: e.clientX, y: e.clientY, isLocal, dirPath });
    };

    const handleUpload = async (item: FilesystemItem, remoteDir: string) => {
        if (item.type === 'folder') {
            setStatusMessage('Folder uploads not supported yet.'); return;
        }
        setStatusMessage(`Reading ${item.name} for upload...`);
        const file = await FsService.readFileAsBase64(item.path);
        if (file && file.content) {
            ws.current?.send(JSON.stringify({ type: 'upload', payload: { remoteDir, fileName: item.name, fileData: file.content }}));
            setStatusMessage(`Uploading ${item.name} to ${remoteDir}...`);
        } else {
            setStatusMessage(`Error: Could not read local file ${item.name}.`);
        }
    };

    const handleNewItem = async (isLocal: boolean, isFolder: boolean, parentDir: string) => {
        const type = isFolder ? 'folder' : 'file';
        const name = window.prompt(`Enter name for new ${type}:`);
        if (!name) return;
    
        if (isLocal) {
            isFolder ? await FsService.createFolder(parentDir, name) : await FsService.createFile(parentDir, name, "");
            refreshDirectory(parentDir, true);
        } else {
            const messageType = isFolder ? 'create_folder' : 'create_file';
            ws.current?.send(JSON.stringify({ type: messageType, payload: { parentDir, name } }));
        }
    };

    const handleDeleteItem = async (item: FilesystemItem, isLocal: boolean) => {
        if (!window.confirm(`Are you sure you want to delete ${item.name}?`)) return;
        if (isLocal) {
            await FsService.deleteItem(item);
            refreshDirectory(path.dirname(item.path), true);
        } else {
            ws.current?.send(JSON.stringify({ type: 'delete_item', payload: { item } }));
        }
    };

    const handleRenameSubmit = async () => {
        if (!renamingItem) return;
        const { path: itemPath, isLocal } = renamingItem;
        const items = isLocal ? localItems : remoteItems;
        const item = items.find(i => i.path === itemPath);

        if (item && renameValue && item.name !== renameValue) {
            if (isLocal) {
                await FsService.renameItem(item, renameValue);
                refreshDirectory(path.dirname(item.path), true);
            } else {
                ws.current?.send(JSON.stringify({ type: 'rename_item', payload: { item, newName: renameValue } }));
            }
        }
        setRenamingItem(null);
    };

    const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
        if (!contextMenu) return [];
        const { item, isLocal, dirPath } = contextMenu;
        
        let items: ContextMenuItem[] = [];

        if (item) { // Clicked on an item
            if (isLocal) {
                if (item.type === 'file') items.push({ type: 'item', label: 'Open', onClick: () => openApp?.('notebook', { file: { path: item.path } }) });
                items.push({ type: 'item', label: 'Upload', onClick: () => handleUpload(item, remotePath), disabled: status !== 'connected' || item.type === 'folder' });
            } else {
                if (item.type === 'file') items.push({ type: 'item', label: 'Download & Edit', onClick: () => handleItemDoubleClick(item, false) });
            }
            items.push({ type: 'item', label: 'Delete', onClick: () => handleDeleteItem(item, isLocal) });
            items.push({ type: 'item', label: 'Rename', onClick: () => { setRenamingItem({ path: item.path, isLocal }); setRenameValue(item.name); }});
        }
        
        if(item && item.type === 'folder') items.push({ type: 'separator' });
        
        // Actions for the directory (either clicked folder or background)
        if(dirPath) {
            items.push({ type: 'item', label: 'New File', onClick: () => handleNewItem(isLocal, false, dirPath) });
            items.push({ type: 'item', label: 'New Folder', onClick: () => handleNewItem(isLocal, true, dirPath) });
        }
        
        items.push({ type: 'separator' });
        items.push({ type: 'item', label: 'Refresh', onClick: () => refreshDirectory(dirPath || (isLocal ? localPath : remotePath), isLocal) });

        return items;
    }, [contextMenu, status, remotePath, localPath, openApp, refreshDirectory]);


    return (
        <div className="flex flex-col h-full bg-zinc-900 text-white" onClick={() => setContextMenu(null)}>
            <div className="flex-shrink-0 flex items-center space-x-2 text-sm p-2 border-b border-zinc-700">
                <span>Host:</span>
                <input type="text" value={host} onChange={e => setHost(e.target.value)} disabled={status === 'connecting' || status === 'connected'} className="w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 disabled:bg-zinc-800/50"/>
                <span>Port:</span>
                <input type="text" value={port} onChange={e => setPort(e.target.value)} disabled={status === 'connecting' || status === 'connected'} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 disabled:bg-zinc-800/50"/>
                <span>User:</span>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} disabled={status === 'connecting' || status === 'connected'} className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 disabled:bg-zinc-800/50"/>
                <span>Pass:</span>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={status === 'connecting' || status === 'connected'} onKeyDown={e => e.key === 'Enter' && handleConnect()} className="flex-grow bg-zinc-800 border border-zinc-700 rounded px-2 py-1 disabled:bg-zinc-800/50"/>
                {status === 'connected' ? (
                    <button onClick={handleDisconnect} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded">Disconnect</button>
                ) : (
                    <button onClick={handleConnect} disabled={status === 'connecting'} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 rounded">
                        {status === 'connecting' ? 'Connecting...' : 'Connect'}
                    </button>
                )}
            </div>
            
            {errorMsg && <div className="flex-shrink-0 text-center py-1 bg-red-800/50 text-red-300 text-xs">{errorMsg}</div>}

            <div className="flex-grow grid grid-cols-2 gap-3 p-3 overflow-hidden">
                <FileListPane 
                    title="Local Site" 
                    items={localItems}
                    onItemDoubleClick={(item) => handleItemDoubleClick(item, true)}
                    onToggleExpand={(item) => handleToggleExpand(item, true)}
                    expandedPaths={expandedLocal}
                    onItemContextMenu={(e, item) => handleItemContextMenu(e, item, true)}
                    onBackgroundContextMenu={(e) => handleBackgroundContextMenu(e, true)}
                    renamingPath={renamingItem?.isLocal ? renamingItem.path : null}
                    renameValue={renameValue}
                    onRenameChange={setRenameValue}
                    onRenameSubmit={handleRenameSubmit}
                />
                 <FileListPane 
                    title="Remote Site" 
                    items={remoteItems}
                    onItemDoubleClick={(item) => handleItemDoubleClick(item, false)}
                    onToggleExpand={(item) => handleToggleExpand(item, false)}
                    expandedPaths={expandedRemote}
                    onItemContextMenu={(e, item) => handleItemContextMenu(e, item, false)}
                    onBackgroundContextMenu={(e) => handleBackgroundContextMenu(e, false)}
                    renamingPath={!renamingItem?.isLocal ? renamingItem?.path : null}
                    renameValue={renameValue}
                    onRenameChange={setRenameValue}
                    onRenameSubmit={handleRenameSubmit}
                />
            </div>
            
            <div className="flex-shrink-0 h-10 border-t border-zinc-700 p-2 flex items-center text-xs">
                <p className="font-semibold mr-2">Status:</p>
                <div className="flex-grow text-zinc-400 p-1 truncate">{statusMessage}</div>
            </div>

            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />}
        </div>
    );
};

// Dummy path utils for frontend
const path = {
    basename: (p: string) => p.split(/[\\/]/).pop() || '',
    dirname: (p: string) => {
        if (p === '/' || p === '.') return p;
        const lastSlash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
        if (lastSlash === -1) return '.';
        if (lastSlash === 0) return '/';
        return p.substring(0, lastSlash);
    },
    join: (...args: string[]) => {
        // A simplified path join that handles both Unix and Windows separators
        const parts = args.flatMap(part => part.split(/[\\/]/)).filter(p => p && p !== '.');
        const first = args[0] || '';
        const isAbsolute = first.startsWith('/') || /^[a-zA-Z]:/.test(first);
        let result = parts.join('/');
        if(isAbsolute) result = '/' + result;
        return result.replace(/\/+/g, '/');
    }
};

export const appDefinition: AppDefinition = {
  id: 'sftp',
  name: 'SFTP Client',
  icon: SftpIcon,
  component: SFTPApp,
  defaultSize: { width: 900, height: 600 },
};

export default SFTPApp;