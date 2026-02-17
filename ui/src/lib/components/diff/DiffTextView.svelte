<script lang="ts">
  import { ChevronsUp, ChevronsDown, ChevronDown } from "lucide-svelte";
  import type { CommitSummary, DiffFile, DiffLine } from "../../types/git";
  import { uiState } from "../../stores/ui";

  let { commit, files }: { commit: CommitSummary | null; files: DiffFile[] } =
    $props();

  function stats(lines: DiffLine[]) {
    let add = 0;
    let del = 0;
    let ctx = 0;
    for (const line of lines) {
      if (line.kind === "add") add += 1;
      else if (line.kind === "delete") del += 1;
      else ctx += 1;
    }
    return { add, del, ctx };
  }

  function marker(line: DiffLine) {
    switch (line.kind) {
      case "add":
        return "+";
      case "delete":
        return "-";
      default:
        return " ";
    }
  }

  function markerClass(line: DiffLine) {
    switch (line.kind) {
      case "add":
        return "marker-add";
      case "delete":
        return "marker-delete";
      default:
        return "marker-context";
    }
  }

  const collapsedFiles = $derived(
    uiState.getCollapsedFiles(commit?.hash ?? ""),
  );

  function isFileCollapsed(path: string) {
    return collapsedFiles.has(path);
  }

  function splitDiffLines(lines: DiffLine[]) {
    const left: DiffLine[] = [];
    const right: DiffLine[] = [];
    for (const line of lines) {
      if (line.kind === "context") {
        left.push(line);
        right.push(line);
      } else if (line.kind === "delete") {
        left.push(line);
      } else if (line.kind === "add") {
        right.push(line);
      }
    }
    return { left, right };
  }

  function formatHoverTime(date: number): string {
    const ms = date < 10000000000 ? date * 1000 : date;
    return new Date(ms).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function commitTooltip(commitValue: CommitSummary | null): string {
    if (!commitValue) return "Diff";
    return [
      commitValue.message,
      `${commitValue.hash.slice(0, 7)} • ${formatHoverTime(commitValue.date)}`,
      `Author: ${commitValue.author}`,
    ].join("\n");
  }

  // Supports up to 50 files, beyond that may experience performance issues
  // Minimum recommended viewport width for split view: 600px
</script>

<section
  class="gl-panel gl-diff"
  data-testid="diff-view"
  data-view-mode={uiState.diffViewMode}
>
  <div class="gl-diff-head">
    <div class="gl-diff-head-main">
      <div class="gl-diff-title-wrap">
        <span class="gl-diff-title truncate" title={commitTooltip(commit)}
          >{commit?.message ?? "Diff"}</span
        >
      </div>
      <span class="gl-code gl-text-soft gl-diff-hash"
        >{commit?.hash ?? "no commit selected"}</span
      >
    </div>

    {#if files.length > 0}
      <div class="gl-diff-controls">
        <div class="gl-view-mode-toggle">
          <button
            class:is-active={uiState.diffViewMode === "unified"}
            onclick={() => uiState.toggleDiffViewMode()}
            data-testid="diff-view-mode-unified"
            aria-label="View mode: unified"
          >
            Unified
          </button>
          <button
            class:is-active={uiState.diffViewMode === "split"}
            onclick={() => uiState.toggleDiffViewMode()}
            data-testid="diff-view-mode-split"
            aria-label="View mode: split"
          >
            Split
          </button>
        </div>
        <button
          class="gl-action-btn"
          data-testid="diff-collapse-all"
          onclick={() =>
            uiState.collapseAllFiles(
              commit?.hash ?? "",
              files.map((f) => f.path),
            )}
          aria-label="Collapse all files"
          title="Collapse all files"
        >
          <ChevronsUp size={14} />
        </button>
        <button
          class="gl-action-btn"
          data-testid="diff-expand-all"
          onclick={() => uiState.expandAllFiles(commit?.hash ?? "")}
          aria-label="Expand all files"
          title="Expand all files"
        >
          <ChevronsDown size={14} />
        </button>
      </div>
    {/if}
  </div>

  <div class="gl-list" data-testid="diff-file-list">
    {#if files.length === 0}
      <div class="px-3 py-2 text-xs gl-text-soft">
        No diff content for current selection.
      </div>
    {/if}

    {#each files as file}
      {@const fileStats = stats(file.lines)}
      <article
        class="gl-diff-file"
        class:is-collapsed={isFileCollapsed(file.path)}
        data-testid={`diff-file-${file.path}`}
      >
        <header class="gl-diff-file-head">
          <div
            class="collapse-icon"
            class:is-collapsed={isFileCollapsed(file.path)}
            data-testid={`diff-file-collapse-${file.path}`}
            onclick={() =>
              uiState.toggleFileCollapse(commit?.hash ?? "", file.path)}
            role="button"
            tabindex="0"
            onkeydown={(e) =>
              e.key === "Enter" &&
              uiState.toggleFileCollapse(commit?.hash ?? "", file.path)}
            aria-expanded={isFileCollapsed(file.path) ? "true" : "false"}
            aria-label="Toggle file collapse"
          >
            <ChevronDown size={12} />
          </div>
          <span class="gl-code whitespace-nowrap overflow-x-auto flex-1"
            >{file.path}</span
          >
          <span class="gl-text-soft text-[11px] whitespace-nowrap">
            <span class="text-[var(--success)]">+{fileStats.add}</span>
            <span class="text-[var(--error)]">-{fileStats.del}</span>
            · {fileStats.ctx}
          </span>
        </header>

        {#if !isFileCollapsed(file.path)}
          {#if uiState.diffViewMode === "unified"}
            <div class="gl-diff-lines-wrapper">
              {#each file.lines as line, lineIndex}
                <div
                  class="gl-diff-line"
                  class:is-add={line.kind === "add"}
                  class:is-delete={line.kind === "delete"}
                  data-testid={`diff-line-${file.path}-${lineIndex}`}
                >
                  <span class={`marker ${markerClass(line)}`}
                    >{marker(line)}</span
                  >
                  <span class="number">{line.oldNumber ?? ""}</span>
                  <span class="number">{line.newNumber ?? ""}</span>
                  <span class="gl-diff-text">{line.text}</span>
                </div>
              {/each}
            </div>
          {:else}
            {@const splitLines = splitDiffLines(file.lines)}
            <div class="gl-diff-file-content gl-split-view">
              <div class="gl-diff-split-left">
                <div class="gl-diff-lines-wrapper">
                  {#each splitLines.left as line, lineIndex}
                    <div
                      class="gl-diff-line"
                      class:is-add={line.kind === "add"}
                      class:is-delete={line.kind === "delete"}
                      data-testid={`diff-line-${file.path}-${lineIndex}`}
                    >
                      <span class={`marker ${markerClass(line)}`}
                        >{marker(line)}</span
                      >
                      <span class="number">{line.oldNumber ?? ""}</span>
                      <span class="number">{line.newNumber ?? ""}</span>
                      <span class="gl-diff-text">{line.text}</span>
                    </div>
                  {/each}
                </div>
              </div>
              <div class="gl-diff-split-right">
                <div class="gl-diff-lines-wrapper">
                  {#each splitLines.right as line, lineIndex}
                    <div
                      class="gl-diff-line"
                      class:is-add={line.kind === "add"}
                      class:is-delete={line.kind === "delete"}
                      data-testid={`diff-line-${file.path}-${lineIndex}`}
                    >
                      <span class={`marker ${markerClass(line)}`}
                        >{marker(line)}</span
                      >
                      <span class="number">{line.oldNumber ?? ""}</span>
                      <span class="number">{line.newNumber ?? ""}</span>
                      <span class="gl-diff-text">{line.text}</span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </article>
    {/each}
  </div>
</section>

<style>
  .gl-diff {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .gl-diff-head {
    height: 48px;
    padding: 0 var(--space-4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    border-bottom: 1px solid var(--line-soft);
    background: var(--bg-surface);
    flex-shrink: 0;
  }

  .gl-diff-head-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .gl-diff-title-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
  }

  .gl-diff-title {
    font-weight: 500;
    color: var(--text-strong);
    /* truncate handled by class */
  }

  .gl-diff-hash {
    font-size: 11px;
    flex-shrink: 0;
  }

  .gl-diff-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .gl-view-mode-toggle {
    display: inline-flex;
    background: color-mix(in oklab, var(--bg-canvas), transparent 50%);
    padding: 2px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-soft);
  }

  .gl-view-mode-toggle button {
    border: none;
    background: transparent;
    color: var(--text-muted);
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    border-radius: calc(var(--radius-sm) - 2px);
    transition: all var(--transition-fast);
  }

  .gl-view-mode-toggle button.is-active {
    background: var(--bg-active);
    color: var(--text-strong);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .gl-action-btn {
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .gl-action-btn:hover {
    background: var(--bg-hover);
    color: var(--text-strong);
  }

  .gl-diff-file:last-child {
    border-bottom: none;
  }

  .gl-diff-file-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: transparent; /* Flat look */
    border-top: 1px solid var(--line-soft); /* Top border instead of bottom */
    border-bottom: 1px solid transparent; /* Keep size consistent */
  }

  .gl-diff-file:first-child .gl-diff-file-head {
    border-top: none;
  }

  .gl-diff-file.is-collapsed .gl-diff-file-head {
    border-bottom: none;
  }

  .collapse-icon {
    font-size: 10px;
    color: var(--text-muted);
    cursor: pointer;
    width: 16px;
    height: 16px;
    display: grid;
    place-items: center;
    transition: transform var(--transition-fast);
  }

  .collapse-icon.is-collapsed {
    transform: rotate(-90deg);
  }

  .gl-diff-line {
    display: grid;
    /* marker, oldNum, newNum, text */
    grid-template-columns: 24px 40px 40px 1fr;
    gap: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 20px;
    min-height: 20px;
    padding: 0;
    /* Right padding for breathing room */
    padding-right: 32px;
    white-space: pre;
    color: var(--text-normal);
    width: 100%; /* Fill the wrapper */
  }

  .gl-diff-lines-wrapper {
    display: flex;
    flex-direction: column;
    width: max-content;
    min-width: 100%;
  }

  .gl-diff-line:hover {
    background: var(--bg-hover);
  }

  .gl-diff-line.is-add {
    background: color-mix(in oklab, var(--success), transparent 90%);
  }

  .gl-diff-line.is-delete {
    background: color-mix(in oklab, var(--error), transparent 90%);
  }

  .gl-diff-line .marker {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    color: var(--text-disabled);
    user-select: none;
  }

  .gl-diff-line .marker-add {
    color: var(--success);
  }

  .gl-diff-line .marker-delete {
    color: var(--error);
  }

  .gl-diff-line .number {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 8px;
    color: var(--text-disabled);
    user-select: none;
    border-right: 1px solid transparent;
  }

  /* Add border separator for better structure */
  .gl-diff-line .number:last-of-type {
    border-right-color: var(--line-soft);
  }

  .gl-diff-text {
    padding-left: 12px;
    white-space: pre;
    tab-size: 4;
    overflow-x: visible; /* Let container handle scroll if needed */
  }

  .gl-split-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    min-width: 0;
  }

  .gl-diff-split-left,
  .gl-diff-split-right {
    overflow-x: auto;
    min-width: 0;
    -webkit-overflow-scrolling: touch;
  }

  .gl-diff-split-left {
    border-right: 1px solid var(--line-soft);
  }
</style>
