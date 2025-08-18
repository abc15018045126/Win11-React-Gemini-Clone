
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OpenApp, ClipboardItem, FilesystemItem } from '../types';
import { CloseIcon, MinimizeIcon, MaximizeIcon, RestoreIcon, TASKBAR_HEIGHT } from '../constants';
import { useTheme } from './theme';

interface AppWindowProps {
  app: OpenApp;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  onDrag: (instanceId: string, position: { x: number; y: number }) => void;
  onResize: (instanceId: string, size: { width: number; height: number }) => void; // Resizing not fully implemented
  isActive: boolean;
  desktopRef: React.RefObject<HTMLDivElement>;
  onSetTitle: (newTitle: string) => void;
  onWallpaperChange: (newUrl: string) => void;
  openApp?: (appId: string, initialData?: any) => void;
  clipboard?: ClipboardItem | null;
  handleCopy?: (item: FilesystemItem) => void;
  handleCut?: (item: FilesystemItem) => void;
  handlePaste?: (destinationPath: string) => void;
}

const AppWindow: React.FC<AppWindowProps> = ({
  app,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  onDrag,
  // onResize, // For future use
  isActive,
  desktopRef,
  onSetTitle,
  onWallpaperChange,
  openApp,
  clipboard,
  handleCopy,
  handleCut,
  handlePaste,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 }); // Mouse position at drag start
  const [initialWinPos, setInitialWinPos] = useState({ x: 0, y: 0 }); // Window position at drag start
  const windowRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const handleMouseDownHeader = (e: React.MouseEvent<HTMLDivElement>) => {
    if (app.isMaximized) return; // Don't drag if maximized
    if ((e.target as HTMLElement).closest('button')) return;

    onFocus();
    setIsDragging(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setInitialWinPos(app.position);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || app.isMaximized) return;

    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    
    let newX = initialWinPos.x + dx;
    let newY = initialWinPos.y + dy;

    const desktopWidth = desktopRef.current?.clientWidth || window.innerWidth;
    const desktopHeight = (desktopRef.current?.clientHeight || window.innerHeight) - TASKBAR_HEIGHT;
    const windowWidth = windowRef.current?.offsetWidth || app.size.width;

    newX = Math.max(0, Math.min(newX, desktopWidth - windowWidth));
    newY = Math.max(0, Math.min(newY, desktopHeight - 30));

    onDrag(app.instanceId, { x: newX, y: newY });
  }, [isDragging, dragStartPos, initialWinPos, app.instanceId, onDrag, app.isMaximized, app.size.width, desktopRef]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  const AppComponent = app.component;

  const windowClasses = `
    fixed flex flex-col shadow-2xl rounded-lg overflow-hidden
    border
    transition-opacity duration-150 ease-in-out
    ${app.isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}
    ${theme.appWindow.background}
    ${isActive ? theme.appWindow.borderActive : theme.appWindow.border}
  `;

  return (
    <div
      ref={windowRef}
      className={windowClasses}
      style={{
        left: `${app.position.x}px`,
        top: `${app.position.y}px`,
        width: `${app.size.width}px`,
        height: `${app.size.height}px`,
        zIndex: app.zIndex,
        transition: isDragging ? 'none' : 'left 0.1s ease-out, top 0.1s ease-out, width 0.2s ease-out, height 0.2s ease-out, opacity 0.15s ease-in-out',
      }}
      onMouseDown={onFocus}
    >
      <div
        className={`flex items-center justify-between h-8 px-3 ${app.isMaximized ? '' : 'cursor-grab'} select-none ${theme.appWindow.header} ${theme.appWindow.textColor}`}
        onMouseDown={handleMouseDownHeader}
        onDoubleClick={onMaximize}
      >
        <div className="flex items-center space-x-2">
          <app.icon className="w-4 h-4" isSmall />
          <span className="text-xs font-medium truncate">{app.title}</span>
        </div>
        <div className="flex items-center space-x-1">
          <button onClick={onMinimize} className="p-1.5 hover:bg-white/20 rounded-sm" title="Minimize"><MinimizeIcon /></button>
          <button onClick={onMaximize} className="p-1.5 hover:bg-white/20 rounded-sm" title={app.isMaximized ? "Restore" : "Maximize"}>
            {app.isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-red-500/80 rounded-sm" title="Close"><CloseIcon /></button>
        </div>
      </div>

      <div className={`flex-grow overflow-auto custom-scrollbar ${theme.appWindow.background}`}>
        <AppComponent 
            appInstanceId={app.instanceId} 
            onClose={onClose}
            setTitle={(newTitle) => onSetTitle(newTitle)}
            wallpaper={app.id === 'themes' ? theme.wallpaper : undefined}
            onWallpaperChange={app.id === 'themes' ? onWallpaperChange : undefined}
            openApp={openApp}
            initialData={app.initialData}
            clipboard={clipboard}
            handleCopy={handleCopy}
            handleCut={handleCut}
            handlePaste={handlePaste}
         />
      </div>
    </div>
  );
};

export default AppWindow;