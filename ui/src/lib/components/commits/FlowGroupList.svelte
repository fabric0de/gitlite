<script lang="ts">
  import { ChevronDown, ChevronRight, ExternalLink } from "lucide-svelte";
  import type { CommitSummary } from "../../types/git";
  import type { FlowGroup } from "./graphEngine";

  let {
    groups = [],
    selectedHash = "",
    collapsedGroupIds = new Set<string>(),
    laneColor,
    formatTime,
    shortHash,
    onToggleGroup,
    onSelect,
    onContextMenu,
  }: {
    groups: FlowGroup[];
    selectedHash: string;
    collapsedGroupIds: Set<string>;
    laneColor: (lane: number) => string;
    formatTime: (value: number) => string;
    shortHash: (value: string) => string;
    onToggleGroup: (id: string) => void;
    onSelect: (hash: string) => void;
    onContextMenu: (event: MouseEvent, hash: string) => void;
  } = $props();

  function latestCommit(group: FlowGroup): CommitSummary {
    return group.commits[0];
  }

  function flowTimeRange(group: FlowGroup): string {
    const start = formatTime(group.startedAt);
    const end = formatTime(group.endedAt);
    return group.startedAt === group.endedAt ? start : `${start} - ${end}`;
  }

  function commitTooltip(commit: CommitSummary): string {
    return [
      commit.message,
      `${shortHash(commit.hash)} • ${formatTime(commit.date)}`,
      `Author: ${commit.author}`,
    ].join("\n");
  }
</script>

