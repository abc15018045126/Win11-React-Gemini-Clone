
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { OpenApp, AppDefinition, ClipboardItem, FilesystemItem } from './types';
import { TASKBAR_HEIGHT, DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT } from './constants';
import * as FsService from './services/filesystemService';
import { APP_DEFINITIONS } from './components/apps';
import Taskbar from './components/Taskbar';
import StartMenu from './components/StartMenu';
import AppWindow from './components/AppWindow';
import Desktop from './components/Desktop';

const DEFAULT_WALLPAPER_URL = "https://images.unsplash.com/photo-1538438253629-5777598687b4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80&blur=10"; // A nice blurred abstract wallpaper

const App: React.FC = () => {
  const [openApps, setOpenApps] = useState<OpenApp[]>([]);
  const [activeAppInstanceId, setActiveAppInstanceId] = useState<string | null>(null);
  const [nextZIndex, setNextZIndex] = useState<number>(10);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState<boolean>(false);
  const [wallpaper, setWallpaper] = useState<string>(DEFAULT_WALLPAPER_URL);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  
  // A simple way to trigger refresh in filesystem-aware components
  const [refreshId, setRefreshId] = useState(0);
  const triggerRefresh = () => setRefreshId(id => id + 1);

  const getNextPosition = (appWidth: number, appHeight: number) => {
    const desktopWidth = desktopRef.current?.clientWidth || window.innerWidth;
    const desktopHeight = (desktopRef.current?.clientHeight || window.innerHeight) - TASKBAR_HEIGHT;
    
    const baseOffset = 20;
    const openAppCount = openApps.filter(app => !app.isMinimized).length;
    const xOffset = (openAppCount * baseOffset) % (desktopWidth - appWidth - baseOffset * 2);
    const yOffset = (openAppCount * baseOffset) % (desktopHeight - appHeight - baseOffset * 2);

    return {
      x: Math.max(0, Math.min(xOffset + baseOffset, desktopWidth - appWidth)),
      y: Math.max(0, Math.min(yOffset + baseOffset, desktopHeight - appHeight)),
    };
  };

  const openApp = useCallback((appId: string, initialData?: any) => {
    const appDef = APP_DEFINITIONS.find(app => app.id === appId);
    if (!appDef) return;

    if (!initialData) {
      const existingAppInstance = openApps.find(app => app.id === appId && !app.isMinimized);
      if (existingAppInstance) {
        focusApp(existingAppInstance.instanceId);
        return;
      }
      const minimizedInstance = openApps.find(app => app.id === appId && app.isMinimized);
      if (minimizedInstance) {
        toggleMinimizeApp(minimizedInstance.instanceId);
        return;
      }
    }

    const instanceId = `${appId}-${Date.now()}`;
    const newZIndex = nextZIndex + 1;
    setNextZIndex(newZIndex);

    const defaultWidth = appDef.defaultSize?.width || DEFAULT_WINDOW_WIDTH;
    const defaultHeight = appDef.defaultSize?.height || DEFAULT_WINDOW_HEIGHT;

    const newApp: OpenApp = {
      ...appDef,
      instanceId,
      zIndex: newZIndex,
      position: getNextPosition(defaultWidth, defaultHeight),
      size: { width: defaultWidth, height: defaultHeight },
      isMinimized: false,
      isMaximized: false,
      title: appDef.name,
      initialData: {...initialData, refreshId}, // Pass refreshId
    };

    setOpenApps(prev => [...prev, newApp]);
    setActiveAppInstanceId(instanceId);
    setIsStartMenuOpen(false);
  }, [nextZIndex, openApps, refreshId]);

  const focusApp = useCallback((instanceId: string) => {
    if (activeAppInstanceId === instanceId) return;

    const newZIndex = nextZIndex + 1;
    setNextZIndex(newZIndex);
    setOpenApps(prev =>
      prev.map(app =>
        app.instanceId === instanceId ? { ...app, zIndex: newZIndex, isMinimized: false } : app
      )
    );
    setActiveAppInstanceId(instanceId);
  }, [activeAppInstanceId, nextZIndex]);

  const closeApp = useCallback((instanceId: string) => {
    setOpenApps(prev => prev.filter(app => app.instanceId !== instanceId));
    if (activeAppInstanceId === instanceId) {
      setActiveAppInstanceId(null);
    }
  }, [activeAppInstanceId]);

  const toggleMinimizeApp = useCallback((instanceId: string) => {
     const app = openApps.find(a => a.instanceId === instanceId);
     if (!app) return;

     setOpenApps(prev =>
      prev.map(a => {
        if (a.instanceId === instanceId) {
          return { ...a, isMinimized: !a.isMinimized };
        }
        return a;
      })
    );
    
    if (app.isMinimized) {
        focusApp(instanceId);
    } else if (activeAppInstanceId === instanceId) {
        setActiveAppInstanceId(null);
    }
  }, [openApps, activeAppInstanceId, focusApp]);

 const toggleMaximizeApp = useCallback((instanceId: string) => {
    setOpenApps(prevOpenApps =>
      prevOpenApps.map(app => {
        if (app.instanceId === instanceId) {
          const desktopWidth = desktopRef.current?.clientWidth || window.innerWidth;
          const desktopHeight = (desktopRef.current?.clientHeight || window.innerHeight) - TASKBAR_HEIGHT;
          
          if (app.isMaximized) {
            return {
              ...app,
              isMaximized: false,
              position: app.previousPosition || getNextPosition(app.previousSize?.width || app.size.width, app.previousSize?.height || app.size.height),
              size: app.previousSize || app.size,
            };
          } else {
            const newZ = nextZIndex + 1;
            setNextZIndex(newZ);
            setActiveAppInstanceId(instanceId);
            return {
              ...app,
              isMaximized: true,
              previousPosition: app.position,
              previousSize: app.size,
              position: { x: 0, y: 0 },
              size: { width: desktopWidth, height: desktopHeight },
              zIndex: newZ,
            };
          }
        }
        return app;
      })
    );
  }, [nextZIndex]);

  const updateAppPosition = useCallback((instanceId: string, position: { x: number; y: number }) => {
    setOpenApps(prev =>
      prev.map(app => (app.instanceId === instanceId ? { ...app, position } : app))
    );
  }, []);
  
  const updateAppSize = useCallback((instanceId: string, size: { width: number; height: number }) => {
    setOpenApps(prev =>
      prev.map(app => (app.instanceId === instanceId ? { ...app, size } : app))
    );
  }, []);

  const updateAppTitle = useCallback((instanceId: string, title: string) => {
    setOpenApps(prev => 
      prev.map(app => app.instanceId === instanceId ? { ...app, title } : app)
    );
  }, []);

  const toggleStartMenu = useCallback(() => setIsStartMenuOpen(prev => !prev), []);
  const handleWallpaperChange = useCallback((newWallpaperUrl: string) => setWallpaper(newWallpaperUrl), []);
  
  // --- Filesystem Operations ---
  const handleCopy = useCallback((item: FilesystemItem) => {
    setClipboard({ item, operation: 'copy' });
  }, []);
  const handleCut = useCallback((item: FilesystemItem) => {
    setClipboard({ item, operation: 'cut' });
  }, []);
  const handlePaste = useCallback(async (destinationPath: string) => {
    if (!clipboard) return;
    const { item, operation } = clipboard;
    
    if (operation === 'copy') {
        await FsService.copyItem(item, destinationPath);
    } else { // cut
        await FsService.moveItem(item, destinationPath);
        setClipboard(null);
    }
    triggerRefresh();
  }, [clipboard]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isStartMenuOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.start-menu-container') && !target.closest('.taskbar-start-button')) {
          setIsStartMenuOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStartMenuOpen]);


  return (
    <div 
      ref={desktopRef}
      className="h-screen w-screen flex flex-col bg-cover bg-center" 
      style={{ backgroundImage: `url(${wallpaper})` }}
    >
      <div className="flex-grow relative overflow-hidden">
        <Desktop 
            openApp={openApp} 
            clipboard={clipboard} 
            handleCopy={handleCopy}
            handleCut={handleCut}
            handlePaste={handlePaste}
            key={refreshId} // Force remount on refresh
        />
        {openApps.filter(app => !app.isMinimized).map(app => (
          <AppWindow
            key={app.instanceId}
            app={{...app, initialData: {...app.initialData, refreshId, triggerRefresh}}}
            onClose={() => closeApp(app.instanceId)}
            onMinimize={() => toggleMinimizeApp(app.instanceId)}
            onMaximize={() => toggleMaximizeApp(app.instanceId)}
            onFocus={() => focusApp(app.instanceId)}
            onDrag={updateAppPosition}
            onResize={updateAppSize}
            isActive={app.instanceId === activeAppInstanceId}
            desktopRef={desktopRef}
            onSetTitle={(newTitle) => updateAppTitle(app.instanceId, newTitle)}
            onWallpaperChange={handleWallpaperChange}
            openApp={openApp}
            clipboard={clipboard}
            handleCopy={handleCopy}
            handleCut={handleCut}
            handlePaste={handlePaste}
          />
        ))}
      </div>

      {isStartMenuOpen && (
        <StartMenu
          apps={APP_DEFINITIONS}
          onOpenApp={openApp}
          onClose={() => setIsStartMenuOpen(false)}
        />
      )}

      <Taskbar
        openApps={openApps}
        activeAppInstanceId={activeAppInstanceId}
        onToggleStartMenu={toggleStartMenu}
        onAppIconClick={(appId, instanceId) => {
          if (instanceId) {
             const app = openApps.find(a => a.instanceId === instanceId);
             if (app?.isMinimized) {
                toggleMinimizeApp(instanceId);
             } else if (activeAppInstanceId !== instanceId) {
                focusApp(instanceId);
             } else {
                toggleMinimizeApp(instanceId);
             }
          } else {
            openApp(appId);
          }
        }}
      />
    </div>
  );
};

export default App;