import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppComponentProps, AppDefinition, FilesystemItem as BaseFilesystemItem } from '../../types';
import { FolderIcon, FileGenericIcon, SftpIcon } from '../../constants';
import * as FsService from '../../services/filesystemService';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';

const path = { posix: { join: (...args: string[]) => args.join('/').replace(/\/+/g, '/'), dirname: (p: string) => p.substring(0, p.lastIndexOf('/')) || '/' }};

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
interface FilesystemItem extends BaseFilesystemItem { size?: number; modified?: number; }
interface DraggedItem { item: FilesystemItem; isLocal: boolean; }

const FileListItem: React.FC<{ 
    item: FilesystemItem, 
    onDoubleClick: () => void, 
    onContextMenu: (e: React.MouseEvent) => void,
    isRenaming: boolean,
    renameValue: string,
    onRenameChange: (val: string) => void,
    onRenameSubmit: () => void,
    onDragStart: (e: React.DragEvent, item: FilesystemItem) => void,
    onDragOver: (e: React.DragEvent) => void,
    onDrop: (e: React.DragEvent, item: FilesystemItem) => void,
    isDropTarget: boolean,
}> = ({ item, onDoubleClick, onContextMenu, isRenaming, renameValue, onRenameChange, onRenameSubmit, onDragStart, onDragOver, onDrop, isDropTarget }) => (
    <div 
        draggable
        onDragStart={(e) => onDragStart(e, item)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, item)}
        onDoubleClick={onDoubleClick} 
        onContextMenu={onContextMenu} 
        className={`w-full flex items-center p-1 hover:bg-zinc-700/80 rounded text-left text-sm transition-colors duration-100
                    ${isDropTarget ? 'bg-blue-600/50 ring-1 ring-blue-400' : ''}`}
    >
        {item.type === 'folder' 
            ? <FolderIcon isSmall className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0"/> 
            : <FileGenericIcon isSmall className="w-5 h-5 text-zinc-400 mr-2 flex-shrink-0"/>
        }
        <div className="flex-grow whitespace-nowrap overflow-hidden text-ellipsis">
            {isRenaming ? (
                 <input 
                    type="text"
                    value={renameValue}
                    onChange={e => onRenameChange(e.target.value)}
                    onBlur={onRenameSubmit}
                    onKeyDown={e => { if (e.key === 'Enter') onRenameSubmit(); if(e.key === 'Escape') onRenameSubmit(); }}
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
    </div>
);


const FileListPane: React.FC<{ 
    title: string;
    path: string;
    items: FilesystemItem[];
    onItemDoubleClick: (item: FilesystemItem) => void;
    onItemContextMenu: (e: React.MouseEvent, item: FilesystemItem) => void;
    onBackgroundContextMenu: (e: React.MouseEvent) => void;
    onPathChange: (newPath: string) => void;
    refresh: () => void;
    renamingPath: string | null;
    renameValue: string;
    onRenameChange: (val: string) => void;
    onRenameSubmit: () => void;
    onDragStart: (e: React.DragEvent, item: FilesystemItem) => void;
    onDrop: (e: React.DragEvent, targetItem?: FilesystemItem) => void;
}> = (props) => {
    const [isDropTarget, setIsDropTarget] = useState(false);
    const [dropTargetItem, setDropTargetItem] = useState<string | null>(null);
    const dropTimeout = useRef<number | null>(null);

    const handleDragOver = (e: React.DragEvent, item?: FilesystemItem) => {
        e.preventDefault();
        e.stopPropagation();
        if(dropTimeout.current) clearTimeout(dropTimeout.current);

        const targetPath = item && item.type === 'folder' ? item.path : null;
        if (targetPath !== dropTargetItem) setDropTargetItem(targetPath);
        if(!item) setIsDropTarget(true); // Hovering over pane background
    };

    const handleDragLeave = () => {
        dropTimeout.current = window.setTimeout(() => {
            setIsDropTarget(false);
            setDropTargetItem(null);
        }, 100);
    };

    const handleDrop = (e: React.DragEvent, item?: FilesystemItem) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDropTarget(false);
        setDropTargetItem(null);
        props.onDrop(e, item);
    };
    
    return (
        <div className="flex flex-col h-full bg-black/50 rounded-md border border-zinc-800" onContextMenu={props.onBackgroundContextMenu}>
            <div className="flex-shrink-0 p-2 border-b border-zinc-700">
                <h3 className="font-semibold">{props.title}</h3>
                <input 
                    type="text" value={props.path} 
                    onChange={e => props.onPathChange(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && props.refresh()}
                    className="w-full bg-zinc-900/50 text-xs p-1 rounded border border-zinc-700 focus:ring-1 focus:ring-blue-500" 
                />
            </div>
            <div 
                className={`flex-grow overflow-y-auto overflow-x-auto custom-scrollbar p-1 relative transition-colors duration-200 ${isDropTarget ? 'bg-blue-600/30' : ''}`}
                onDragOver={(e) => handleDragOver(e)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e)}
            >
                <div className="space-y-0.5 min-w-full w-max">
                    {props.items.map(item => (
                        <FileListItem 
                            key={item.path} 
                            item={item} 
                            onDoubleClick={() => props.onItemDoubleClick(item)}
                            onContextMenu={(e) => props.onItemContextMenu(e, item)}
                            isRenaming={props.renamingPath === item.path}
                            renameValue={props.renameValue}
                            onRenameChange={props.onRenameChange}
                            onRenameSubmit={props.onRenameSubmit}
                            onDragStart={props.onDragStart}
                            onDragOver={(e) => handleDragOver(e, item)}
                            onDrop={(e) => handleDrop(e, item)}
                            isDropTarget={dropTargetItem === item.path}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};


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
    const [renamingItem, setRenamingItem] = useState<{ path: string, isLocal: boolean } | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const ws = useRef<WebSocket | null>(null);

    useEffect(() => { setTitle(`SFTP - ${status}`); }, [setTitle, status]);

    const refreshLocal = useCallback(async (path: string) => {
        const items = await FsService.listDirectory(path);
        setLocalItems(items.sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1)));
    }, []);

    useEffect(() => {
        fetch('http://localhost:3001/api/os-user')
            .then(res => res.ok ? res.json() : Promise.resolve({ username: 'user' }))
            .then(data => setUsername(data.username || 'user'));
        refreshLocal('/');
    }, [refreshLocal]);

    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        document.addEventListener('click', closeMenu);
        return () => { ws.current?.close(); document.removeEventListener('click', closeMenu); };
    }, []);
    
    const refreshRemote = useCallback((path: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            setStatusMessage(`Listing directory ${path}...`);
            ws.current.send(JSON.stringify({ type: 'list', payload: { path } }));
        }
    }, []);

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
                        refreshRemote(remotePath);
                    } else {
                        setStatus('disconnected'); setStatusMessage('Disconnected.');
                    }
                    break;
                case 'list':
                    setStatusMessage(`Listed ${msg.payload.path}`);
                    setRemoteItems(msg.payload.items.sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1)));
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
    }, [host, port, username, password, status, remotePath, refreshRemote, refreshLocal]);

    const handleDisconnect = () => { ws.current?.close(); };

    const handleItemDoubleClick = (item: FilesystemItem, isLocal: boolean) => {
        if (item.type === 'folder') {
            const newPath = isLocal ? path.posix.join(localPath, item.name) : path.posix.join(remotePath, item.name);
            if (isLocal) { setLocalPath(newPath); refreshLocal(newPath); }
            else { setRemotePath(newPath); refreshRemote(newPath); }
        }
    };

    const handleUpload = async (item: FilesystemItem, remoteDir: string) => {
        if (item.type === 'folder') { setStatusMessage('Folder uploads not supported yet.'); return; }
        setStatusMessage(`Reading ${item.name} for upload...`);
        const file = await FsService.readFileAsBase64(item.path);
        if (file && file.content) {
            ws.current?.send(JSON.stringify({ type: 'upload', payload: { remoteDir, fileName: item.name, fileData: file.content }}));
            setStatusMessage(`Uploading ${item.name} to ${remoteDir}...`);
        } else {
            setStatusMessage(`Error: Could not read local file ${item.name}.`);
        }
    };

    const handleDownload = (item: FilesystemItem, localDir: string) => {
        if(item.type === 'folder') { setStatusMessage('Folder downloads not supported yet.'); return; }
        setStatusMessage(`Downloading ${item.name}...`);
        ws.current?.send(JSON.stringify({ type: 'download', payload: { remotePath: item.path, localDir, fileName: item.name } }));
    };

    const handleMove = (source: DraggedItem, destPath: string) => {
        if (source.isLocal) { // Local move
            FsService.moveItem(source.item, destPath).then(() => refreshLocal(localPath));
        } else { // Remote move
            ws.current?.send(JSON.stringify({ type: 'move', payload: { sourcePath: source.item.path, destPath: path.posix.join(destPath, source.item.name) } }));
        }
    };

    const handleNewItem = async (isLocal: boolean, isFolder: boolean) => {
        const type = isFolder ? 'folder' : 'file';
        const name = window.prompt(`Enter name for new ${type}:`);
        if (!name) return;
        const parentDir = isLocal ? localPath : remotePath;
        if (isLocal) {
            isFolder ? await FsService.createFolder(parentDir, name) : await FsService.createFile(parentDir, name, "");
            refreshLocal(parentDir);
        } else {
            ws.current?.send(JSON.stringify({ type: isFolder ? 'create_folder' : 'create_file', payload: { parentDir, name } }));
        }
    };
    
    const handleDeleteItem = async (item: FilesystemItem, isLocal: boolean) => {
        if (!window.confirm(`Delete ${item.name}?`)) return;
        const parentDir = isLocal ? path.posix.dirname(item.path) : path.posix.dirname(item.path);
        if (isLocal) {
            await FsService.deleteItem(item); refreshLocal(parentDir);
        } else {
            ws.current?.send(JSON.stringify({ type: 'delete', payload: { item } }));
        }
    };

    const handleRenameSubmit = async () => {
        if (!renamingItem) return;
        const { path: itemPath, isLocal } = renamingItem;
        const items = isLocal ? localItems : remoteItems;
        const item = items.find(i => i.path === itemPath);
        const parentDir = isLocal ? path.posix.dirname(itemPath) : path.posix.dirname(itemPath);

        if (item && renameValue && item.name !== renameValue) {
            if (isLocal) {
                await FsService.renameItem(item, renameValue); refreshLocal(parentDir);
            } else {
                ws.current?.send(JSON.stringify({ type: 'rename', payload: { item, newName: renameValue } }));
            }
        }
        setRenamingItem(null);
    };

    const handleDragStart = (e: React.DragEvent, item: FilesystemItem, isLocal: boolean) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ item, isLocal }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent, isLocalDest: boolean, destItem?: FilesystemItem) => {
        const source: DraggedItem = JSON.parse(e.dataTransfer.getData('application/json'));
        if (!source || !source.item) return;

        const destDir = destItem?.type === 'folder' 
            ? destItem.path 
            : (isLocalDest ? localPath : remotePath);

        if (source.isLocal && !isLocalDest) handleUpload(source.item, destDir);
        else if (!source.isLocal && isLocalDest) handleDownload(source.item, destDir);
        else if (source.isLocal === isLocalDest) handleMove(source, destDir);
    };

    const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
        if (!contextMenu) return [];
        const { item, isLocal } = contextMenu;
        let items: ContextMenuItem[] = [];
        const dir = isLocal ? localPath : remotePath;

        if (item) {
            if(isLocal) items.push({ type: 'item', label: 'Upload', onClick: () => handleUpload(item, remotePath), disabled: status !== 'connected' });
            else items.push({ type: 'item', label: 'Download', onClick: () => handleDownload(item, localPath), disabled: status !== 'connected' });
            items.push({ type: 'separator' });
            items.push({ type: 'item', label: 'Delete', onClick: () => handleDeleteItem(item, isLocal) });
            items.push({ type: 'item', label: 'Rename', onClick: () => { setRenamingItem({ path: item.path, isLocal }); setRenameValue(item.name); }});
        }
        
        if (items.length > 0) items.push({ type: 'separator' });
        
        items.push({ type: 'item', label: 'New File', onClick: () => handleNewItem(isLocal, false) });
        items.push({ type: 'item', label: 'New Folder', onClick: () => handleNewItem(isLocal, true) });
        items.push({ type: 'separator' });
        items.push({ type: 'item', label: 'Refresh', onClick: () => isLocal ? refreshLocal(dir) : refreshRemote(dir) });

        return items;
    }, [contextMenu, status, localPath, remotePath, handleUpload, handleDownload, handleDeleteItem, handleNewItem, refreshLocal, refreshRemote]);

    return (
        <div className="flex flex-col h-full bg-zinc-900 text-white" onClick={() => setContextMenu(null)}>
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
            <div className="flex-grow grid grid-cols-2 gap-3 p-3 overflow-hidden">
                <FileListPane title="Local Site" path={localPath} items={localItems} onPathChange={setLocalPath} refresh={() => refreshLocal(localPath)} onItemDoubleClick={(item) => handleItemDoubleClick(item, true)} onItemContextMenu={(e, item) => setContextMenu({ x: e.clientX, y: e.clientY, item, isLocal: true })} onBackgroundContextMenu={(e) => setContextMenu({ x: e.clientX, y: e.clientY, isLocal: true })} renamingPath={renamingItem?.isLocal ? renamingItem.path : null} renameValue={renameValue} onRenameChange={setRenameValue} onRenameSubmit={handleRenameSubmit} onDragStart={(e, item) => handleDragStart(e, item, true)} onDrop={(e, item) => handleDrop(e, true, item)} />
                <FileListPane title="Remote Site" path={remotePath} items={remoteItems} onPathChange={setRemotePath} refresh={() => refreshRemote(remotePath)} onItemDoubleClick={(item) => handleItemDoubleClick(item, false)} onItemContextMenu={(e, item) => setContextMenu({ x: e.clientX, y: e.clientY, item, isLocal: false })} onBackgroundContextMenu={(e) => setContextMenu({ x: e.clientX, y: e.clientY, isLocal: false })} renamingPath={!renamingItem?.isLocal ? renamingItem.path : null} renameValue={renameValue} onRenameChange={setRenameValue} onRenameSubmit={handleRenameSubmit} onDragStart={(e, item) => handleDragStart(e, item, false)} onDrop={(e, item) => handleDrop(e, false, item)} />
            </div>
            <div className="flex-shrink-0 h-10 border-t border-zinc-700 p-2 flex items-center text-xs">
                <p className="font-semibold mr-2">Status:</p> <div className="flex-grow text-zinc-400 p-1 truncate">{statusMessage}</div>
            </div>
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />}
        </div>
    );
};

export const appDefinition: AppDefinition = { id: 'sftp', name: 'SFTP Client', icon: SftpIcon, component: SFTPApp, defaultSize: { width: 950, height: 650 } };
export default SFTPApp;