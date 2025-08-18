import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { AppComponentProps, AppDefinition, FilesystemItem as BaseFilesystemItem } from '../../types';
import { FolderIcon, FileGenericIcon, SftpIcon } from '../../constants';
import * as FsService from '../../services/filesystemService';

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

const FileListItem: React.FC<{ item: FilesystemItem, onToggleExpand: () => void, onDoubleClick: () => void, isExpanded: boolean }> = 
({ item, onToggleExpand, onDoubleClick, isExpanded }) => (
    <button onDoubleClick={onDoubleClick} className="w-full flex items-center p-1 hover:bg-zinc-700 rounded text-left text-sm">
        <TreeArrow depth={item.depth} isExpanded={isExpanded} isFolder={item.type === 'folder'} onClick={(e) => {
            e.stopPropagation();
            if (item.type === 'folder') onToggleExpand();
        }} />
        {item.type === 'folder' 
            ? <FolderIcon isSmall className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0"/> 
            : <FileGenericIcon isSmall className="w-5 h-5 text-zinc-400 mr-2 flex-shrink-0"/>
        }
        <span className="truncate flex-grow">{item.name}</span>
        {item.size !== undefined && <span className="text-xs text-zinc-500 w-24 text-right flex-shrink-0 pr-2">{item.size}</span>}
    </button>
);


const FileListPane: React.FC<{ 
    title: string, 
    items: FilesystemItem[],
    onNavigate: (path: string) => void,
    onItemDoubleClick: (item: FilesystemItem) => void,
    onToggleExpand: (item: FilesystemItem) => void,
    expandedPaths: Set<string>,
}> = ({ title, items, onNavigate, onItemDoubleClick, onToggleExpand, expandedPaths }) => {
    
    return (
        <div className="flex flex-col h-full bg-black/50 rounded-md border border-zinc-800">
            <div className="flex-shrink-0 p-2 border-b border-zinc-700">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-xs text-zinc-400 truncate flex-grow">{items[0]?.path ? path.dirname(items[0].path) : '/'}</p>
            </div>
            <div className="flex-grow overflow-auto custom-scrollbar p-1">
                <div className="space-y-0.5">
                    {items.map(item => (
                        <FileListItem 
                            key={item.path} 
                            item={item} 
                            onDoubleClick={() => onItemDoubleClick(item)}
                            onToggleExpand={() => onToggleExpand(item)}
                            isExpanded={expandedPaths.has(item.path)}
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

    const ws = useRef<WebSocket | null>(null);

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
        return () => {
            ws.current?.close();
        };
    }, []);

    const fetchLocalFiles = useCallback(async (path: string, isRoot = false) => {
        const newItems = await FsService.listDirectory(path);
        const enhancedItems = newItems.map(item => ({...item, depth: path.split('/').length - 1}));

        if (isRoot) {
            setLocalItems(enhancedItems);
        } else {
            setLocalItems(prev => {
                const parentIndex = prev.findIndex(it => it.path === path);
                const newArr = [...prev];
                newArr.splice(parentIndex + 1, 0, ...enhancedItems);
                return newArr;
            });
        }
    }, []);
    
    const fetchRemoteFiles = useCallback((path: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            setStatusMessage(`Listing directory ${path}...`);
            ws.current.send(JSON.stringify({ type: 'list', payload: path }));
        }
    }, []);
    
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
                        fetchRemoteFiles(remotePath);
                    } else {
                        setStatus('disconnected');
                        setStatusMessage('Disconnected.');
                    }
                    break;
                case 'list':
                    setStatusMessage(`Directory listing successful for ${msg.payload.path}`);
                     const newChildren = msg.payload.items
                        .sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1))
                        .map(child => ({...child, depth: (msg.payload.path.match(/\//g) || []).length + (msg.payload.path === '.' ? 0 : 1)}));

                    if (msg.payload.path === '.') {
                        setRemoteItems(newChildren.map(c => ({...c, depth: 0})));
                    } else {
                        setRemoteItems(prev => {
                            const parentIndex = prev.findIndex(it => it.path === msg.payload.path);
                            const newArr = [...prev];
                            newArr.splice(parentIndex + 1, 0, ...newChildren);
                            return newArr;
                        });
                    }
                    break;
                case 'download_complete':
                    setStatusMessage(`Downloaded ${path.basename(msg.payload.remotePath)}. Opening...`);
                    openApp?.('notebook', { file: { path: msg.payload.localPath } });
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
    }, [host, port, username, password, remotePath, status, fetchRemoteFiles, openApp]);

    const handleDisconnect = () => {
        ws.current?.send(JSON.stringify({ type: 'disconnect' }));
        ws.current?.close();
    };

    const handleToggleExpand = (item: FilesystemItem, isLocal: boolean) => {
        const [expanded, setExpanded, fetchFiles, setItems] = isLocal 
            ? [expandedLocal, setExpandedLocal, fetchLocalFiles, setLocalItems]
            : [expandedRemote, setExpandedRemote, fetchRemoteFiles, setRemoteItems];

        if (expanded.has(item.path)) {
            setExpanded(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.path);
                return newSet;
            });
            setItems(prevItems => {
                const parentIndex = prevItems.findIndex(it => it.path === item.path);
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
            fetchFiles(item.path);
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

    return (
        <div className="flex flex-col h-full bg-zinc-900 text-white">
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

            <div className="flex-grow grid grid-cols-2 gap-3 overflow-hidden p-3">
                <FileListPane 
                    title="Local Site" 
                    items={localItems}
                    onNavigate={(p) => { /* Not used for tree view */ }}
                    onItemDoubleClick={(item) => handleItemDoubleClick(item, true)}
                    onToggleExpand={(item) => handleToggleExpand(item, true)}
                    expandedPaths={expandedLocal}
                />
                 <FileListPane 
                    title="Remote Site" 
                    items={remoteItems}
                    onNavigate={(p) => { /* Not used for tree view */ }}
                    onItemDoubleClick={(item) => handleItemDoubleClick(item, false)}
                    onToggleExpand={(item) => handleToggleExpand(item, false)}
                    expandedPaths={expandedRemote}
                />
            </div>
            
            <div className="flex-shrink-0 h-10 border-t border-zinc-700 p-2 flex items-center text-xs">
                <p className="font-semibold mr-2">Status:</p>
                <div className="flex-grow text-zinc-400 p-1 truncate">{statusMessage}</div>
            </div>
        </div>
    );
};

// Dummy path utils for frontend
const path = {
    basename: (p: string) => p.split('/').pop() || '',
    dirname: (p: string) => p.substring(0, p.lastIndexOf('/')) || '/',
};

export const appDefinition: AppDefinition = {
  id: 'sftp',
  name: 'SFTP Client',
  icon: SftpIcon,
  component: SFTPApp,
  defaultSize: { width: 900, height: 600 },
};

export default SFTPApp;
