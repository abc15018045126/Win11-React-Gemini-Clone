import React, { useState, useEffect, useRef } from 'react';
import { AppComponentProps, AppDefinition } from '../../types';
import { HyperIcon as TerminusIcon } from '../../constants';

// Mock terminal component from HyperApp for reuse
const MockTerminal: React.FC = () => {
    // A simplified, non-interactive terminal view for demonstration
    return (
        <div className="flex flex-col h-full bg-[#121212] text-zinc-200 font-mono text-sm p-2 overflow-y-auto custom-scrollbar">
            <div><span className="text-green-400">user@remote-host:~$</span> <span>ls -la</span></div>
            <div>total 8</div>
            <div>drwxr-xr-x 2 user user 4096 Jan 1 12:00 .</div>
            <div>drwxr-xr-x 4 user user 4096 Jan 1 11:59 ..</div>
            <div>-rw-r--r-- 1 user user    0 Jan 1 12:00 example.txt</div>
            <br />
            <div><span className="text-green-400">user@remote-host:~$</span> <span className="animate-ping">_</span></div>
        </div>
    );
};


interface Tab {
    id: string;
    title: string;
}

const TerminusApp: React.FC<AppComponentProps> = ({ appInstanceId, setTitle }) => {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    useEffect(() => {
        setTitle(`Terminus`);
    }, [setTitle]);

    useEffect(() => {
        // Open a default tab on launch
        if (tabs.length === 0) {
            addNewTab('New Session');
        }
    }, [tabs.length]);

    const addNewTab = (title: string) => {
        const newTab = { id: `session-${Date.now()}`, title };
        setTabs([...tabs, newTab]);
        setActiveTabId(newTab.id);
    };

    const closeTab = (tabId: string) => {
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);

        if (activeTabId === tabId) {
            if (newTabs.length > 0) {
                setActiveTabId(newTabs[Math.max(0, tabIndex - 1)].id);
            } else {
                setActiveTabId(null);
            }
        }
    };

    return (
        <div className="flex h-full bg-zinc-900 text-white">
            {/* Sidebar for Connections */}
            <aside className="w-56 flex-shrink-0 bg-zinc-800/50 p-3 flex flex-col">
                <h2 className="text-lg font-semibold mb-4">Connections</h2>
                <div className="flex-grow space-y-2">
                    {/* Mock connection */}
                    <button onClick={() => addNewTab('prod-server-1')} className="w-full text-left p-2 rounded hover:bg-zinc-700 transition-colors">
                        <div className="font-medium">prod-server-1</div>
                        <div className="text-xs text-zinc-400">user@192.168.1.100</div>
                    </button>
                    <button onClick={() => addNewTab('staging-db')} className="w-full text-left p-2 rounded hover:bg-zinc-700 transition-colors">
                        <div className="font-medium">staging-db</div>
                        <div className="text-xs text-zinc-400">admin@db.staging.local</div>
                    </button>
                </div>
                <button className="w-full p-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                    + New Connection
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-grow flex flex-col">
                {tabs.length > 0 ? (
                    <>
                        {/* Tab Bar */}
                        <div className="flex-shrink-0 flex items-end bg-zinc-800/80">
                            {tabs.map(tab => (
                                <div
                                    key={tab.id}
                                    onClick={() => setActiveTabId(tab.id)}
                                    className={`flex items-center px-4 py-2 border-b-2 -mb-px rounded-t-md max-w-[200px] cursor-pointer group ${
                                        tab.id === activeTabId ? 'bg-[#121212] border-blue-500' : 'bg-zinc-900/50 border-transparent hover:bg-zinc-700'
                                    }`}
                                >
                                    <span className="text-xs truncate flex-grow">{tab.title}</span>
                                    <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="ml-2 p-0.5 rounded-full hover:bg-zinc-600 flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                        
                        {/* Tab Content */}
                        <div className="flex-grow bg-[#121212] relative">
                            {tabs.map(tab => (
                                <div key={tab.id} className={`absolute inset-0 ${tab.id === activeTabId ? 'opacity-100 z-10' : 'opacity-0'}`}>
                                    {tab.id === activeTabId && <MockTerminal />}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-zinc-500">
                        No active sessions.
                    </div>
                )}
            </main>
        </div>
    );
};

export const appDefinition: AppDefinition = {
  id: 'terminus',
  name: 'Terminus',
  icon: TerminusIcon,
  component: TerminusApp,
  defaultSize: { width: 800, height: 500 },
};

export default TerminusApp;