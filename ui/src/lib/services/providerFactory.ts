import type { GitDataProvider } from './gitDataProvider';
import { mockGitProvider } from './mockGitProvider';
import { isTauriRuntime } from './tauriBridge';
import { TauriGitProvider } from './tauriGitProvider';

export function createGitProvider(): GitDataProvider {
  if (isTauriRuntime()) {
    return new TauriGitProvider();
  }
  return mockGitProvider;
}
