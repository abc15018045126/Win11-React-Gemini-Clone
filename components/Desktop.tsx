
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FilesystemItem, AppComponentProps, ClipboardItem } from '../types';
import * as FsService from '../services/filesystemService';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { TASKBAR_HEIGHT } from '../constants';
import { FolderIcon, FileCodeIcon, FileJsonIcon, FileGenericIcon, NotebookIcon } from '../constants';
import { APP_DEFINITIONS } from './apps';


const GRID_SIZE = 90;

interface DesktopIconState {
  id: string; // path
  item: FilesystemItem;
  position: { x: number; y: number };
}

interface DesktopProps extends Pick<AppComponentProps, 'openApp' | 'clipboard' | 'handleCopy' | 'handleCut' | 'handlePaste'> {}


const getFileIcon = (item: FilesystemItem) => {
    const appDef = APP_DEFINITIONS.find(def => def.id === item.name.replace('.app','').replace(' ', '').toLowerCase());
    if (appDef) return <appDef.icon className="w-10 h-10 mb-1 pointer-events-none" />;

    const filename = item.name;
    if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return <FileCodeIcon className="w-10 h-10 text-cyan-400" />;
    if (filename.endsWith('.json')) return <FileJsonIcon className="w-10 h-10 text-yellow-400" />;
    if (filename.endsWith('.html')) return <FileCodeIcon className="w-10 h-10 text-orange-500" />;
    if (filename.endsWith('.txt') || filename.endsWith('.md')) return <NotebookIcon isSmall className="w-10 h-10 text-zinc-300" />;
    return <FileGenericIcon className="w-10 h-10 text-zinc-400" />;
}


