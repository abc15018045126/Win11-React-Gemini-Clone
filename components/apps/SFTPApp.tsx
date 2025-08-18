import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppComponentProps, AppDefinition, FilesystemItem as BaseFilesystemItem } from '../../types';
import { FolderIcon, FileGenericIcon, SftpIcon } from '../../constants';
import * as FsService from '../../services/filesystemService';

// Simplified path joiner
const joinPath = (...args: string[]) => args.join('/').replace(/\/+/g, '/');

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
interface FilesystemItem extends BaseFilesystemItem { size?: number; }

const FileListItem: React.FC<{ item: FilesystemItem, onDoubleClick: () => void }> = ({ item, onDoubleClick }) => (
    <button onDoubleClick={onDoubleClick} className="w-full flex items-center p-1 hover:bg-zinc-700/80 rounded text-left text-sm">
        {item.type === 'folder' 
            ? <FolderIcon isSmall className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0"/> 
            : <FileGenericIcon isSmall className="w-5 h-5 text-zinc-400 mr-2 flex-shrink-0"/>
        }
        <span className="flex-grow whitespace-nowrap overflow-hidden text-ellipsis">{item.name}</span>
        {item.size !== undefined && <span className="text-xs text-zinc-500 w-24 text-right flex-shrink-0 pr-2">{item.size}</span>}
    </button>
);

const FileListPane: React.FC<{ 
    title: string;
    path: string;
    items: FilesystemItem[];
    onItemDoubleClick: (item: FilesystemItem) => void;
    onPathChange: (newPath: string) => void;
    refresh: () => void;
}> = (props) => {
    return (
        <div className="flex flex-col h-full bg-black/50 rounded-md border border-zinc-800">
            <div className="flex-shrink-0 p-2 border-b border-zinc-700">
                <h3 className="font-semibold">{props.title}</h3>
                <input 
                    type="text" value={props.path} 
                    onChange={e => props.onPathChange(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && props.refresh()}
                    className="w-full bg-zinc-900/50 text-xs p-1 rounded border border-zinc-700 focus:ring-1 focus:ring-blue-500" 
                />
            </div>
            <div className="flex-grow overflow-y-auto overflow-x-auto custom-scrollbar p-1">
                <div className="space-y-0.5 min-w-full w-max">
                    {props.items.map(item => (
                        <FileListItem 
                            key={item.path} 
                            item={item} 
                            onDoubleClick={() => props.onItemDoubleClick(item)}
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
    
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => { setTitle(`SFTP - ${status}`); }, [setTitle, status]);

    const sortItems = (items: FilesystemItem[]) => items.sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1));

    const refreshLocal = useCallback(async (path: string) => {
        const items = await FsService.listDirectory(path);
        setLocalItems(sortItems(items));
    }, []);

    useEffect(() => {
        fetch('http://localhost:3001/api/os-user')
            .then(res => res.ok ? res.json() : Promise.resolve({ username: 'user' }))
            .then(data => setUsername(data.username || 'user'));
        refreshLocal('/');
    }, [refreshLocal]);
    
    useEffect(() => {
        return () => { ws.current?.close(); };
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
                    setRemoteItems(sortItems(msg.payload.items));
                    break;
                case 'error':
                    setErrorMsg(msg.payload); setStatus('error'); setStatusMessage(`Error: ${msg.payload}`);
                    ws.current?.close();
                    break;
            }
        };
    }, [host, port, username, password, status, remotePath, refreshRemote]);

    const handleDisconnect = useCallback(() => { ws.current?.close(); }, []);

    const handleItemDoubleClick = useCallback((item: FilesystemItem, isLocal: boolean) => {
        if (item.type === 'folder') {
            const currentBasePath = isLocal ? localPath : remotePath;
            const newPath = joinPath(currentBasePath, item.name);
            if (isLocal) { setLocalPath(newPath); refreshLocal(newPath); }
            else { setRemotePath(newPath); refreshRemote(newPath); }
        }
    }, [localPath, remotePath, refreshLocal, refreshRemote]);

    return (
        <div className="flex flex-col h-full bg-zinc-900 text-white">
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
                <FileListPane title="Local Site" path={localPath} items={localItems} onPathChange={setLocalPath} refresh={() => refreshLocal(localPath)} onItemDoubleClick={(item) => handleItemDoubleClick(item, true)} />
                <FileListPane title="Remote Site" path={remotePath} items={remoteItems} onPathChange={setRemotePath} refresh={() => refreshRemote(remotePath)} onItemDoubleClick={(item) => handleItemDoubleClick(item, false)} />
            </div>
            <div className="flex-shrink-0 h-10 border-t border-zinc-700 p-2 flex items-center text-xs">
                <p className="font-semibold mr-2">Status:</p> <div className="flex-grow text-zinc-400 p-1 truncate">{statusMessage}</div>
            </div>
        </div>
    );
};

export const appDefinition: AppDefinition = { id: 'sftp', name: 'SFTP Client', icon: SftpIcon, component: SFTPApp, defaultSize: { width: 950, height: 650 } };
export default SFTPApp;