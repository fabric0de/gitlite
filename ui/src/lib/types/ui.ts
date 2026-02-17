export type SidebarTab = 'branches' | 'changes' | 'stash';

export type ThemeMode = 'dark' | 'light' | 'system';
export type CommitViewMode = 'flow' | 'graph';

export interface ProjectTab {
  id: string;
  path: string;
  name: string;
}

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export type ShortcutCommandId =
  | 'open_project'
  | 'close_project'
  | 'next_project'
  | 'prev_project'
  | 'open_settings'
  | 'switch_branches'
  | 'switch_changes'
  | 'switch_stash';

export type ShortcutMap = Record<ShortcutCommandId, string>;
