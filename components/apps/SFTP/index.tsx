import React, { useEffect } from 'react';
import { AppComponentProps, AppDefinition } from '../../../types';
import { FolderIcon, FileGenericIcon, SftpIcon } from '../../../constants';

// Mock file list component for demonstration
const FileList: React.FC<{ title: string, path: string }> = ({ title, path }) => (
    <div className="flex flex-col h-full bg-black/50 rounded-md">
        <div className="flex-shrink-0 p-2 border-b border-zinc-700">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-zinc-400 truncate">{path}</p>
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar p-1">
            <div className="space-y-1 text-sm">
                <button className="w-full flex items-center p-1.5 hover:bg-zinc-700 rounded">
                    <FolderIcon isSmall className="w-5 h-5 text-amber-400 mr-2"/>
                    <span>public_html</span>
                </button>
                 <button className="w-full flex items-center p-1.5 hover:bg-zinc-700 rounded">
                    <FolderIcon isSmall className="w-5 h-5 text-amber-400 mr-2"/>
                    <span>logs</span>
                </button>
                 <button className="w-full flex items-center p-1.5 hover:bg-zinc-700 rounded">
                    <FileGenericIcon isSmall className="w-5 h-5 text-zinc-400 mr-2"/>
                    <span>.bashrc</span>
                </button>
                 <button className="w-full flex items-center p-1.5 hover:bg-zinc-700 rounded">
                    <FileGenericIcon isSmall className="w-5 h-5 text-zinc-400 mr-2"/>
                    <span>.profile</span>
                </button>
            </div>
        </div>
    </div>
);


const SFTPApp: React.FC<AppComponentProps> = ({ setTitle }) => {
    
    useEffect(() => {
        setTitle(`SFTP Client`);
    }, [setTitle]);

    return (
        <div className="flex h-full bg-zinc-900 text-white">
            {/* Sidebar for Connections */}
            <aside className="w-56 flex-shrink-0 bg-zinc-800/50 p-3 flex flex-col">
                <h2 className="text-lg font-semibold mb-4">SFTP Sites</h2>
                <div className="flex-grow space-y-2">
                    {/* Mock connection */}
                    <button className="w-full text-left p-2 rounded bg-blue-600/30 ring-1 ring-blue-500">
                        <div className="font-medium">prod-server-1</div>
                        <div className="text-xs text-zinc-400">user@192.168.1.100</div>
                    </button>
                    <button className="w-full text-left p-2 rounded hover:bg-zinc-700 transition-colors">
                        <div className="font-medium">backup-storage</div>
                        <div className="text-xs text-zinc-400">archive@sftp.storage.net</div>
                    </button>
                </div>
                <button className="w-full p-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                    + New Site
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-grow flex flex-col p-3 space-y-3">
                <div className="flex-shrink-0 flex items-center space-x-2 text-sm">
                    <span>Host:</span>
                    <input type="text" defaultValue="sftp://user@192.168.1.100" className="flex-grow bg-zinc-800 border border-zinc-700 rounded px-2 py-1"/>
                    <span>Port:</span>
                    <input type="text" defaultValue="22" className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1"/>
                    <button className="px-3 py-1 bg-blue-600 rounded">Connect</button>
                </div>

                <div className="flex-grow grid grid-cols-2 gap-3 overflow-hidden">
                    {/* Left Pane (Local) */}
                    <FileList title="Local site" path="/Users/User/Documents"/>

                    {/* Right Pane (Remote) */}
                    <FileList title="Remote site" path="/home/user"/>
                </div>
                 <div className="flex-shrink-0 h-32 border-t border-zinc-700 pt-2 flex flex-col">
                    <p className="text-sm font-semibold">Transfer Queue</p>
                    <div className="flex-grow overflow-y-auto custom-scrollbar text-xs text-zinc-400 p-1 bg-black/50 rounded-md mt-1">
                        <div>Status: Connected. Waiting for file transfer...</div>
                    </div>
                </div>
            </main>
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