const Desktop: React.FC<DesktopProps> = ({ openApp, clipboard, handleCopy, handleCut, handlePaste }) => {
  const [icons, setIcons] = useState<DesktopIconState[]>([]);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [draggingIcon, setDraggingIcon] = useState<{ id: string; offset: { x: number; y: number } } | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item?: DesktopIconState } | null>(null);
  const [renamingIconId, setRenamingIconId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const DESKTOP_PATH = '/Desktop';

  const fetchDesktopItems = useCallback(async () => {
      const desktopItems = await FsService.listDirectory(DESKTOP_PATH);
      if (desktopRef.current) {
          const desktopHeight = desktopRef.current.clientHeight;
          const iconsPerColumn = Math.floor((desktopHeight - 20) / GRID_SIZE);

          setIcons(
              desktopItems.map((item, index) => ({
                  id: item.path,
                  item,
                  position: {
                      x: 10 + Math.floor(index / iconsPerColumn) * GRID_SIZE,
                      y: 10 + (index % iconsPerColumn) * GRID_SIZE,
                  },
              }))
          );
      }
  }, []);

  useEffect(() => {
    fetchDesktopItems();
  }, [fetchDesktopItems]);


  const handleIconMouseDown = (e: React.MouseEvent, icon: DesktopIconState) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0 || renamingIconId === icon.id) return;
    setSelectedIconId(icon.id);
    setContextMenu(null);
    setDraggingIcon({
      id: icon.id,
      offset: { x: e.clientX - icon.position.x, y: e.clientY - icon.position.y },
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingIcon || !desktopRef.current) return;
    let newX = e.clientX - draggingIcon.offset.x;
    let newY = e.clientY - draggingIcon.offset.y;
    const desktopWidth = desktopRef.current.clientWidth;
    const desktopHeight = desktopRef.current.clientHeight;
    newX = Math.max(10, Math.min(newX, desktopWidth - GRID_SIZE + 10));
    newY = Math.max(10, Math.min(newY, desktopHeight - GRID_SIZE + 10));
    setIcons(prev =>
      prev.map(icon =>
        icon.id === draggingIcon.id ? { ...icon, position: { x: newX, y: newY } } : icon
      )
    );
  }, [draggingIcon]);

  const handleMouseUp = useCallback(() => {
    if (draggingIcon) {
      setIcons(prevIcons =>
        prevIcons.map(icon => {
          if (icon.id === draggingIcon.id) {
            const snappedX = Math.round((icon.position.x - 10) / GRID_SIZE) * GRID_SIZE + 10;
            const snappedY = Math.round((icon.position.y - 10) / GRID_SIZE) * GRID_SIZE + 10;
            return { ...icon, position: { x: snappedX, y: snappedY } };
          }
          return icon;
        })
      );
      setDraggingIcon(null);
    }
  }, [draggingIcon]);

  useEffect(() => {
    if (draggingIcon) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIcon, handleMouseMove, handleMouseUp]);
  
  const handleDoubleClick = (item: FilesystemItem) => {
    if (item.name.endsWith('.app') && item.content) {
        try {
            const appInfo = JSON.parse(item.content);
            openApp?.(appInfo.appId);
        } catch(e) { console.error("Could not parse app shortcut", e); }
    } else if (item.type === 'file') {
        openApp?.('notebook', { file: { path: item.path, name: item.name } });
    } else {
        openApp?.('fileExplorer', { initialPath: item.path });
    }
  };

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.target !== desktopRef.current) return;
    setSelectedIconId(null);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };
  
  const handleIconContextMenu = (e: React.MouseEvent, icon: DesktopIconState) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIconId(icon.id);
    setContextMenu({ x: e.clientX, y: e.clientY, item: icon });
  };
  
  const handleRename = async () => {
    const icon = icons.find(i => i.id === renamingIconId);
    if (icon && renameValue && icon.item.name !== renameValue) {
        await FsService.renameItem(icon.item, renameValue);
        await fetchDesktopItems();
    }
    setRenamingIconId(null);
  };

  const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!contextMenu) return [];
    const selectedIconState = contextMenu.item;
    const selectedItem = selectedIconState?.item;

    const createNewFolder = async () => {
      const name = await FsService.findUniqueName(DESKTOP_PATH, "New folder", true);
      await FsService.createFolder(DESKTOP_PATH, name);
      fetchDesktopItems();
    }

    const createNewFile = async () => {
      const name = await FsService.findUniqueName(DESKTOP_PATH, "New Text Document", false, ".txt");
      await FsService.createFile(DESKTOP_PATH, name, "");
      fetchDesktopItems();
    }
    
    if (selectedItem && handleCopy && handleCut) {
      return [
        { type: 'item', label: 'Open', onClick: () => handleDoubleClick(selectedItem) },
        { type: 'separator' },
        { type: 'item', label: 'Cut', onClick: () => handleCut(selectedItem) },
        { type: 'item', label: 'Copy', onClick: () => handleCopy(selectedItem) },
        { type: 'separator' },
        { type: 'item', label: 'Delete', onClick: async () => { await FsService.deleteItem(selectedItem); fetchDesktopItems(); } },
        { type: 'item', label: 'Rename', onClick: () => { 
            setRenamingIconId(selectedIconState.id); 
            setRenameValue(selectedItem.name);
        } },
      ];
    } else if (handlePaste) {
      return [
        { type: 'item', label: 'New Folder', onClick: createNewFolder },
        { type: 'item', label: 'New Text File', onClick: createNewFile },
        { type: 'separator' },
        { type: 'item', label: 'Paste', onClick: () => handlePaste(DESKTOP_PATH), disabled: !clipboard},
        { type: 'separator' },
        { type: 'item', label: 'Display Settings', onClick: () => openApp?.('settings') },
        { type: 'item', label: 'About This Clone', onClick: () => openApp?.('about') },
      ];
    }
    return [];
  }, [contextMenu, openApp, clipboard, handleCopy, handleCut, handlePaste, fetchDesktopItems]);

  const handleDesktopClick = (e: React.MouseEvent) => {
    if (e.target === desktopRef.current) {
      if(renamingIconId) handleRename();
      setSelectedIconId(null);
      setContextMenu(null);
    }
  };


  return (
    <div
      ref={desktopRef}
      className="absolute inset-0 h-full w-full"
      style={{ paddingBottom: `${TASKBAR_HEIGHT}px` }}
      onContextMenu={handleDesktopContextMenu}
      onClick={handleDesktopClick}
    >
      {icons.map(icon => (
        <div
          key={icon.id}
          className="absolute flex flex-col items-center p-2 rounded cursor-pointer select-none"
          style={{
            left: `${icon.position.x}px`,
            top: `${icon.position.y}px`,
            width: `${GRID_SIZE - 10}px`,
            height: `${GRID_SIZE - 10}px`,
            backgroundColor: selectedIconId === icon.id ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
            border: selectedIconId === icon.id ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
            transition: draggingIcon?.id === icon.id ? 'none' : 'all 0.2s ease-out'
          }}
          onMouseDown={e => handleIconMouseDown(e, icon)}
          onDoubleClick={() => renamingIconId !== icon.id && handleDoubleClick(icon.item)}
          onContextMenu={e => handleIconContextMenu(e, icon)}
          title={icon.item.name}
        >
          {icon.item.type === 'folder' 
            ? <FolderIcon className="w-10 h-10 text-amber-400 mb-1 pointer-events-none" />
            : getFileIcon(icon.item)}
          
          {renamingIconId === icon.id ? (
            <input 
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              className="text-xs text-center text-black bg-white w-full border border-blue-500"
              autoFocus
              onFocus={e => e.target.select()}
            />
          ) : (
            <span className="text-xs text-center text-white shadow-black [text-shadow:1px_1px_2px_var(--tw-shadow-color)] truncate w-full pointer-events-none">
                {icon.item.name}
            </span>
          )}
        </div>
      ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default Desktop;