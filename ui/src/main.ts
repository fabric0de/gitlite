import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { uiState } from './lib/stores/ui';

if (import.meta.env.DEV) {
  const w = window as Window & {
    __GITLITE_E2E_API__?: {
      openProject: (path: string) => Promise<void>;
      getActiveProjectPath: () => string;
      getProjectPaths: () => string[];
      waitReady: () => Promise<void>;
      getProviderKind: () => 'mock' | 'tauri';
      hasRepository: () => boolean;
    };
  };
  w.__GITLITE_E2E_API__ = {
    openProject: (path: string) => uiState.openProject(path),
    getActiveProjectPath: () => uiState.activeProjectPath,
    getProjectPaths: () => uiState.projectTabs.map((tab) => tab.path),
    getProviderKind: () => uiState.providerKind,
    hasRepository: () => uiState.hasRepository,
    waitReady: async () => {
      while (!uiState.initialized || uiState.loading) {
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
    }
  };
}

const app = mount(App, {
  target: document.getElementById('app')!
});

export default app;
