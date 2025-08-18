import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppComponentProps, AppDefinition } from '../../../types';
import { HyperIcon as TerminusIcon } from '../../../constants';

// --- Reusable Terminal Component ---

interface Line {
  type: 'input' | 'output';
  content: string;
}

interface InteractiveTerminalProps {
  lines: Line[];
  input: string;
  isProcessing: boolean;
  prompt: string;
  onInputChange: (value: string) => void;
  onProcessCommand: (command: string) => void;
  isActive: boolean;
}

const InteractiveTerminal: React.FC<InteractiveTerminalProps> = ({
  lines,
  input,
  isProcessing,
  prompt,
  onInputChange,
  onProcessCommand,
  isActive,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && !isProcessing) {
      inputRef.current?.focus();
    }
  }, [isActive, isProcessing]);
  
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [lines]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isProcessing) {
      onProcessCommand(input);
    }
  };
  
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div 
      className="flex flex-col h-full bg-[#121212] text-zinc-200 font-mono text-sm p-2"
      onClick={handleTerminalClick}
    >
      <div ref={terminalBodyRef} className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-1">
        {lines.map((line, index) => (
          <div key={index}>
            {line.type === 'input' && (
              <div className="flex">
                <span className="text-cyan-400">{prompt}</span>
                <span className="ml-2 flex-shrink-0">{line.content}</span>
              </div>
            )}
            {line.type === 'output' && (
              <div className="whitespace-pre-wrap">{line.content}</div>
            )}
          </div>
        ))}
      </div>
      
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isProcessing}
        className="absolute w-0 h-0 p-0 m-0 border-0 opacity-0"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
      />

      <div className="flex mt-2 items-center">
        <span className="text-cyan-400 flex-shrink-0">{prompt}</span>
        <div className="ml-2 flex items-center">
            <span>{input}</span>
            {!isProcessing && <span className="blinking-cursor"></span>}
        </div>
      </div>
    </div>
  );
};

// --- Main Terminus App ---

interface Tab {
  id: string;
  title: string;
  lines: Line[];
  input: string;
  isProcessing: boolean;
  prompt: string;
  user: string;
  host: string;
}

const TerminusApp: React.FC<AppComponentProps> = ({ appInstanceId, setTitle }) => {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    useEffect(() => {
      setTitle(`Terminus`);
    }, [setTitle]);

    const addNewTab = useCallback((title: string, user: string, host: string) => {
        const newTab: Tab = {
            id: `session-${Date.now()}`,
            title,
            user,
            host,
            lines: [{ type: 'output', content: `Connecting to ${host}...\nConnection established.` }],
            input: '',
            isProcessing: false,
            prompt: `${user}@${host}:~$`,
        };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
    }, []);

    useEffect(() => {
      if (tabs.length === 0) {
        addNewTab('New Session', 'user', 'local-host');
      }
    }, [tabs.length, addNewTab]);
    
    const updateTabState = useCallback((tabId: string, updates: Partial<Tab>) => {
        setTabs(prevTabs => prevTabs.map(tab => tab.id === tabId ? { ...tab, ...updates } : tab));
    }, []);

    const closeTab = useCallback((tabId: string) => {
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
    }, [tabs, activeTabId]);

    const processCommand = async (commandStr: string, tabId: string) => {
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) return;
  
      const trimmedCommand = commandStr.trim();
      updateTabState(tabId, { isProcessing: true });
  
      const addLine = (line: Line) => {
          setTabs(prev => prev.map(t => t.id === tabId ? {...t, lines: [...t.lines, line]} : t));
      };
      
      addLine({ type: 'input', content: trimmedCommand });
  
      if (trimmedCommand === '') {
          updateTabState(tabId, { isProcessing: false, input: '' });
          return;
      }
  
      const [command] = trimmedCommand.split(' ');
  
      // Simulate network delay
      await new Promise(res => setTimeout(res, Math.random() * 300 + 50));

      switch (command.toLowerCase()) {
        case 'help':
          addLine({ type: 'output', content: 'Mock SSH Commands:\n\n- help: Show this help message\n- ls: List directory contents\n- pwd: Print working directory\n- whoami: Display current user\n- exit: Close this session' });
          break;
        case 'ls':
          addLine({ type: 'output', content: 'drwxr-xr-x 2 user group 4096 Jan 1 12:00 public_html\n-rw-r--r-- 1 user group  256 Jan 1 11:59 .profile\n-rw-r--r-- 1 user group 1024 Dec 15 09:30 .bashrc' });
          break;
        case 'pwd':
          addLine({ type: 'output', content: `/home/${tab.user}` });
          break;
        case 'whoami':
          addLine({ type: 'output', content: tab.user });
          break;
        case 'exit':
          addLine({ type: 'output', content: 'Connection closed.' });
          setTimeout(() => closeTab(tabId), 200);
          break;
        default:
          addLine({ type: 'output', content: `bash: command not found: ${command}` });
          break;
      }
      
      updateTabState(tabId, { input: '', isProcessing: false });
    };

    const handleInputChange = (tabId: string, value: string) => {
        updateTabState(tabId, { input: value });
    };

    const activeTab = tabs.find(t => t.id === activeTabId);

    return (
        <div className="flex h-full bg-zinc-900 text-white">
            <aside className="w-56 flex-shrink-0 bg-zinc-800/50 p-3 flex flex-col">
                <h2 className="text-lg font-semibold mb-4">Connections</h2>
                <div className="flex-grow space-y-2">
                    <button onClick={() => addNewTab('prod-server-1', 'prod-user', '192.168.1.100')} className="w-full text-left p-2 rounded hover:bg-zinc-700 transition-colors">
                        <div className="font-medium">prod-server-1</div>
                        <div className="text-xs text-zinc-400">prod-user@192.168.1.100</div>
                    </button>
                    <button onClick={() => addNewTab('staging-db', 'admin', 'db.staging.local')} className="w-full text-left p-2 rounded hover:bg-zinc-700 transition-colors">
                        <div className="font-medium">staging-db</div>
                        <div className="text-xs text-zinc-400">admin@db.staging.local</div>
                    </button>
                </div>
                <button className="w-full p-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                    + New Connection
                </button>
            </aside>

            <main className="flex-grow flex flex-col">
                {tabs.length > 0 ? (
                    <>
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
                        
                        <div className="flex-grow bg-[#121212] relative">
                            {activeTab && (
                                <InteractiveTerminal
                                    lines={activeTab.lines}
                                    input={activeTab.input}
                                    isProcessing={activeTab.isProcessing}
                                    prompt={activeTab.prompt}
                                    onInputChange={(value) => handleInputChange(activeTab.id, value)}
                                    onProcessCommand={(command) => processCommand(command, activeTab.id)}
                                    isActive={true}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-zinc-500">
                        No active sessions. Select a connection to start.
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
