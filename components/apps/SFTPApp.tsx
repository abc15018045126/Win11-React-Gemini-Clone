import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppComponentProps, AppDefinition, FilesystemItem as BaseFilesystemItem, ClipboardItem } from '../../types';
import { FolderIcon, FileGenericIcon, SftpIcon } from '../../constants';
import * as FsService from '../../services/filesystemService';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';

const pathHelper = {
    join: (...args: string[]) => args.join('/').replace(/\/+/g, '/'),
    dirname: (p: string) => {
        if (p === '/') return '/';
        const lastSlash = p.lastIndexOf('/');
        if (lastSlash === -1) return '.';
        if (lastSlash === 0) return '/';
        return p.substring(0, lastSlash);
    },
    basename: (p: string) => p.substring(p.lastIndexOf('/') + 1),
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
interface FilesystemItem extends BaseFilesystemItem { 
    size?: number;
    children?: FilesystemItem[];
}

// Recursive component to render the file tree
const FileTree: React.FC<{
    items: FilesystemItem[];
    onFileClick: (item: FilesystemItem) => void;
    onFolderClick: (item: FilesystemItem) => void;
    onItemContextMenu: (e: React.MouseEvent, item: FilesystemItem) => void;
    level?: number;
}> = ({ items, onFileClick, onFolderClick, onItemContextMenu, level = 0 }) => {
    return (
        <div className="space-y-0.5">
            {items.map(item => (
                <div key={item.path}>
                    <button
                        onDoubleClick={() => item.type === 'folder' ? onFolderClick(item) : onFileClick(item)}
                        onClick={() => item.type === 'folder' ? onFolderClick(item) : onFileClick(item)}
                        onContextMenu={(e) => onItemContextMenu(e, item)}
                        className="w-full flex items-center p-1 rounded text-left text-sm hover:bg-zinc-700/80"
                        style={{ paddingLeft: `${level * 16 + 4}px` }}
                        title={item.path}
                    >
                        {item.type === 'folder' 
                            ? <FolderIcon isSmall className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0"/> 
                            : <FileGenericIcon isSmall className="w-5 h-5 text-zinc-400 mr-2 flex-shrink-0"/>
                        }
                        <span className="truncate">{item.name}</span>
                    </button>
                    {item.children && item.children.length > 0 && (
                        <FileTree 
                            items={item.children} 
                            onFileClick={onFileClick}
                            onFolderClick={onFolderClick}
                            onItemContextMenu={onItemContextMenu}
                            level={level + 1}
                        />
                    )}
                </div>
            ))}
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
    
    // --- Tree State ---
    const [localTree, setLocalTree] = useState<FilesystemItem[]>([]);
    const [remoteTree, setRemoteTree] = useState<FilesystemItem[]>([]);
    const [localExpanded, setLocalExpanded] = useState<Set<string>>(new Set(['/']));
    const [remoteExpanded, setRemoteExpanded] = useState<Set<string>>(new Set(['.']));

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FilesystemItem; isLocal: boolean } | null>(null);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => { setTitle(`SFTP - ${status}`); }, [setTitle, status]);
    
    // --- Data Fetching and Tree Management ---
    const sortItems = (items: FilesystemItem[]) => items.sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1));

    const updateTreeData = (
        currentTree: FilesystemItem[], 
        path: string, 
        children: FilesystemItem[]
    ): FilesystemItem[] => {
        const newTree = JSON.parse(JSON.stringify(currentTree)); // Deep copy
        let currentLevel = newTree;
        
        if (path === '/' || path === '.') {
            return sortItems(children);
        }

        const pathParts = path.split('/').filter(p => p);
        let currentPath = path.startsWith('/') ? '/' : '';

        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            currentPath = pathHelper.join(currentPath, part);
            const node = currentLevel.find(item => item.path === currentPath);
            if (node) {
                if (i === pathParts.length - 1) {
                    node.children = sortItems(children);
                    break;
                }
                if (!node.children) node.children = [];
                currentLevel = node.children;
            } else {
                break; 
            }
        }
        return newTree;
    };

    const fetchAndExpand = useCallback(async (path: string, isLocal: boolean) => {
        if (isLocal) {
            const items = await FsService.listDirectory(path);
            setLocalTree(currentTree => updateTreeData(currentTree, path, items));
        } else if (ws.current?.readyState === WebSocket.OPEN) {
            setStatusMessage(`Listing directory ${path}...`);
            ws.current.send(JSON.stringify({ type: 'list', payload: { path } }));
        }
    }, []);

    const handleFolderClick = useCallback((item: FilesystemItem, isLocal: boolean) => {
        const expandedSet = isLocal ? localExpanded : remoteExpanded;
        const setExpanded = isLocal ? setLocalExpanded : setRemoteExpanded;
        const newExpanded = new Set(expandedSet);

        if (expandedSet.has(item.path)) {
            newExpanded.delete(item.path);
        } else {
            newExpanded.add(item.path);
            fetchAndExpand(item.path, isLocal);
        }
        setExpanded(newExpanded);
    }, [localExpanded, remoteExpanded, fetchAndExpand]);

    // Initial load
    useEffect(() => {
        fetch('http://localhost:3001/api/os-user')
            .then(res => res.ok ? res.json() : Promise.resolve({ username: 'user' }))
            .then(data => setUsername(data.username || 'user'));
        fetchAndExpand('/', true);
    }, [fetchAndExpand]);
    
    useEffect(() => () => { ws.current?.close(); }, []);
    
    // --- Connection Handling ---
    const handleConnect = useCallback(() => {
        if (!host || !port || !username) { setErrorMsg('Host, Port, and Username are required.'); return; }
        setStatus('connecting'); setErrorMsg(''); setStatusMessage(`Connecting to ${host}...`);

        ws.current = new WebSocket('ws://localhost:3003');
        ws.current.onopen = () => ws.current?.send(JSON.stringify({ type: 'connect', payload: { host, port, username, password } }));
        ws.current.onclose = () => { if (status !== 'error') { setStatus('disconnected'); setRemoteTree([]); setStatusMessage('Disconnected.'); }};
        ws.current.onerror = () => { const msg = 'Connection failed. Is the backend running?'; setErrorMsg(msg); setStatus('error'); setStatusMessage(msg);};
        ws.current.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case 'status':
                    if (msg.payload === 'connected') {
                        setStatus('connected'); setPassword(''); setStatusMessage('Connected. Listing root...');
                        fetchAndExpand('.', false); // Start at home dir for remote
                    } else {
                        setStatus('disconnected'); setStatusMessage('Disconnected.');
                    }
                    break;
                case 'list':
                    setStatusMessage(`Listed ${msg.payload.path}`);
                    setRemoteTree(currentTree => updateTreeData(currentTree, msg.payload.path, msg.payload.items));
                    break;
                case 'file_content':
                    handleOpenFileInNotebook(msg.payload.path, msg.payload.content);
                    break;
                case 'operation_success':
                    setStatusMessage(msg.payload.message);
                    fetchAndExpand(msg.payload.dirToRefresh, msg.payload.isLocal);
                    break;
                case 'error':
                    setErrorMsg(msg.payload); setStatus('error'); setStatusMessage(`Error: ${msg.payload}`);
                    ws.current?.close();
                    break;
            }
        };
    }, [host, port, username, password, status, fetchAndExpand]);
    
    const handleDisconnect = useCallback(() => { ws.current?.close(); }, []);

    // --- File Interaction Workflow ---
    const handleRemoteSave = useCallback((remotePath: string, newContent: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            setStatusMessage(`Uploading changes to ${pathHelper.basename(remotePath)}...`);
            ws.current.send(JSON.stringify({
                type: 'upload',
                payload: {
                    remoteDir: pathHelper.dirname(remotePath),
                    fileName: pathHelper.basename(remotePath),
                    fileData: newContent,
                    encoding: 'utf8' // Specify encoding
                }
            }));
        } else {
            alert("SFTP Connection lost. Could not save file to server.");
        }
    }, []);

    const handleOpenFileInNotebook = useCallback((remotePath: string, content: string) => {
        if (!openApp) return;
        setStatusMessage(`Opening ${remotePath} in Notebook...`);
        openApp('notebook', {
            initialData: {
                fileName: pathHelper.basename(remotePath),
                content: content,
                onSave: (newContent: string) => handleRemoteSave(remotePath, newContent),
            }
        });
    }, [openApp, handleRemoteSave]);
    
    const handleFileClick = useCallback((item: FilesystemItem, isLocal: boolean) => {
        if (isLocal) {
            openApp?.('notebook', { file: { path: item.path, name: item.name } });
        } else {
            if (ws.current?.readyState === WebSocket.OPEN) {
                setStatusMessage(`Fetching content for ${item.name}...`);
                ws.current.send(JSON.stringify({ type: 'get_content', payload: { path: item.path } }));
            }
        }
    }, [openApp]);

    // --- Context Menu and Actions ---
    const closeContextMenu = useCallback(() => setContextMenu(null), []);
    useEffect(() => {
        document.addEventListener('click', closeContextMenu);
        return () => document.removeEventListener('click', closeContextMenu);
    }, [closeContextMenu]);
    
    const onItemContextMenu = useCallback((e: React.MouseEvent, item: FilesystemItem, isLocal: boolean) => {
        e.preventDefault(); e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, item, isLocal });
    }, []);
    
     const handleCreate = useCallback(async (isFolder: boolean, item: FilesystemItem, isLocal: boolean) => {
        const name = prompt(`Enter name for new ${isFolder ? 'folder' : 'file'}:`);
        if (!name) return;
        const parentDir = item.path;
        setStatusMessage(`Creating ${name}...`);

        if(isLocal) {
            isFolder ? await FsService.createFolder(parentDir, name) : await FsService.createFile(parentDir, name, "");
            fetchAndExpand(parentDir, true);
        } else if (ws.current?.readyState === WebSocket.OPEN) {
            const type = isFolder ? 'create_folder' : 'create_file';
            ws.current.send(JSON.stringify({ type, payload: { parentDir, name } }));
        }
    }, [fetchAndExpand]);

    const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
        if (!contextMenu) return [];
        const { item, isLocal } = contextMenu;
        if (item.type !== 'folder') return []; // Only show context menu for folders for now

        return [
            { type: 'item', label: 'New Folder', onClick: () => handleCreate(true, item, isLocal) },
            { type: 'item', label: 'New File', onClick: () => handleCreate(false, item, isLocal) },
        ];
    }, [contextMenu, handleCreate]);


    // --- RENDER ---
    const buildTree = (
        rootItems: FilesystemItem[], 
        expandedPaths: Set<string>
    ): FilesystemItem[] => {
        const buildNode = (item: FilesystemItem): FilesystemItem => {
            const newItem = { ...item };
            if (expandedPaths.has(item.path) && item.children) {
                newItem.children = item.children.map(buildNode);
            } else {
                delete newItem.children;
            }
            return newItem;
        };
        return rootItems.map(buildNode);
    };

    const renderedLocalTree = useMemo(() => buildTree(localTree, localExpanded), [localTree, localExpanded]);
    const renderedRemoteTree = useMemo(() => buildTree(remoteTree, remoteExpanded), [remoteTree, remoteExpanded]);

    const FileListPane: React.FC<{ isLocal: boolean }> = ({ isLocal }) => {
        const title = isLocal ? 'Local Site' : 'Remote Site';
        const tree = isLocal ? renderedLocalTree : renderedRemoteTree;
        return (
            <div className="flex flex-col h-full bg-black/50 rounded-md border border-zinc-800">
                <div className="flex-shrink-0 p-2 border-b border-zinc-700">
                    <h3 className="font-semibold">{title}</h3>
                </div>
                <div className="flex-grow overflow-auto custom-scrollbar p-1">
                     <FileTree 
                        items={tree}
                        onFileClick={(item) => handleFileClick(item, isLocal)}
                        onFolderClick={(item) => handleFolderClick(item, isLocal)}
                        onItemContextMenu={(e, item) => onItemContextMenu(e, item, isLocal)}
                     />
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 text-white select-none">
            <div className="flex-shrink-0 flex items-center space-x-2 text-sm p-2 border-b border-zinc-700">
                <span>Host:</span> <input type="text" value={host} onChange={e => setHost(e.target.value)} disabled={status !== 'disconnected'} className="w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 disabled:opacity-50"/>
                <span>Port:</span> <input type="text" value={port} onChange={e => setPort(e.target.value)} disabled={status !== 'disconnected'} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 disabled:opacity-50"/>
                <span>User:</span> <input type="text" value={username} onChange={e => setUsername(e.target.value)} disabled={status !== 'disconnected'} className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 disabled:opacity-50"/>
                <span>Pass:</span> <input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={status !== 'disconnected'} onKeyDown={e => e.key === 'Enter' && handleConnect()} className="flex-grow bg-zinc-800 border border-zinc-700 rounded px-2 py-1 disabled:opacity-50"/>
                {status === 'connected' ? (
                    <button onClick={handleDisconnect} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded">Disconnect</button>
                ) : (
                    <button onClick={handleConnect} disabled={status === 'connecting'} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 rounded">
                        {status === 'connecting' ? 'Connecting...' : 'Connect'}
                    </button>
                )}
            </div>
            {errorMsg && <div className="flex-shrink-0 text-center py-1 bg-red-800/50 text-red-300 text-xs">{errorMsg}</div>}
            
            {status !== 'connected' ? (
                <div className="flex-grow flex items-center justify-center text-zinc-500">
                    <p>Please connect to a server to begin.</p>
                </div>
            ) : (
                <div className="flex-grow grid grid-cols-2 gap-3 p-3 overflow-hidden">
                    <FileListPane isLocal={true} />
                    <FileListPane isLocal={false} />
                </div>
            )}
            
            <div className="flex-shrink-0 h-10 border-t border-zinc-700 p-2 flex items-center text-xs">
                <p className="font-semibold mr-2">Status:</p> <div className="flex-grow text-zinc-400 p-1 truncate">{statusMessage}</div>
            </div>

            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={closeContextMenu} />}
        </div>
    );
};

export const appDefinition: AppDefinition = { id: 'sftp', name: 'SFTP Client', icon: SftpIcon, component: SFTPApp, defaultSize: { width: 950, height: 650 } };
export default SFTPApp;