<div class="gl-commit-flow-list" data-testid="commit-flow-list">
  {#each groups as group}
    {@const isCollapsed = collapsedGroupIds.has(group.id)}
    <section
      class="gl-flow-group"
      class:is-collapsed={isCollapsed}
      style={`--flow-color:${laneColor(group.lane)};`}
      data-testid={`flow-group-${group.id}`}
    >
      <header class="gl-flow-head">
        <button
          type="button"
          class="gl-flow-toggle"
          onclick={() => onToggleGroup(group.id)}
          aria-label={isCollapsed ? "Expand flow group" : "Collapse flow group"}
          data-testid={`flow-toggle-${group.id}`}
        >
          {#if isCollapsed}
            <ChevronRight size={14} />
          {:else}
            <ChevronDown size={14} />
          {/if}
        </button>
        <div class="gl-flow-title-row">
          <span class="gl-flow-branch">{group.branchLabel}</span>
          <span class="gl-flow-count"
            >{group.commits.length} commit{group.commits.length > 1
              ? "s"
              : ""}</span
          >
        </div>
        <div class="gl-flow-head-right">
          <span class="gl-text-soft gl-flow-time">{flowTimeRange(group)}</span>
          <button
            type="button"
            class="gl-flow-open-latest"
            onclick={() => onSelect(latestCommit(group).hash)}
            data-testid={`flow-open-latest-${group.id}`}
            title="Jump to latest commit"
          >
            <ExternalLink size={12} />
          </button>
        </div>
      </header>

      {#if isCollapsed}
        <button
          type="button"
          class="gl-flow-collapsed-summary"
          onclick={() => onToggleGroup(group.id)}
          data-testid={`flow-collapsed-${group.id}`}
          aria-label="Expand flow group"
        >
          <div
            class="gl-flow-preview-message truncate"
            title={commitTooltip(latestCommit(group))}
          >
            {latestCommit(group).message}
          </div>
          <div class="gl-flow-preview-meta">
            <span class="gl-soft">{latestCommit(group).author}</span>
            <span class="opacity-30">&bull;</span>
            <span class="gl-soft">{formatTime(latestCommit(group).date)}</span>
          </div>
        </button>
      {:else}
        {#if group.relations.length > 0}
          <div class="gl-flow-relations">
            {#each group.relations as relation}
              <span class="gl-flow-relation"
                >{relation.label}
                <span class="opacity-50">x{relation.count}</span></span
              >
            {/each}
          </div>
        {/if}

        <div class="gl-flow-commits">
          {#each group.commits as commit, index}
            <button
              type="button"
              class="gl-list-row gl-commit-row gl-commit-row-flow"
              class:is-active={selectedHash === commit.hash}
              onclick={() => onSelect(commit.hash)}
              oncontextmenu={(event) => onContextMenu(event, commit.hash)}
              data-testid={`commit-row-${commit.hash}`}
            >
              <span class="gl-commit-hash gl-code gl-soft" title={commit.hash}
                >{shortHash(commit.hash)}</span
              >
              <div class="gl-commit-main">
                <div class="gl-commit-msg-line">
                  <span class="gl-commit-message truncate" title={commitTooltip(commit)}
                    >{commit.message}</span
                  >
                </div>
                <div class="gl-commit-meta">
                  <span class="gl-commit-author gl-soft">{commit.author}</span>
                  <span class="gl-dot-sep">&bull;</span>
                  <span class="gl-commit-date gl-soft"
                    >{formatTime(commit.date)}</span
                  >
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  {/each}
</div>

<style>
  .gl-commit-flow-list {
    container-type: inline-size;
  }

  .gl-flow-group {
    border-bottom: 1px solid var(--line-soft);
    background: var(--bg-canvas);
  }

  .gl-flow-head {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    padding: 10px 12px;
    gap: 12px;
    background: color-mix(in oklab, var(--bg-surface), transparent 30%);
    border-bottom: 1px solid var(--line-soft);
  }

  .gl-flow-toggle {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-soft);
    cursor: pointer;
    padding: 0;
    transition: all var(--transition-fast);
  }

  .gl-flow-toggle:hover {
    background: var(--bg-hover);
    color: var(--text-strong);
    border-color: var(--line-medium);
  }

  .gl-flow-title-row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .gl-flow-branch {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-strong);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: color-mix(in oklab, var(--flow-color), transparent 85%);
    border: 1px solid color-mix(in oklab, var(--flow-color), transparent 60%);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .gl-flow-count {
    font-size: 11px;
    color: var(--text-soft);
    font-weight: 500;
  }

  .gl-flow-head-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .gl-flow-time {
    font-size: 11px;
    opacity: 0.7;
  }

  .gl-flow-open-latest {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-soft);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .gl-flow-open-latest:hover {
    background: var(--bg-hover);
    color: var(--accent);
    border-color: var(--accent);
  }

  .gl-flow-collapsed-summary {
    width: 100%;
    border: none;
    padding: 10px 12px 10px 44px;
    background: color-mix(in oklab, var(--bg-surface), transparent 60%);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
  }

  .gl-flow-collapsed-summary:hover {
    background: var(--bg-hover);
  }

  .gl-flow-preview-message {
    font-size: 13px;
    color: var(--text-soft);
    font-weight: 450;
  }

  .gl-flow-preview-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    opacity: 0.6;
  }

  .gl-flow-relations {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px 6px 44px;
    flex-wrap: wrap;
    background: color-mix(in oklab, var(--bg-canvas), transparent 20%);
    border-bottom: 1px dashed var(--line-soft);
  }

  .gl-flow-relation {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 8px;
    border: 1px solid var(--line-soft);
    border-radius: 999px;
    color: var(--text-soft);
    background: var(--bg-surface);
  }

  .gl-flow-commits {
    display: flex;
    flex-direction: column;
  }

  .gl-list-row {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--line-soft);
    cursor: pointer;
    font-size: 13px;
    padding: 8px 16px 8px 12px;
    gap: 12px;
    position: relative;
    transition: background-color var(--transition-fast);
  }

  .gl-commit-row-flow {
    border-left: 3px solid
      color-mix(in oklab, var(--flow-color), transparent 60%);
    padding-left: 16px;
  }

  .gl-commit-row-flow:hover {
    background: var(--bg-hover);
  }

  .gl-commit-row-flow.is-active {
    background: var(--bg-active);
    border-left-color: var(--flow-color);
  }

  .gl-commit-hash {
    font-size: 11px;
    min-width: 58px;
    opacity: 0.6;
    letter-spacing: 0.02em;
    font-family: var(--font-mono);
  }

  .gl-commit-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .gl-commit-msg-line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .gl-commit-message {
    color: var(--text-strong);
    font-weight: 500;
    font-size: 13px;
  }

  .gl-dot-sep {
    opacity: 0.3;
  }

  .gl-commit-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    opacity: 0.7;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .gl-commit-author {
    font-weight: 450;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gl-commit-date {
    font-size: 11px;
    white-space: nowrap;
  }

  @container (max-width: 760px) {
    .gl-flow-head {
      gap: 8px;
      padding: 8px 10px;
    }

    .gl-flow-branch {
      max-width: 140px;
    }

    .gl-flow-time {
      display: none;
    }
  }

  @container (max-width: 620px) {
    .gl-flow-count {
      display: none;
    }

    .gl-list-row {
      gap: 8px;
      padding: 8px 10px;
    }

    .gl-commit-hash {
      min-width: 46px;
      font-size: 10px;
    }
  }

  @container (max-width: 560px) {
    .gl-dot-sep,
    .gl-commit-date {
      display: none;
    }

    .gl-commit-message {
      font-size: 12px;
    }
  }
</style>
