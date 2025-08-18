
import React, { useState, useEffect } from 'react';
import { AppDefinition, AppComponentProps } from '../../../types';
import { SettingsIcon } from '../../../constants';

const SettingsApp: React.FC<AppComponentProps> = ({ appInstanceId, setTitle, wallpaper: currentWallpaper, onWallpaperChange }) => {
  const [wallpaperUrlInput, setWallpaperUrlInput] = useState(currentWallpaper || '');

  useEffect(() => {
    setTitle(`Settings - Personalization`);
  }, [setTitle]);

  useEffect(() => {
    // Sync input if wallpaper changes externally (e.g. App.tsx default load)
    if(currentWallpaper) setWallpaperUrlInput(currentWallpaper);
  }, [currentWallpaper]);

  const handleApplyWallpaper = () => {
    if (onWallpaperChange && wallpaperUrlInput.trim()) {
      onWallpaperChange(wallpaperUrlInput.trim());
    }
  };
  
  const popularWallpapers = [
    "https://images.unsplash.com/photo-1538438253629-5777598687b4?auto=format&fit=crop&w=1920&q=80&blur=10",
    "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1920&q=80&blur=10",
    "https://images.unsplash.com/photo-1500964757637-c85e8a162699?auto=format&fit=crop&w=1920&q=80&blur=10",
    "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1920&q=80&blur=10",
  ];


  return (
    <div className="p-6 text-zinc-200 h-full overflow-y-auto custom-scrollbar">
      <h1 className="text-2xl font-semibold mb-6 text-white">Settings</h1>
      
      <div className="mb-8 p-4 bg-zinc-900/50 rounded-lg">
        <h2 className="text-lg font-medium mb-3 text-white">Personalization</h2>
        <p className="text-sm text-zinc-300 mb-1">Current Wallpaper URL:</p>
        <div className="flex items-center space-x-2 mb-3">
          <input
            type="text"
            value={wallpaperUrlInput}
            onChange={(e) => setWallpaperUrlInput(e.target.value)}
            placeholder="Enter image URL for wallpaper"
            className="flex-grow bg-zinc-800 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-zinc-400"
          />
          <button
            onClick={handleApplyWallpaper}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Apply
          </button>
        </div>
        <p className="text-xs text-zinc-400">Try URLs from <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Unsplash</a> or other image sources.</p>
      </div>

      <div className="mb-8 p-4 bg-zinc-900/50 rounded-lg">
        <h2 className="text-lg font-medium mb-3 text-white">Choose a Wallpaper</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {popularWallpapers.map((url, index) => (
            <button 
              key={index}
              onClick={() => {
                setWallpaperUrlInput(url);
                if(onWallpaperChange) onWallpaperChange(url);
              }}
              className="aspect-video bg-cover bg-center rounded-md overflow-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-800 transition-all hover:opacity-80"
              style={{ backgroundImage: `url(${url.replace('&blur=10','')}&w=300&h=169&fit=crop`}} // smaller preview
              title={`Apply Wallpaper ${index + 1}`}
            >
               <div className="w-full h-full bg-black/20 hover:bg-black/0 transition-colors"></div>
            </button>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-zinc-500 mt-auto pt-4">
        Settings App v1.0.0
      </div>
    </div>
  );
};

export const appDefinition: AppDefinition = {
  id: 'settings',
  name: 'Settings',
  icon: SettingsIcon,
  component: SettingsApp,
  defaultSize: { width: 700, height: 500 },
  isPinnedToTaskbar: true,
};

export default SettingsApp;
