
import React, { useEffect } from 'react';
import { AppDefinition, AppComponentProps } from '../../types';
import { Browser3Icon } from '../../constants';

// This component is just a placeholder. The app is launched externally.
const Chrome3App: React.FC<AppComponentProps> = ({ setTitle }) => {
  useEffect(() => {
    setTitle('Chrome 3');
  }, [setTitle]);
  return <div className="p-4">Launching Chrome 3... This app will open in a new window.</div>;
};

export const appDefinition: AppDefinition = {
  id: 'chrome3',
  name: 'Chrome 3',
  icon: Browser3Icon,
  component: Chrome3App,
  isExternal: true,
  externalPath: 'components/apps/chrome3',
  isPinnedToTaskbar: false,
};

export default Chrome3App;