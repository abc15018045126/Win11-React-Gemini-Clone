
import React, { useState, useMemo } from 'react';
import { AppDefinition } from '../types';
import { SearchIcon, SettingsIcon, StartIcon as PowerIcon } from '../constants'; // Reusing StartIcon as PowerIcon for simplicity

interface StartMenuProps {
  apps: AppDefinition[];
  onOpenApp: (appId: string) => void;
  onClose: () => void;
}

const StartMenu: React.FC<StartMenuProps> = ({ apps, onOpenApp, onClose }) => {
  const [isShowingAllApps, setIsShowingAllApps] = useState(false);

  // Pinned apps (example, could be dynamic later)
  const pinnedApps = apps.slice(0, 6); // Show first 6 apps as "pinned"
  const recommendedApps = apps.slice(Math.min(6, apps.length), Math.min(12, apps.length)); // Show next 6 as "recommended"

  const sortedApps = useMemo(() => 
    [...apps].sort((a, b) => a.name.localeCompare(b.name)), 
    [apps]
  );

  return (
    <div 
      className="start-menu-container fixed bottom-[52px] left-1/2 transform -translate-x-1/2 
                 w-[580px] h-[650px] bg-black/80 backdrop-blur-xl rounded-lg shadow-2xl 
                 text-white flex flex-col p-6 z-40"
      onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing immediately
    >
      {/* Search Bar */}
      <div className="mb-6 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Type here to search"
            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-md py-2.5 px-4 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-zinc-400"
          />
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-hidden">
        {isShowingAllApps ? (
          // All Apps View
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0 flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-white">All Apps</h2>
              <button
                onClick={() => setIsShowingAllApps(false)}
                className="px-3 py-1 text-xs bg-zinc-800/80 hover:bg-zinc-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                &lt; Back
              </button>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar -mr-4 pr-4">
              <div className="space-y-1">
                {sortedApps.map(app => (
                  <button
                    key={`all-${app.id}`}
                    onClick={() => { onOpenApp(app.id); onClose(); }}
                    className="w-full flex items-center p-2 hover:bg-white/10 rounded-md transition-colors"
                    title={app.name}
                  >
                    <app.icon className="w-6 h-6 mr-4 flex-shrink-0" />
                    <span className="text-sm text-left truncate">{app.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Pinned & Recommended View
          <div>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-zinc-300">Pinned</h2>
                <button
                  onClick={() => setIsShowingAllApps(true)}
                  className="px-3 py-1 text-xs bg-zinc-800/80 hover:bg-zinc-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  All apps &gt;
                </button>
              </div>
              <div className="grid grid-cols-6 gap-4">
                {pinnedApps.map(app => (
                  <button
                    key={app.id}
                    onClick={() => { onOpenApp(app.id); onClose(); }}
                    className="flex flex-col items-center justify-center p-2 hover:bg-white/10 rounded-md transition-colors aspect-square"
                    title={app.name}
                  >
                    <app.icon className="w-8 h-8 mb-1.5" />
                    <span className="text-xs text-center truncate w-full">{app.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Recommended</h2>
              <div className="space-y-2">
                {recommendedApps.map(app => (
                  <button
                    key={`rec-${app.id}`}
                    onClick={() => { onOpenApp(app.id); onClose(); }}
                    className="w-full flex items-center p-2 hover:bg-white/10 rounded-md transition-colors"
                    title={app.name}
                  >
                    <app.icon className="w-6 h-6 mr-3 flex-shrink-0" />
                    <span className="text-sm text-left truncate">{app.name}</span>
                  </button>
                ))}
                {recommendedApps.length === 0 && <p className="text-xs text-zinc-400">No recommendations yet.</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - User & Power */}
      <div className="flex-shrink-0 mt-auto pt-4 border-t border-zinc-800/50 flex justify-between items-center">
        <button className="flex items-center p-2 hover:bg-white/10 rounded-md">
          <img src="https://picsum.photos/seed/user/32/32" alt="User" className="w-7 h-7 rounded-full mr-2" />
          <span className="text-sm">User</span>
        </button>
        <div className="flex space-x-1">
          <button title="Settings" onClick={() => { onOpenApp('settings'); onClose(); }} className="p-2 hover:bg-white/10 rounded-md">
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button title="Power (Placeholder)" className="p-2 hover:bg-white/10 rounded-md">
            <PowerIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartMenu;