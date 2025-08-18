import type { AppDefinition } from '../../types';

import { appDefinition as aboutAppDefinition } from './About';
import { appDefinition as fileExplorerAppDefinition } from './FileExplorer';
import { appDefinition as geminiChatAppDefinition } from './GeminiChat';
import { appDefinition as hyperAppDefinition } from './Hyper';
import { appDefinition as notebookAppDefinition } from './Notebook';
import { appDefinition as settingsAppDefinition } from './Settings';
import { appDefinition as chromeAppDefinition } from './Chrome';
import { appDefinition as chrome2AppDefinition } from './Chrome2';
import { appDefinition as terminusAppDefinition } from './Terminus';
import { appDefinition as sftpAppDefinition } from './SFTP';
import { appDefinition as appStoreAppDefinition } from './AppStore';
import { appDefinition as themeAppDefinition } from './ThemeApp';

/**
 * The master list of all applications available in the OS.
 * To add a new app:
 * 1. Create your app component in a new file under this `apps` directory.
 * 2. In that file, export an `appDefinition` object of type `AppDefinition`.
 * 3. Import that definition here and add it to this array.
 */
export const APP_DEFINITIONS: AppDefinition[] = [
  appStoreAppDefinition,
  themeAppDefinition,
  sftpAppDefinition,
  terminusAppDefinition,
  chromeAppDefinition,
  chrome2AppDefinition,
  fileExplorerAppDefinition,
  geminiChatAppDefinition,
  hyperAppDefinition,
  settingsAppDefinition,
  notebookAppDefinition,
  aboutAppDefinition,
];