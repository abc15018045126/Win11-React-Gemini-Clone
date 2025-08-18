import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppComponentProps, AppDefinition } from '../../types';
import { HyperIcon as TerminusIcon } from '../../constants';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const TerminusApp: React.FC<AppComponentProps> = ({ setTitle }) => {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [host, setHost] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [output, setOutput] = useState('');
    const [input, setInput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const ws = useRef<WebSocket | null>(null);
    const terminalBodyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTitle(`Terminus - ${status}`);
    }, [setTitle, status]);

    // Fetch current OS user to pre-fill the form
    useEffect(() => {
        fetch('http://localhost:3001/api/os-user')
            .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch user'))
            .then(data => {
                setUsername(data.username || '');
                setHost('127.0.0.1');
            })
            .catch(err => {
                console.error("Couldn't fetch OS username:", err);
                setOutput("Could not get local username. Please enter it manually.\n");
                setHost('127.0.0.1');
            });
    }, []);
    
    // Auto-scroll terminal
    useEffect(() => {
        if (terminalBodyRef.current) {
            terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
        }
    }, [output]);

    // Auto-focus input
    useEffect(() => {
        if (status === 'connected') {
            inputRef.current?.focus();
        }
    }, [status]);
    
    // Cleanup WebSocket on unmount
    useEffect(() => {
        return () => {
            ws.current?.close();
        };
    }, []);

    const handleConnect = useCallback(() => {
        if (!host || !username || !password) {
            setErrorMsg('Host, username, and password are required.');
            return;
        }

        setStatus('connecting');
        setErrorMsg('');
        setOutput(`Connecting to ${username}@${host}...\n`);

        ws.current = new WebSocket('ws://localhost:3002');

        ws.current.onopen = () => {
            const connectPayload = {
                type: 'connect',
                payload: { host, username, password },
            };
            ws.current?.send(JSON.stringify(connectPayload));
        };

        ws.current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'status':
                    if (message.payload === 'connected') {
                        setStatus('connected');
                        setPassword(''); // Clear password after successful connect
                    } else {
                        setStatus('disconnected');
                    }
                    break;
                case 'data':
                    setOutput(prev => prev + message.payload);
                    break;
                case 'error':
                    setOutput(prev => prev + `\nError: ${message.payload}\n`);
                    setErrorMsg(message.payload);
                    setStatus('error');
                    ws.current?.close();
                    break;
            }
        };
        
        ws.current.onerror = (event) => {
             const error = 'WebSocket connection failed. Is the backend server running?';
             setOutput(prev => prev + error + '\n');
             setErrorMsg(error);
             setStatus('error');
        };

        ws.current.onclose = () => {
            if (status !== 'error') {
                 setOutput(prev => prev + '\nConnection closed.\n');
                 setStatus('disconnected');
            }
        };

    }, [host, username, password, status]);

    const handleDisconnect = () => {
        ws.current?.send(JSON.stringify({ type: 'disconnect' }));
        ws.current?.close();
    };

    const handleProcessCommand = () => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
        ws.current.send(JSON.stringify({ type: 'data', payload: input + '\n' }));
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleProcessCommand();
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-zinc-200 font-mono text-sm">
            {status !== 'connected' ? (
                // --- Connection View ---
                <div className="flex-grow flex items-center justify-center p-8">
                    <div className="w-full max-w-sm bg-zinc-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold text-center mb-4">New SSH Connection</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Host</label>
                                <input type="text" value={host} onChange={e => setHost(e.target.value)} className="w-full bg-zinc-900 p-2 rounded border border-zinc-700 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
                            </div>
                             <div>
                                <label className="block text-xs text-zinc-400 mb-1">Username</label>
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-zinc-900 p-2 rounded border border-zinc-700 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Password</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConnect()} className="w-full bg-zinc-900 p-2 rounded border border-zinc-700 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
                            </div>
                        </div>
                        {errorMsg && <p className="text-red-400 text-xs mt-4 text-center">{errorMsg}</p>}
                        <button onClick={handleConnect} disabled={status === 'connecting'} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 p-2 rounded font-semibold transition-colors">
                            {status === 'connecting' ? 'Connecting...' : 'Connect'}
                        </button>
                    </div>
                </div>
            ) : (
                // --- Terminal View ---
                <div className="flex-grow flex flex-col p-2 overflow-hidden" onClick={() => inputRef.current?.focus()}>
                    <div ref={terminalBodyRef} className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                        <pre className="whitespace-pre-wrap break-words">{output}</pre>
                        <div className="flex items-center">
                            <span className="flex-shrink-0">{input}</span>
                            <span className="blinking-cursor"></span>
                        </div>
                    </div>
                     {/* Hidden input to capture keyboard events */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="absolute w-0 h-0 p-0 m-0 border-0 opacity-0"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck="false"
                    />
                    <button onClick={handleDisconnect} className="absolute bottom-2 right-2 text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded">
                        Disconnect
                    </button>
                </div>
            )}
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
