
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppDefinition, AppComponentProps } from '../../types';
import { BrowserIcon } from '../../constants';

// --- SVG Icons for Browser Controls ---
const BackIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
);
const ForwardIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
);
const RefreshIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 4a12.94 12.94 0 0115.12 2.88M20 20a12.94 12.94 0 01-15.12-2.88" /></svg>
);
const HomeIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
);
const Spinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);
const CloseIcon: React.FC<{className?: string}> = ({className = "h-4 w-4"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);
const PlusIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
);


interface Tab {
    id: string;
    url: string;
    history: string[];
    historyIndex: number;
    title: string;
    isLoading: boolean;
    favicon: string | null;
}

const NEW_TAB_PAGE = 'about:newtab';
const isUrl = (str: string) => /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(str) || str.startsWith('about:');

const createNewTab = (url: string = NEW_TAB_PAGE): Tab => {
    const id = `tab-${Date.now()}-${Math.random()}`;
    return {
        id,
        url,
        history: [url],
        historyIndex: 0,
        title: 'New Tab',
        isLoading: false,
        favicon: null,
    };
};

const ChromeApp: React.FC<AppComponentProps> = ({ setTitle: setWindowTitle }) => {
    const [tabs, setTabs] = useState<Tab[]>([createNewTab()]);
    const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
    const [inputValue, setInputValue] = useState('');
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const addressBarRef = useRef<HTMLInputElement>(null);

    const activeTab = tabs.find(t => t.id === activeTabId);

    useEffect(() => {
        setWindowTitle(activeTab ? `${activeTab.title} - Chrome` : 'Chrome');
    }, [activeTab, setWindowTitle]);

    useEffect(() => {
        if (activeTab) {
            setInputValue(activeTab.url === NEW_TAB_PAGE ? '' : activeTab.url);
        }
    }, [activeTab]);
    
    const updateTabState = useCallback((tabId: string, updates: Partial<Tab>) => {
        setTabs(prevTabs => prevTabs.map(tab => tab.id === tabId ? { ...tab, ...updates } : tab));
    }, []);

    const reload = useCallback(() => {
        if (!activeTab) return;
        if (iframeRef.current) {
            updateTabState(activeTab.id, { isLoading: true });
            iframeRef.current.src = 'about:blank'; // Force reload
            setTimeout(() => {
                if(iframeRef.current && activeTab) iframeRef.current.src = activeTab.url;
            }, 50);
        }
    }, [activeTab, updateTabState]);

    const navigate = useCallback((urlOrQuery: string, tabId: string) => {
        let input = urlOrQuery.trim();
        if (input === '') return;
        const tabToUpdate = tabs.find(t => t.id === tabId);
        if (!tabToUpdate) return;
        
        let newUrl: string;
        // Use DuckDuckGo for search to avoid X-Frame-Options issues with Google/Bing
        if (isUrl(input)) {
            newUrl = !/^(https?|about):/i.test(input) ? `https://${input}` : input;
        } else {
            newUrl = `https://duckduckgo.com/?q=${encodeURIComponent(input)}`;
        }
        
        if (tabToUpdate.history[tabToUpdate.historyIndex] === newUrl) {
            reload(); // Just reload if URL is the same
            return;
        }

        const newHistory = tabToUpdate.history.slice(0, tabToUpdate.historyIndex + 1);
        newHistory.push(newUrl);
        
        updateTabState(tabId, {
            url: newUrl,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            isLoading: !newUrl.startsWith('about:'),
            title: newUrl.startsWith('about:') ? 'New Tab' : 'Loading...',
        });

    }, [tabs, updateTabState, reload]);

    const goBack = useCallback(() => {
        if (activeTab && activeTab.historyIndex > 0) {
            const newHistoryIndex = activeTab.historyIndex - 1;
            const newUrl = activeTab.history[newHistoryIndex];
            updateTabState(activeTab.id, {
                historyIndex: newHistoryIndex,
                url: newUrl,
                isLoading: !newUrl.startsWith('about:'),
            });
        }
    }, [activeTab, updateTabState]);

    const goForward = useCallback(() => {
        if (activeTab && activeTab.historyIndex < activeTab.history.length - 1) {
            const newHistoryIndex = activeTab.historyIndex + 1;
            const newUrl = activeTab.history[newHistoryIndex];
            updateTabState(activeTab.id, {
                historyIndex: newHistoryIndex,
                url: newUrl,
                isLoading: !newUrl.startsWith('about:'),
            });
        }
    }, [activeTab, updateTabState]);
    
    const addNewTab = useCallback(() => {
        const newTab = createNewTab();
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        addressBarRef.current?.focus();
    }, []);

    const closeTab = useCallback((e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        const tabIndex = tabs.findIndex(t => t.id === tabId);
        let newTabs = tabs.filter(t => t.id !== tabId);

        if (newTabs.length === 0) {
            newTabs = [createNewTab()];
            setActiveTabId(newTabs[0].id);
        } else if (activeTabId === tabId) {
            setActiveTabId(newTabs[Math.max(0, tabIndex - 1)].id);
        }
        setTabs(newTabs);

    }, [tabs, activeTabId]);
    
    const handleAddressBarSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && activeTab) {
            navigate(inputValue, activeTab.id);
        }
    };
    
    const handleIframeLoad = useCallback(() => {
        if (activeTab) {
            let title = "Page";
            let favicon: string | null = null;
            try {
                if (iframeRef.current?.contentWindow) {
                    title = iframeRef.current.contentWindow.document.title || new URL(activeTab.url).hostname;
                    const link = iframeRef.current.contentWindow.document.querySelector<HTMLLinkElement>("link[rel~='icon']");
                    favicon = link ? new URL(link.href, activeTab.url).href : null;
                }
            } catch (e) {
                try {
                    title = new URL(activeTab.url).hostname.replace(/^www\./, '');
                } catch { title = 'Blocked Content'; }
            }
            updateTabState(activeTab.id, { isLoading: false, title, favicon });
        }
    }, [activeTab, updateTabState]);

    const renderContent = () => {
        if (!activeTab) return null;
        if (activeTab.url === NEW_TAB_PAGE) {
            return (
                 <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-800">
                    <div className="text-6xl font-sans font-bold mb-6 select-none">
                        <span className="text-blue-500">G</span>
                        <span className="text-red-500">o</span>
                        <span className="text-yellow-500">o</span>
                        <span className="text-blue-500">g</span>
                        <span className="text-green-500">l</span>
                        <span className="text-red-500">e</span>
                    </div>
                     <div className="w-full max-w-lg">
                        <input
                            type="text"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                                    navigate((e.target as HTMLInputElement).value, activeTab.id);
                                }
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-full py-2.5 px-5 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-zinc-500 text-white"
                            placeholder="Search Google or type a URL"
                            autoFocus
                        />
                     </div>
                </div>
            )
        }
        
        // Default to iframe for http/https URLs
        return (
             <iframe
                ref={iframeRef}
                src={activeTab.url}
                className={`w-full h-full border-none bg-white`}
                onLoad={handleIframeLoad}
                sandbox="allow-forms allow-scripts allow-same-origin allow-presentation"
                title="Browser Content"
            ></iframe>
        )
    }

    return (
        <div className="flex flex-col h-full bg-zinc-800 text-white select-none">
            <div className="flex-shrink-0 flex items-end bg-zinc-900/80 pt-1.5">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={`flex items-center px-3 py-2 border-b-2 -mb-px rounded-t-md max-w-[200px] cursor-pointer relative group ${
                            tab.id === activeTabId ? 'bg-zinc-800 border-blue-500' : 'bg-zinc-900/50 border-transparent hover:bg-zinc-700'
                        }`}
                        title={tab.title}
                    >
                        {tab.favicon && <img src={tab.favicon} alt="" className="w-4 h-4 mr-2" />}
                        {!tab.favicon && <BrowserIcon isSmall className="w-4 h-4 mr-2 text-zinc-400" />}
                        <span className="text-xs truncate flex-grow">{tab.title}</span>
                        <button onClick={(e) => closeTab(e, tab.id)} className="ml-2 p-0.5 rounded-full hover:bg-zinc-600 flex-shrink-0 group-hover:opacity-100 opacity-50"><CloseIcon className="w-3 h-3"/></button>
                    </div>
                ))}
                <button onClick={addNewTab} className="p-2.5 mb-px hover:bg-zinc-700 rounded-t-md"><PlusIcon /></button>
            </div>

            <div className="flex-shrink-0 flex items-center p-1.5 bg-zinc-800 border-b border-zinc-700 space-x-1">
                <button onClick={goBack} disabled={!activeTab || activeTab.historyIndex === 0} className="p-1.5 rounded-full hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Back"><BackIcon /></button>
                <button onClick={goForward} disabled={!activeTab || activeTab.historyIndex >= activeTab.history.length - 1} className="p-1.5 rounded-full hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Forward"><ForwardIcon /></button>
                <button onClick={reload} disabled={!activeTab} className="p-1.5 rounded-full hover:bg-zinc-700 disabled:opacity-30" title="Reload">{activeTab?.isLoading && !activeTab.url.startsWith('about:') ? <Spinner /> : <RefreshIcon />}</button>
                <button onClick={() => activeTab && navigate(NEW_TAB_PAGE, activeTab.id)} disabled={!activeTab} className="p-1.5 rounded-full hover:bg-zinc-700 disabled:opacity-30" title="Home"><HomeIcon /></button>
                <input
                    ref={addressBarRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleAddressBarSubmit}
                    onFocus={(e) => e.target.select()}
                    className="flex-grow bg-zinc-900 border border-zinc-700 rounded-full py-1.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-zinc-400"
                    placeholder="Search or enter address"
                    disabled={!activeTab}
                />
            </div>

            <div className="flex-grow relative bg-black">
                {renderContent()}
            </div>

            <div className="flex-shrink-0 text-xs px-2 py-0.5 bg-zinc-900/80 border-t border-zinc-700 text-zinc-400 truncate">
                {activeTab?.isLoading ? 'Loading...' : `Note: Some websites may not load due to security policies (X-Frame-Options).`}
            </div>
        </div>
    );
};

export const appDefinition: AppDefinition = {
  id: 'chrome',
  name: 'Chrome',
  icon: BrowserIcon,
  component: ChromeApp,
  defaultSize: { width: 900, height: 650 },
  isPinnedToTaskbar: true,
};

export default ChromeApp;