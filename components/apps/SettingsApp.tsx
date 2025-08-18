
import React, { useEffect } from 'react';
import { AppDefinition, AppComponentProps } from '../../types';
import { SettingsIcon } from '../../constants';

const SettingsApp: React.FC<AppComponentProps> = ({ appInstanceId, setTitle }) => {
  
  useEffect(() => {
    setTitle(`Settings`);
  }, [setTitle]);

  return (
    <div className="p-6 text-zinc-200 h-full overflow-y-auto custom-scrollbar">
      <h1 className="text-2xl font-semibold mb-6 text-white">Settings</h1>
      
      <div className="mb-8 p-4 bg-zinc-900/50 rounded-lg">
        <h2 className="text-lg font-medium mb-3 text-white">System</h2>
        <p className="text-sm text-zinc-300">
            System settings are not yet implemented. Please use the 'Themes' app to change personalization options.
        </p>
      </div>

      <div className="mb-8 p-4 bg-zinc-900/50 rounded-lg">
        <h2 className="text-lg font-medium mb-3 text-white">About</h2>
        <p className="text-sm text-zinc-300">
          Win11 React Gemini Clone v0.2.0 (Electron)
        </p>
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
