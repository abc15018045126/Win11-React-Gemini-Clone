import React, { useEffect } from 'react';
import { AppDefinition, AppComponentProps } from '../../types';
import { Browser5Icon } from '../../constants';

const Chrome5App: React.FC<AppComponentProps> = ({ setTitle }) => {
  useEffect(() => {
    setTitle('Chrome 5');
  }, [setTitle]);
  // This component will not be rendered in a window.
  // The openApp function will catch it and open a new browser tab instead.
  return (
    <div className="p-4 bg-black text-white h-full flex items-center justify-center">
      <p>This application opens in a new browser tab.</p>
    </div>
  );
};

export const appDefinition: AppDefinition = {
  id: 'chrome5',
  name: 'Chrome 5',
  icon: Browser5Icon,
  component: Chrome5App,
  isWebApp: true,
  webAppUrl: 'http://localhost:3000',
  isPinnedToTaskbar: true,
};

export default Chrome5App;
