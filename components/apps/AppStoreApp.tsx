import React, { useState, useEffect, useCallback } from 'react';
import { AppDefinition, AppComponentProps } from '../../types';
import { StoreIcon, RefreshIcon } from '../../constants';
import * as FsService from '../../services/filesystemService';
import { APP_DEFINITIONS } from '.';

const AppStoreApp: React.FC<AppComponentProps> = ({ setTitle, initialData }) => {
    const [installedAppIds, setInstalledAppIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const triggerRefresh = initialData?.triggerRefresh;

    const fetchInstalledApps = useCallback(async () => {
        // Don't set isLoading to true here to prevent flickering on refresh.
        // It will only be true on the initial mount.
        const desktopItems = await FsService.listDirectory('/Desktop');
        const ids = new Set<string>();
        for (const item of desktopItems) {
            if (item.name.endsWith('.app') && item.content) {
                try {
                    const appInfo = JSON.parse(item.content);
                    if (appInfo.appId) {
                        ids.add(appInfo.appId);
                    }
                } catch (e) {
                    console.error(`Could not parse app shortcut: ${item.name}`, e);
                }
            }
        }
        setInstalledAppIds(ids);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        setTitle('App Store');
        fetchInstalledApps();
    }, [setTitle, fetchInstalledApps]);

    const handleInstall = async (app: AppDefinition) => {
        const success = await FsService.createAppShortcut(app.id, app.name);
        if (success) {
            // Refresh the desktop to show the new icon
            triggerRefresh?.();
            // Manually update this component's state without flickering
            fetchInstalledApps();
        } else {
            alert(`Failed to install ${app.name}.`);
        }
    };

    const availableApps = APP_DEFINITIONS.filter(app => app.id !== 'appStore');

    return (
        <div className="p-6 text-zinc-200 h-full overflow-y-auto custom-scrollbar bg-zinc-900">
            <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center">
                    <StoreIcon className="w-10 h-10 text-blue-400 mr-4" />
                    <div>
                        <h1 className="text-2xl font-semibold text-white">App Store</h1>
                        <p className="text-sm text-zinc-400">Discover and install new applications.</p>
                    </div>
                </div>
                <button
                    onClick={() => fetchInstalledApps()}
                    className="p-2 rounded-md hover:bg-zinc-700 transition-colors"
                    title="Check for updates"
                >
                    <RefreshIcon className="w-5 h-5 text-zinc-300" />
                </button>
            </div>


            {isLoading ? (
                <div className="text-center py-10">Loading applications...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableApps.map(app => {
                        const isInstalled = installedAppIds.has(app.id);
                        return (
                            <div key={app.id} className="bg-zinc-800/50 p-4 rounded-lg flex items-center space-x-4">
                                <app.icon className="w-12 h-12 flex-shrink-0" />
                                <div className="flex-grow overflow-hidden">
                                    <h2 className="font-semibold text-white truncate">{app.name}</h2>
                                    <p className="text-xs text-zinc-400">Version 1.0</p>
                                </div>
                                <button
                                    onClick={() => handleInstall(app)}
                                    disabled={isInstalled}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                        isInstalled
                                            ? 'bg-zinc-700 text-zinc-400 cursor-default'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                >
                                    {isInstalled ? 'Installed' : 'Install'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const appDefinition: AppDefinition = {
    id: 'appStore',
    name: 'App Store',
    icon: StoreIcon,
    component: AppStoreApp,
    defaultSize: { width: 750, height: 550 },
    isPinnedToTaskbar: true,
};

export default AppStoreApp;