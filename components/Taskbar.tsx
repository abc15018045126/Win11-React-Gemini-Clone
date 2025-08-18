
import React, { useState, useEffect } from 'react';
import { OpenApp, AppDefinition } from '../types';
import { StartIcon, TASKBAR_HEIGHT } from '../constants';
import { APP_DEFINITIONS } from './apps';


interface TaskbarProps {
  openApps: OpenApp[];
  activeAppInstanceId: string | null;
  onToggleStartMenu: () => void;
  onAppIconClick: (appId: string, instanceId?: string) => void;
}

const Taskbar: React.FC<TaskbarProps> = ({ openApps, activeAppInstanceId, onToggleStartMenu, onAppIconClick }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const pinnedApps = APP_DEFINITIONS.filter(appDef => appDef.isPinnedToTaskbar);
  
  // Combine pinned apps and unique open apps for taskbar display
  const taskbarItemsMap = new Map<string, {appDef: AppDefinition, instance?: OpenApp}>();

  pinnedApps.forEach(appDef => {
    taskbarItemsMap.set(appDef.id, { appDef });
  });

  openApps.forEach(openApp => {
    // If already pinned, update with instance info. Otherwise, add as an open app.
    const existing = taskbarItemsMap.get(openApp.id);
    taskbarItemsMap.set(openApp.id, { appDef: existing?.appDef || openApp, instance: openApp });
  });
  
  const taskbarItems = Array.from(taskbarItemsMap.values());


  return (
    <div
      className="h-[${TASKBAR_HEIGHT}px] bg-black/80 backdrop-blur-xl text-white flex items-center justify-between px-4 fixed bottom-0 left-0 right-0 z-50"
      style={{ height: `${TASKBAR_HEIGHT}px` }}
    >
      {/* Centered Icons */}
      <div className="flex-1 flex justify-center items-center h-full">
        <div className="flex items-center space-x-2 h-full">
          <button
            onClick={onToggleStartMenu}
            className="taskbar-start-button p-2 hover:bg-white/20 rounded h-full flex items-center"
            aria-label="Start Menu"
          >
            <StartIcon className="w-5 h-5 text-blue-400" />
          </button>

          {taskbarItems.map(({ appDef, instance }) => {
            const isActive = instance?.instanceId === activeAppInstanceId && !instance?.isMinimized;
            const isMinimized = instance?.isMinimized;
            const isOpen = !!instance;

            return (
              <button
                key={appDef.id}
                onClick={() => onAppIconClick(appDef.id, instance?.instanceId)}
                className={`p-2 rounded h-[calc(100%-8px)] flex items-center relative transition-colors duration-150 ease-in-out
                            ${isActive ? 'bg-white/30' : 'hover:bg-white/20'}
                            ${isMinimized ? 'opacity-70' : ''}`}
                title={appDef.name}
              >
                <appDef.icon className="w-5 h-5" isSmall />
                {isOpen && (
                  <span className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-1 rounded-t-sm 
                                  ${isActive ? 'bg-blue-400' : isMinimized ? 'bg-gray-400' : 'bg-gray-500'}`}></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* System Tray - right aligned */}
      <div className="flex items-center space-x-3 text-xs">
        {/* Placeholder for Wifi, Sound, Battery */}
        {/* <WifiIcon className="w-4 h-4" />
        <SoundIcon className="w-4 h-4" />
        <BatteryIcon className="w-4 h-4" /> */}
        <div>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        <div>{currentTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
      </div>
    </div>
  );
};

export default Taskbar;