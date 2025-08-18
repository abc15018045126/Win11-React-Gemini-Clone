

import React, { useState, useEffect, useRef } from 'react';
import { AppDefinition, AppComponentProps } from '../../types';
import { Browser4Icon } from '../../constants';

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

// Define the type for the webview element to include Electron-specific properties
interface WebViewElement extends HTMLElement {
  loadURL(url: string): void;
  getURL(): string;
  getTitle(): string;
  isLoading(): boolean;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  getWebContentsId(): number;
  partition: string;
}

const isUrl = (str: string) => /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(str);
const DEFAULT_URL = 'https://www.google.com';

const Chrome4App: React.FC<AppComponentProps> = ({ setTitle: setWindowTitle }) => {
    const [inputValue, setInputValue] = useState(DEFAULT_URL);
    const [isLoading, setIsLoading] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const webviewRef = useRef<WebViewElement | null>(null);
    const partition = `persist:chrome4`;
    
    useEffect(() => {
        const webview = webviewRef.current;
        if (!webview) return;
        
        const handleLoadStart = () => setIsLoading(true);
        const handleLoadStop = () => {
            setIsLoading(false);
            const currentUrl = webview.getURL();
            if (currentUrl && !currentUrl.startsWith('about:blank')) {
                setWindowTitle(`${webview.getTitle()} - Chrome 4`);
                setInputValue(currentUrl);
            } else {
                setWindowTitle(`New Tab - Chrome 4`);
            }
            setCanGoBack(webview.canGoBack());
            setCanGoForward(webview.canGoForward());
        };
        
        webview.addEventListener('did-start-loading', handleLoadStart);
        webview.addEventListener('did-stop-loading', handleLoadStop);
        webview.addEventListener('did-fail-load', handleLoadStop); // Also stop loading on failure
        
        // Load initial URL
        if(webview.getURL() !== DEFAULT_URL) {
            webview.loadURL(DEFAULT_URL);
        } else {
            handleLoadStop();
        }

        return () => {
            webview.removeEventListener('did-start-loading', handleLoadStart);
            webview.removeEventListener('did-stop-loading', handleLoadStop);
            webview.removeEventListener('did-fail-load', handleLoadStop);
        };
    }, [setWindowTitle]);

    const navigate = (input: string) => {
        const webview = webviewRef.current;
        if (!webview) return;
        let newUrl = input.trim();
        if (isUrl(newUrl)) {
            newUrl = !/^https?:\/\//i.test(newUrl) ? `https://${newUrl}` : newUrl;
        } else {
            newUrl = `https://duckduckgo.com/?q=${encodeURIComponent(newUrl)}`;
        }
        webview.loadURL(newUrl);
    };

    const handleAddressBarSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') navigate(inputValue);
    };

    return (
        <div className="flex flex-col h-full bg-zinc-800 text-white select-none">
            <div className="flex-shrink-0 flex items-center p-1.5 bg-zinc-800 border-b border-zinc-700 space-x-1">
                <button onClick={() => webviewRef.current?.goBack()} disabled={!canGoBack} className="p-1.5 rounded-full hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Back"><BackIcon /></button>
                <button onClick={() => webviewRef.current?.goForward()} disabled={!canGoForward} className="p-1.5 rounded-full hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed" title="Forward"><ForwardIcon /></button>
                <button onClick={() => webviewRef.current?.reload()} className="p-1.5 rounded-full hover:bg-zinc-700 disabled:opacity-30" title="Reload">{isLoading ? <Spinner /> : <RefreshIcon />}</button>
                <button onClick={() => webviewRef.current?.loadURL(DEFAULT_URL)} className="p-1.5 rounded-full hover:bg-zinc-700 disabled:opacity-30" title="Home"><HomeIcon /></button>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleAddressBarSubmit}
                    onFocus={(e) => e.target.select()}
                    className="flex-grow bg-zinc-900 border border-zinc-700 rounded-full py-1.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-zinc-400"
                    placeholder="Search or enter address"
                />
            </div>

            <div className="flex-grow relative bg-black">
                {window.electronAPI ? (
                    React.createElement('webview', {
                        ref: webviewRef,
                        src: "about:blank",
                        className: "w-full h-full border-none bg-white",
                        partition: partition,
                        allowpopups: true
                    })
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-400">
                        This feature is only available in the Electron version of the app.
                    </div>
                )}
            </div>
             <div className="flex-shrink-0 text-xs px-2 py-0.5 bg-zinc-900/80 border-t border-zinc-700 text-zinc-400 truncate">
                {isLoading ? 'Loading...' : `This browser can display sites with strict security policies.`}
            </div>
        </div>
    );
};

export const appDefinition: AppDefinition = {
  id: 'chrome4',
  name: 'Chrome 4',
  icon: Browser4Icon,
  component: Chrome4App,
  defaultSize: { width: 900, height: 650 },
  isPinnedToTaskbar: true,
};

export default Chrome4App;
