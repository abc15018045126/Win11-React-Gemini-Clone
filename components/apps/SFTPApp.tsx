import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppComponentProps, AppDefinition, FilesystemItem as BaseFilesystemItem } from '../../types';
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
interface FilesystemItem extends BaseFilesystemItem { size?: number; }

const SFTPApp: React.FC<AppComponentProps> = ({ setTitle }) => {
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
    
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item?: FilesystemItem; isLocal: boolean } | null>(null);
    const [renamingItem, setRenamingItem] = useState<{ path: string; isLocal: boolean } | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [draggedItem, setDraggedItem] = useState<{ item: FilesystemItem; isLocal: boolean } | null>(null);
    const [dropTarget, setDropTarget] = useState<{ path: string; isFolder: boolean; isLocal: boolean } | null>(null);
    
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => { setTitle(`SFTP - ${status}`); }, [setTitle, status]);

    const sortItems = (items: FilesystemItem[]) => items.sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1));

    const refreshLocal = useCallback(async (path: string) => {
        const items = await FsService.listDirectory(path);
        setLocalItems(sortItems(items));
    }, []);

    const refreshRemote = useCallback((path: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            setStatusMessage(`Listing directory ${path}...`);
            ws.current.send(JSON.stringify({ type: 'list', payload: { path } }));
        }
    }, []);

    useEffect(() => {
        fetch('http://localhost:3001/api/os-user')
            .then(res => res.ok ? res.json() : Promise.resolve({ username: 'user' }))
            .then(data => setUsername(data.username || 'user'));
        refreshLocal('/');
    }, [refreshLocal]);
    
    useEffect(() => () => { ws.current?.close(); }, []);

    const handleConnect = useCallback(() => {
        if (!host || !port || !username) { setErrorMsg('Host, Port, and Username are required.'); return; }
        setStatus('connecting'); setErrorMsg(''); setStatusMessage(`Connecting to ${host}...`);

        ws.current = new WebSocket('ws://localhost:3003');
        ws.current.onopen = () => ws.current?.send(JSON.stringify({ type: 'connect', payload: { host, port, username, password } }));
        ws.current.onclose = () => { if (status !== 'error') { setStatus('disconnected'); setRemoteItems([]); setStatusMessage('Disconnected.'); }};
        ws.current.onerror = () => { const msg = 'Connection failed. Is the backend running?'; setErrorMsg(msg); setStatus('error'); setStatusMessage(msg);};
        ws.current.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case 'status':
                    if (msg.payload === 'connected') {
                        setStatus('connected'); setPassword(''); setStatusMessage('Connected. Listing root...');
                        refreshRemote('.'); // Start at home dir for remote
                    } else {
                        setStatus('disconnected'); setStatusMessage('Disconnected.');
                    }
                    break;
                case 'list':
                    setStatusMessage(`Listed ${msg.payload.path}`);
                    setRemoteItems(sortItems(msg.payload.items));
                    setRemotePath(msg.payload.path);
                    break;
                case 'operation_success':
                    setStatusMessage(msg.payload.message);
                    if (msg.payload.isLocal) refreshLocal(msg.payload.dirToRefresh);
                    else refreshRemote(msg.payload.dirToRefresh);
                    break;
                case 'error':
                    setErrorMsg(msg.payload); setStatus('error'); setStatusMessage(`Error: ${msg.payload}`);
                    ws.current?.close();
                    break;
            }
        };
    }, [host, port, username, password, status, refreshRemote]);

    const handleDisconnect = useCallback(() => { ws.current?.close(); }, []);
    
    // --- UI Interaction Handlers ---
    const handleItemDoubleClick = useCallback((item: FilesystemItem, isLocal: boolean) => {
        if (item.type === 'folder') {
            const newPath = isLocal ? pathHelper.join(localPath, item.name) : pathHelper.join(remotePath, item.name);
            if (isLocal) { setLocalPath(newPath); refreshLocal(newPath); }
            else refreshRemote(newPath);
        }
    }, [localPath, remotePath, refreshLocal, refreshRemote]);

    const handlePathChange = useCallback((newPath: string, isLocal: boolean) => {
        if(isLocal) setLocalPath(newPath); else setRemotePath(newPath);
    }, []);
    
    const handlePathRefresh = useCallback((isLocal: boolean) => {
        if(isLocal) refreshLocal(localPath); else refreshRemote(remotePath);
    }, [localPath, remotePath, refreshLocal, refreshRemote]);

    // --- Context Menu Handlers ---
    const closeContextMenu = useCallback(() => setContextMenu(null), []);
    useEffect(() => {
        document.addEventListener('click', closeContextMenu);
        return () => document.removeEventListener('click', closeContextMenu);
    }, [closeContextMenu]);
    
    const handlePaneContextMenu = useCallback((e: React.MouseEvent, isLocal: boolean) => {
        e.preventDefault(); e.stopPropagation();
        if ((e.target as HTMLElement).closest('button')) return;
        setContextMenu({ x: e.clientX, y: e.clientY, isLocal });
    }, []);

    const handleItemContextMenu = useCallback((e: React.MouseEvent, item: FilesystemItem, isLocal: boolean) => {
        e.preventDefault(); e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, item, isLocal });
    }, []);

    // --- Action Handlers ---
    const handleUpload = useCallback(async (item: FilesystemItem) => {
        if (ws.current?.readyState !== WebSocket.OPEN) return;
        setStatusMessage(`Uploading ${item.name}...`);
        const file = await FsService.readFileAsBase64(item.path);
        if(file) {
            ws.current.send(JSON.stringify({ type: 'upload', payload: { remoteDir: remotePath, fileName: item.name, fileData: file.content }}));
        }
    }, [remotePath]);
    
    const handleDownload = useCallback((item: FilesystemItem) => {
        if (ws.current?.readyState !== WebSocket.OPEN) return;
        setStatusMessage(`Downloading ${item.name}...`);
        ws.current.send(JSON.stringify({ type: 'download', payload: { remotePath: item.path, localDir: localPath, fileName: item.name }}));
    }, [localPath]);

    const handleCreate = useCallback(async (isFolder: boolean, isLocal: boolean) => {
        const name = prompt(`Enter name for new ${isFolder ? 'folder' : 'file'}:`);
        if (!name) return;
        const parentDir = isLocal ? localPath : remotePath;
        setStatusMessage(`Creating ${name}...`);

        if(isLocal) {
            isFolder ? await FsService.createFolder(parentDir, name) : await FsService.createFile(parentDir, name, "");
            refreshLocal(parentDir);
        } else if (ws.current?.readyState === WebSocket.OPEN) {
            const type = isFolder ? 'create_folder' : 'create_file';
            ws.current.send(JSON.stringify({ type, payload: { parentDir, name } }));
        }
    }, [localPath, remotePath, refreshLocal]);

    const handleDelete = useCallback(async (item: FilesystemItem, isLocal: boolean) => {
        if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
        setStatusMessage(`Deleting ${item.name}...`);
        if(isLocal) {
            await FsService.deleteItem(item);
            refreshLocal(pathHelper.dirname(item.path));
        } else if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'delete', payload: { item } }));
        }
    }, [refreshLocal]);
    
    const handleRenameStart = useCallback((item: FilesystemItem, isLocal: boolean) => {
        setRenamingItem({ path: item.path, isLocal });
        setRenameValue(item.name);
    }, []);

    const handleRenameSubmit = useCallback(async () => {
        if (!renamingItem) return;
        const parentDir = pathHelper.dirname(renamingItem.path);
        const item = (renamingItem.isLocal ? localItems : remoteItems).find(i => i.path === renamingItem.path);
        
        if (item && renameValue && item.name !== renameValue) {
            setStatusMessage(`Renaming ${item.name} to ${renameValue}...`);
            if (renamingItem.isLocal) {
                await FsService.renameItem(item, renameValue);
                refreshLocal(parentDir);
            } else if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ type: 'rename', payload: { item, newName: renameValue } }));
            }
        }
        setRenamingItem(null);
    }, [renamingItem, renameValue, localItems, remoteItems, refreshLocal]);
    
    // --- Drag and Drop Handlers ---
    const onDragStart = useCallback((e: React.DragEvent, item: FilesystemItem, isLocal: boolean) => {
        setDraggedItem({ item, isLocal });
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

    const onDragEnter = useCallback((e: React.DragEvent, item: FilesystemItem | null, isLocal: boolean) => {
        e.preventDefault();
        if (item) setDropTarget({ path: item.path, isFolder: item.type === 'folder', isLocal });
        else setDropTarget({ path: isLocal ? localPath : remotePath, isFolder: true, isLocal });
    }, [localPath, remotePath]);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        // Basic check to prevent flickering when moving over child elements
        if (! (e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
             setDropTarget(null);
        }
    }, []);

    const onDrop = useCallback(async (e: React.DragEvent, dropOnItem: FilesystemItem | null, isLocalPane: boolean) => {
        e.preventDefault();
        setDropTarget(null);
        if (!draggedItem) return;
        
        const destFolder = dropOnItem && dropOnItem.type === 'folder' ? dropOnItem.path : (isLocalPane ? localPath : remotePath);
        
        // --- Prevent dropping file on itself or folder into itself ---
        if (draggedItem.item.path === destFolder) return;
        
        // 1. Local to Remote (Upload)
        if (draggedItem.isLocal && !isLocalPane) {
            handleUpload(draggedItem.item);
        }
        // 2. Remote to Local (Download)
        else if (!draggedItem.isLocal && isLocalPane) {
            handleDownload(draggedItem.item);
        }
        // 3. Local to Local (Move)
        else if (draggedItem.isLocal && isLocalPane) {
            setStatusMessage(`Moving ${draggedItem.item.name}...`);
            await FsService.moveItem(draggedItem.item, destFolder);
            refreshLocal(localPath);
            if(pathHelper.dirname(draggedItem.item.path) !== destFolder) refreshLocal(pathHelper.dirname(draggedItem.item.path));
        }
        // 4. Remote to Remote (Move)
        else if (!draggedItem.isLocal && !isLocalPane) {
             if (ws.current?.readyState === WebSocket.OPEN) {
                const destPath = pathHelper.join(destFolder, draggedItem.item.name);
                setStatusMessage(`Moving ${draggedItem.item.name}...`);
                ws.current.send(JSON.stringify({ type: 'move', payload: { sourcePath: draggedItem.item.path, destPath } }));
            }
        }
    }, [draggedItem, localPath, remotePath, handleUpload, handleDownload, refreshLocal]);
    
    const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
        if (!contextMenu) return [];
        const { item, isLocal } = contextMenu;

        const menu: ContextMenuItem[] = [];

        if (item) { // Right-clicked on an item
            if (isLocal) menu.push({ type: 'item', label: 'Upload', onClick: () => handleUpload(item), disabled: status !== 'connected' });
            else menu.push({ type: 'item', label: 'Download', onClick: () => handleDownload(item), disabled: status !== 'connected' });
            menu.push({ type: 'separator' });
            menu.push({ type: 'item', label: 'Delete', onClick: () => handleDelete(item, isLocal) });
            menu.push({ type: 'item', label: 'Rename', onClick: () => handleRenameStart(item, isLocal) });
        } else { // Right-clicked on pane background
            menu.push({ type: 'item', label: 'New Folder', onClick: () => handleCreate(true, isLocal) });
            menu.push({ type: 'item', label: 'New File', onClick: () => handleCreate(false, isLocal) });
            menu.push({ type: 'item', label: 'Refresh', onClick: () => isLocal ? refreshLocal(localPath) : refreshRemote(remotePath) });
        }
        return menu;
    }, [contextMenu, handleUpload, handleDownload, handleDelete, handleRenameStart, handleCreate, localPath, remotePath, refreshLocal, refreshRemote, status]);
    
    // --- RENDER ---
    const FileListItem: React.FC<{ item: FilesystemItem; isLocal: boolean; }> = ({ item, isLocal }) => (
        <button
            draggable
            onDragStart={(e) => onDragStart(e, item, isLocal)}
            onDragEnter={(e) => onDragEnter(e, item, isLocal)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, item, isLocal)}
            onDoubleClick={() => handleItemDoubleClick(item, isLocal)}
            onContextMenu={(e) => handleItemContextMenu(e, item, isLocal)}
            className={`w-full flex items-center p-1 rounded text-left text-sm transition-colors duration-100
            ${dropTarget?.path === item.path && dropTarget.isFolder ? 'bg-blue-500/50' : 'hover:bg-zinc-700/80'}
            `}
        >
            {item.type === 'folder' 
                ? <FolderIcon isSmall className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0"/> 
                : <FileGenericIcon isSmall className="w-5 h-5 text-zinc-400 mr-2 flex-shrink-0"/>
            }
            <div className="flex-grow whitespace-nowrap overflow-hidden text-ellipsis">
            {renamingItem?.path === item.path ? (
                 <input 
                    type="text" value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit} onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()}
                    className="text-sm bg-white text-black w-full" autoFocus onFocus={e => e.target.select()}
                    onClick={e => e.stopPropagation()}
                />
            ) : (
                <span>{item.name}</span>
            )}
            </div>
            {item.size !== undefined && <span className="text-xs text-zinc-500 w-24 text-right flex-shrink-0 pr-2">{item.size}</span>}
        </button>
    );

    const FileListPane: React.FC<{ isLocal: boolean }> = ({ isLocal }) => {
        const title = isLocal ? 'Local Site' : 'Remote Site';
        const path = isLocal ? localPath : remotePath;
        const items = isLocal ? localItems : remoteItems;

        return (
            <div 
                className={`flex flex-col h-full bg-black/50 rounded-md border-2 
                ${dropTarget?.isLocal === isLocal && dropTarget.isFolder ? 'border-blue-500' : 'border-zinc-800'}`}
                onDragOver={onDragOver}
                onDragEnter={(e) => onDragEnter(e, null, isLocal)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, null, isLocal)}
                onContextMenu={(e) => handlePaneContextMenu(e, isLocal)}
            >
                <div className="flex-shrink-0 p-2 border-b border-zinc-700">
                    <h3 className="font-semibold">{title}</h3>
                    <input 
                        type="text" value={path} 
                        onChange={e => handlePathChange(e.target.value, isLocal)} 
                        onKeyDown={e => e.key === 'Enter' && handlePathRefresh(isLocal)}
                        className="w-full bg-zinc-900/50 text-xs p-1 rounded border border-zinc-700 focus:ring-1 focus:ring-blue-500" 
                    />
                </div>
                <div className="flex-grow overflow-y-auto overflow-x-auto custom-scrollbar p-1">
                    <div className="space-y-0.5 min-w-full w-max">
                        {items.map(item => <FileListItem key={item.path} item={item} isLocal={isLocal} />)}
                    </div>
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
            
            <div className="flex-grow grid grid-cols-2 gap-3 p-3">
                <FileListPane isLocal={true} />
                <FileListPane isLocal={false} />
            </div>
            
            <div className="flex-shrink-0 h-10 border-t border-zinc-700 p-2 flex items-center text-xs">
                <p className="font-semibold mr-2">Status:</p> <div className="flex-grow text-zinc-400 p-1 truncate">{statusMessage}</div>
            </div>

            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={closeContextMenu} />}
        </div>
    );
};

export const appDefinition: AppDefinition = { id: 'sftp', name: 'SFTP Client', icon: SftpIcon, component: SFTPApp, defaultSize: { width: 950, height: 650 } };
export default SFTPApp;
