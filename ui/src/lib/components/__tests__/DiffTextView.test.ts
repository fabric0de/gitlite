import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, beforeEach } from 'vitest';
import DiffTextView from '../diff/DiffTextView.svelte';
import { uiState } from '../../stores/ui';
import type { CommitSummary, DiffFile } from '../../types/git';

describe('DiffTextView', () => {
  const mockCommit: CommitSummary = {
    hash: '8c0977e',
    message: 'feat: add collapse',
    author: 'Test User',
    date: 1672531200,
    parents: []
  };

  const mockFiles: DiffFile[] = [
    {
      path: 'src/foo.ts',
      lines: [
        { kind: 'context', text: 'line 1', oldNumber: 1, newNumber: 1 },
        { kind: 'add', text: 'line 2', oldNumber: null, newNumber: 2 }
      ]
    },
    {
      path: 'src/bar.ts',
      lines: [
        { kind: 'delete', text: 'line 1', oldNumber: 1, newNumber: null }
      ]
    }
  ];

  beforeEach(() => {
    uiState.resetForTests();
  });

  it('renders file headers and content initially expanded', () => {
    render(DiffTextView, { commit: mockCommit, files: mockFiles });

    expect(screen.getByText('src/foo.ts')).toBeTruthy();
    expect(screen.getByText('src/bar.ts')).toBeTruthy();
    
    expect(screen.getByTestId('diff-line-src/foo.ts-0')).toBeTruthy();
    expect(screen.getByTestId('diff-line-src/bar.ts-0')).toBeTruthy();
  });

  it('toggles file collapse when chevron is clicked', async () => {
    render(DiffTextView, { commit: mockCommit, files: mockFiles });

    const collapseBtn = screen.getByTestId('diff-file-collapse-src/foo.ts');
    
    await fireEvent.click(collapseBtn);
    expect(uiState.getCollapsedFiles(mockCommit.hash).has('src/foo.ts')).toBe(true);
    
    expect(screen.queryByTestId('diff-line-src/foo.ts-0')).toBeNull();
    
    await fireEvent.click(collapseBtn);
    expect(uiState.getCollapsedFiles(mockCommit.hash).has('src/foo.ts')).toBe(false);
    expect(screen.getByTestId('diff-line-src/foo.ts-0')).toBeTruthy();
  });

  it('collapses all files when "Collapse All" is clicked', async () => {
    render(DiffTextView, { commit: mockCommit, files: mockFiles });

    const collapseAllBtn = screen.getByTestId('diff-collapse-all');
    await fireEvent.click(collapseAllBtn);

    expect(uiState.getCollapsedFiles(mockCommit.hash).has('src/foo.ts')).toBe(true);
    expect(uiState.getCollapsedFiles(mockCommit.hash).has('src/bar.ts')).toBe(true);
    
    expect(screen.queryByTestId('diff-line-src/foo.ts-0')).toBeNull();
    expect(screen.queryByTestId('diff-line-src/bar.ts-0')).toBeNull();
  });

  it('expands all files when "Expand All" is clicked', async () => {
    uiState.collapseAllFiles(mockCommit.hash, mockFiles.map(f => f.path));
    
    render(DiffTextView, { commit: mockCommit, files: mockFiles });
    
    expect(screen.queryByTestId('diff-line-src/foo.ts-0')).toBeNull();

    const expandAllBtn = screen.getByTestId('diff-expand-all');
    await fireEvent.click(expandAllBtn);

    expect(uiState.getCollapsedFiles(mockCommit.hash).size).toBe(0);
    expect(screen.getByTestId('diff-line-src/foo.ts-0')).toBeTruthy();
    expect(screen.getByTestId('diff-line-src/bar.ts-0')).toBeTruthy();
  });

  it('persists collapsed state across re-renders', async () => {
    uiState.toggleFileCollapse(mockCommit.hash, 'src/foo.ts');
    
    const { rerender } = render(DiffTextView, { commit: mockCommit, files: mockFiles });
    
    expect(screen.queryByTestId('diff-line-src/foo.ts-0')).toBeNull();
    expect(screen.getByTestId('diff-line-src/bar.ts-0')).toBeTruthy();
    
    rerender({ commit: mockCommit, files: mockFiles });
    
    expect(screen.queryByTestId('diff-line-src/foo.ts-0')).toBeNull();
  });

  it('renders view mode toggle buttons', () => {
    render(DiffTextView, { commit: mockCommit, files: mockFiles });
    expect(screen.getByTestId('diff-view-mode-unified')).toBeTruthy();
    expect(screen.getByTestId('diff-view-mode-split')).toBeTruthy();
  });

  it('toggles view mode when buttons are clicked', async () => {
    render(DiffTextView, { commit: mockCommit, files: mockFiles });
    
    const splitBtn = screen.getByTestId('diff-view-mode-split');
    await fireEvent.click(splitBtn);
    expect(uiState.diffViewMode).toBe('split');
    
    const unifiedBtn = screen.getByTestId('diff-view-mode-unified');
    await fireEvent.click(unifiedBtn);
    expect(uiState.diffViewMode).toBe('unified');
  });

  it('renders split view layout when in split mode', async () => {
    // Set split mode directly
    uiState.diffViewMode = 'split';
    render(DiffTextView, { commit: mockCommit, files: mockFiles });

    // In split view, context lines (src/foo.ts line 0) should be rendered twice (left and right)
    // We use getAllByTestId to verify this duplication
    const fooLine0 = screen.getAllByTestId('diff-line-src/foo.ts-0');
    expect(fooLine0.length).toBe(2);
    
    // Additions (src/foo.ts line 1) should be rendered once (right only)
    const fooLine1 = screen.getAllByTestId('diff-line-src/foo.ts-1');
    expect(fooLine1.length).toBe(1);
    
    // Deletions (src/bar.ts line 0) should be rendered once (left only)
    const barLine0 = screen.getAllByTestId('diff-line-src/bar.ts-0');
    expect(barLine0.length).toBe(1);
  });

  it('renders unified view layout when in unified mode', async () => {
    uiState.diffViewMode = 'unified';
    render(DiffTextView, { commit: mockCommit, files: mockFiles });

    // In unified view, context lines should be rendered once
    const fooLine0 = screen.getAllByTestId('diff-line-src/foo.ts-0');
    expect(fooLine0.length).toBe(1);
  });

  it('persists view mode selection', async () => {
    render(DiffTextView, { commit: mockCommit, files: mockFiles });
    
    const splitBtn = screen.getByTestId('diff-view-mode-split');
    await fireEvent.click(splitBtn);
    
    expect(window.localStorage.getItem('gitlite.diffViewMode')).toBe('split');
  });

  it('hides collapse/expand controls when files array is empty', () => {
    render(DiffTextView, { commit: mockCommit, files: [] });
    
    expect(screen.queryByTestId('diff-collapse-all')).toBeNull();
    expect(screen.queryByTestId('diff-expand-all')).toBeNull();
    expect(screen.queryByTestId('diff-view-mode-unified')).toBeNull();
    expect(screen.queryByTestId('diff-view-mode-split')).toBeNull();
  });

  it('collapse all works correctly with single file', async () => {
    const singleFile: DiffFile[] = [mockFiles[0]];
    render(DiffTextView, { commit: mockCommit, files: singleFile });
    
    const collapseAllBtn = screen.getByTestId('diff-collapse-all');
    await fireEvent.click(collapseAllBtn);
    
    expect(uiState.getCollapsedFiles(mockCommit.hash).has(singleFile[0].path)).toBe(true);
    expect(screen.queryByTestId(`diff-line-${singleFile[0].path}-0`)).toBeNull();
  });

  it('falls back to unified mode on corrupted localStorage', () => {
    // Simulate corrupted localStorage value
    window.localStorage.setItem('gitlite.diffViewMode', 'invalid-mode');
    
    // Force a read by clearing the state
    uiState.resetForTests();
    
    render(DiffTextView, { commit: mockCommit, files: mockFiles });
    
    // Should render in unified mode (default) since 'invalid-mode' is not valid
    const fooLine0 = screen.getAllByTestId('diff-line-src/foo.ts-0');
    expect(fooLine0.length).toBe(1);
  });

  it('has aria-expanded attribute on file collapse chevrons', () => {
    render(DiffTextView, { commit: mockCommit, files: mockFiles });
    
    const chevron = screen.getByTestId('diff-file-collapse-src/foo.ts');
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    
    fireEvent.click(chevron);
    expect(chevron.getAttribute('aria-expanded')).toBe('true');
  });

  it('has aria-label attributes on interactive elements', () => {
    render(DiffTextView, { commit: mockCommit, files: mockFiles });
    
    const chevron = screen.getByTestId('diff-file-collapse-src/foo.ts');
    expect(chevron.getAttribute('aria-label')).toBe('Toggle file collapse');
    
    const collapseAllBtn = screen.getByTestId('diff-collapse-all');
    expect(collapseAllBtn.getAttribute('aria-label')).toBe('Collapse all files');
    
    const expandAllBtn = screen.getByTestId('diff-expand-all');
    expect(expandAllBtn.getAttribute('aria-label')).toBe('Expand all files');
    
    const unifiedBtn = screen.getByTestId('diff-view-mode-unified');
    expect(unifiedBtn.getAttribute('aria-label')).toMatch(/^View mode: unified/);
    
    const splitBtn = screen.getByTestId('diff-view-mode-split');
    expect(splitBtn.getAttribute('aria-label')).toMatch(/^View mode: split/);
  });

  it('renders a large diff set without crashing', () => {
    const largeFiles: DiffFile[] = [
      {
        path: 'src/large-a.ts',
        lines: Array.from({ length: 2000 }, (_, index) => ({
          kind: index % 5 === 0 ? 'add' : index % 7 === 0 ? 'delete' : 'context',
          text: `line-${index}`,
          oldNumber: index + 1,
          newNumber: index + 1
        }))
      },
      {
        path: 'src/large-b.ts',
        lines: Array.from({ length: 1500 }, (_, index) => ({
          kind: index % 4 === 0 ? 'add' : 'context',
          text: `content-${index}`,
          oldNumber: index + 1,
          newNumber: index + 1
        }))
      }
    ];

    render(DiffTextView, { commit: mockCommit, files: largeFiles });

    expect(screen.getByTestId('diff-file-src/large-a.ts')).toBeTruthy();
    expect(screen.getByTestId('diff-file-src/large-b.ts')).toBeTruthy();
    expect(screen.getByTestId('diff-line-src/large-a.ts-0')).toBeTruthy();
    expect(screen.getByTestId('diff-line-src/large-a.ts-1999')).toBeTruthy();
    expect(screen.getByTestId('diff-line-src/large-b.ts-1499')).toBeTruthy();
  });
});
