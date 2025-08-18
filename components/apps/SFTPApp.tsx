import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppComponentProps, AppDefinition, FilesystemItem } from '../../types';
import { FolderIcon, FileGenericIcon, SftpIcon } from '../../constants';
import * as FsService from '../../services/filesystemService';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface RemoteFilesystemItem extends FilesystemItem {
    size: number;
    modified: number;
}

const FileListItem: React.FC<{ item: FilesystemItem, onDoubleClick: (item: FilesystemItem) => void }> = ({ item, onDoubleClick }) => (
    <button onDoubleClick={() => onDoubleClick(item)} className="w-full flex items-center p-1.5 hover:bg-zinc-700 rounded text-left">
        {item.type === 'folder' 
            ? <FolderIcon isSmall className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0"/> 
            : <FileGenericIcon isSmall className="w-5 h-5 text-zinc-400 mr-2 flex-shrink-0"/>
        }
        <span className="truncate flex-grow">{item.name}</span>
    </button>
);

const FileListPane: React.FC<{ title: string, path: string, items: FilesystemItem[], onNavigate: (path: string) => void, onDoubleClick: (item: FilesystemItem) => void }> = ({ title, path, items, onNavigate, onDoubleClick }) => {
    const goUp = () => {
        if (path !== '/') {
            const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
            onNavigate(parentPath);
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-black/50 rounded-md">
            <div className="flex-shrink-0 p-2 border-b border-zinc-700">
                <h3 className="font-semibold">{title}</h3>
                <div className="flex items-center">
                    <button onClick={goUp} disabled={path === '/'} className="mr-2 p-1 rounded hover:bg-zinc-700 disabled:opacity-50">&#x2191;</button>
                    <p className="text-xs text-zinc-400 truncate flex-grow">{path}</p>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-1">
                <div className="space-y-1 text-sm">
                    {items.map(item => (
                        <FileListItem key={item.path} item={item} onDoubleClick={onDoubleClick} />
                    ))}
                </div>
            </div>
        </div>
    );
}

const SFTPApp: React.FC<AppComponentProps> = ({ setTitle }) => {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [host, setHost] = useState('127.0.0.1');
    const [port, setPort] = useState('22');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    
    const [localPath, setLocalPath] = useState('/');
    const [remotePath, setRemotePath] = useState('.');
    const [localItems, setLocalItems] = useState<FilesystemItem[]>([]);
    const [remoteItems, setRemoteItems] = useState<RemoteFilesystemItem[]>([]);

    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        setTitle(`SFTP - ${status}`);
    }, [setTitle, status]);

    // Fetch local user and initial files
    useEffect(() => {
        fetch('http://localhost:3001/api/os-user')
            .then(res => res.ok ? res.json() : Promise.resolve({ username: 'user' }))
            .then(data => setUsername(data.username || 'user'));
        
        fetchLocalFiles(localPath);
    }, []);

    // Cleanup WebSocket on unmount
    useEffect(() => {
        return () => {
            ws.current?.close();
        };
    }, []);

    const fetchLocalFiles = useCallback(async (path: string) => {
        const items = await FsService.listDirectory(path);
        setLocalItems(items);
        setLocalPath(path);
    }, []);
    
    const fetchRemoteFiles = useCallback((path: string) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
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
                        fetchRemoteFiles(remotePath);
                    } else {
                        setStatus('disconnected');
                    }
                    break;
                case 'list':
                    setRemoteItems(msg.payload.items.sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1)));
                    setRemotePath(msg.payload.path);
                    break;
                case 'error':
                    setErrorMsg(msg.payload);
                    setStatus('error');
                    ws.current?.close();
                    break;
            }
        };

        ws.current.onerror = () => {
            setErrorMsg('WebSocket connection failed. Ensure the backend server is running.');
            setStatus('error');
        };

        ws.current.onclose = () => {
            if (status !== 'error') {
                setStatus('disconnected');
                setRemoteItems([]);
            }
        };
    }, [host, port, username, password, remotePath, status, fetchRemoteFiles]);

    const handleDisconnect = () => {
        ws.current?.send(JSON.stringify({ type: 'disconnect' }));
        ws.current?.close();
    };

    const handleLocalDoubleClick = (item: FilesystemItem) => {
        if (item.type === 'folder') {
            fetchLocalFiles(item.path);
        }
    };
    
    const handleRemoteDoubleClick = (item: RemoteFilesystemItem) => {
        if (item.type === 'folder') {
            fetchRemoteFiles(item.path);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 text-white">
            {/* Connection Bar */}
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

            {/* File Panes */}
            <div className="flex-grow grid grid-cols-2 gap-3 overflow-hidden p-3">
                <FileListPane 
                    title="Local Site" 
                    path={localPath} 
                    items={localItems}
                    onNavigate={fetchLocalFiles}
                    onDoubleClick={handleLocalDoubleClick}
                />
                <FileListPane 
                    title="Remote Site" 
                    path={remotePath} 
                    items={remoteItems}
                    onNavigate={fetchRemoteFiles}
                    onDoubleClick={handleRemoteDoubleClick}
                />
            </div>
            
            {/* Status / Queue Bar */}
            <div className="flex-shrink-0 h-24 border-t border-zinc-700 p-2 flex flex-col">
                <p className="text-sm font-semibold">Status</p>
                <div className="flex-grow overflow-y-auto custom-scrollbar text-xs text-zinc-400 p-1 bg-black/50 rounded-md mt-1">
                    <div>{status.charAt(0).toUpperCase() + status.slice(1)}</div>
                </div>
            </div>
        </div>
    );
};

export const appDefinition: AppDefinition = {
  id: 'sftp',
  name: 'SFTP Client',
  icon: SftpIcon,
  component: SFTPApp,
  defaultSize: { width: 900, height: 600 },
};

export default SFTPApp;