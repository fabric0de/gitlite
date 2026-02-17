import { describe, it, expect, beforeEach } from 'vitest'
import { uiState } from '../ui.svelte'

describe('UIStore - Diff View', () => {
  beforeEach(() => {
    uiState.resetForTests()
  })

  it('should toggle diff view mode between unified and split', () => {
    expect(uiState.diffViewMode).toBe('unified')
    uiState.toggleDiffViewMode()
    expect(uiState.diffViewMode).toBe('split')
    uiState.toggleDiffViewMode()
    expect(uiState.diffViewMode).toBe('unified')
  })

  it('should persist diff view mode to localStorage', () => {
    uiState.toggleDiffViewMode()
    const stored = window.localStorage.getItem('gitlite.diffViewMode')
    expect(stored).toBe('split')

    uiState.toggleDiffViewMode()
    const updated = window.localStorage.getItem('gitlite.diffViewMode')
    expect(updated).toBe('unified')
  })

  it('should toggle file collapse state in Set', () => {
    const commitHash = 'abc123'
    const filePath = 'src/index.ts'

    // File should not be collapsed initially
    expect(uiState.getCollapsedFiles(commitHash).has(filePath)).toBe(false)

    // Toggle to collapse
    uiState.toggleFileCollapse(commitHash, filePath)
    expect(uiState.getCollapsedFiles(commitHash).has(filePath)).toBe(true)

    // Toggle to expand
    uiState.toggleFileCollapse(commitHash, filePath)
    expect(uiState.getCollapsedFiles(commitHash).has(filePath)).toBe(false)
  })

  it('should collapse all files for a commit', () => {
    const commitHash = 'abc123'
    const filePaths = ['src/index.ts', 'src/utils.ts', 'package.json']

    uiState.collapseAllFiles(commitHash, filePaths)
    const collapsed = uiState.getCollapsedFiles(commitHash)

    expect(collapsed.has('src/index.ts')).toBe(true)
    expect(collapsed.has('src/utils.ts')).toBe(true)
    expect(collapsed.has('package.json')).toBe(true)
    expect(collapsed.size).toBe(3)
  })

  it('should expand all files for a commit', () => {
    const commitHash = 'abc123'
    const filePaths = ['src/index.ts', 'src/utils.ts', 'package.json']

    // Collapse all first
    uiState.collapseAllFiles(commitHash, filePaths)
    expect(uiState.getCollapsedFiles(commitHash).size).toBe(3)

    // Expand all
    uiState.expandAllFiles(commitHash)
    expect(uiState.getCollapsedFiles(commitHash).size).toBe(0)
  })

  it('should read view mode from localStorage with fallback', () => {
    // Test with no localStorage entry
    window.localStorage.removeItem('gitlite.diffViewMode')
    expect(uiState.getStoredDiffViewMode()).toBe('unified')

    // Test with valid stored value
    window.localStorage.setItem('gitlite.diffViewMode', 'split')
    expect(uiState.getStoredDiffViewMode()).toBe('split')
  })

  it('should reset diff state and localStorage on resetForTests()', () => {
    // Set up state
    uiState.toggleDiffViewMode()
    uiState.collapseAllFiles('commit1', ['file1.ts', 'file2.ts'])
    uiState.collapseAllFiles('commit2', ['file3.ts'])

    // Verify state is set
    expect(uiState.diffViewMode).toBe('split')
    expect(uiState.getCollapsedFiles('commit1').size).toBe(2)
    expect(uiState.getCollapsedFiles('commit2').size).toBe(1)
    expect(window.localStorage.getItem('gitlite.diffViewMode')).toBe('split')

    // Reset
    uiState.resetForTests()

    // Verify state is cleared
    expect(uiState.diffViewMode).toBe('unified')
    expect(uiState.getCollapsedFiles('commit1').size).toBe(0)
    expect(uiState.getCollapsedFiles('commit2').size).toBe(0)
    expect(window.localStorage.getItem('gitlite.diffViewMode')).toBe(null)
  })
})
