
import type { AppDefinition } from '../../types';

import { appDefinition as aboutAppDefinition } from './AboutApp';
import { appDefinition as fileExplorerAppDefinition } from './FileExplorerApp';
import { appDefinition as geminiChatAppDefinition } from './GeminiChatApp';
import { appDefinition as hyperAppDefinition } from './HyperApp';
import { appDefinition as notebookAppDefinition } from './NotebookApp';
import { appDefinition as settingsAppDefinition } from './SettingsApp';
import { appDefinition as chromeAppDefinition } from './ChromeApp';

/**
 * The master list of all applications available in the OS.
 * To add a new app:
 * 1. Create your app component in a new file under this `apps` directory.
 * 2. In that file, export an `appDefinition` object of type `AppDefinition`.
 * 3. Import that definition here and add it to this array.
 */
export const APP_DEFINITIONS: AppDefinition[] = [
  chromeAppDefinition,
  fileExplorerAppDefinition,
  geminiChatAppDefinition,
  hyperAppDefinition,
  settingsAppDefinition,
  notebookAppDefinition,
  aboutAppDefinition,
];