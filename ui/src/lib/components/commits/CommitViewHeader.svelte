<script lang="ts">
  import { ChevronUp, ChevronDown, Search, Filter } from "lucide-svelte";
  import Dropdown from "../common/Dropdown.svelte";
  type CommitViewMode = "flow" | "graph";
  type CommitRange = "50" | "100" | "200" | "all";

  let {
    viewMode,
    totalCount = 0,
    branchFilters = [],
    activeBranchFilters = [],
    searchTerm = "",
    range = "100",
    laneLegend = [],
    onSetViewMode,
    onToggleBranchFilter,
    onClearBranchFilters,
    onSearchChange,
    onRangeChange,
    onExpandAll,
    onCollapseAll,
  }: {
    viewMode: CommitViewMode;
    totalCount: number;
    branchFilters: string[];
    activeBranchFilters: string[];
    searchTerm: string;
    range: CommitRange;
    laneLegend: Array<{ lane: number; label: string; color: string }>;
    onSetViewMode: (mode: CommitViewMode) => void;
    onToggleBranchFilter: (branch: string) => void;
    onClearBranchFilters: () => void;
    onSearchChange: (value: string) => void;
    onRangeChange: (value: CommitRange) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
  } = $props();

  let isBranchFilterOpen = $state(false);
  let branchFilterContainer = $state<HTMLDivElement | null>(null);

  const rangeOptions = [
    { label: "50", value: "50" },
    { label: "100", value: "100" },
    { label: "200", value: "200" },
    { label: "All", value: "all" },
  ];
  const MAX_LEGEND_ITEMS = 8;

  function isBranchActive(name: string): boolean {
    return activeBranchFilters.includes(name);
  }

  function toggleBranchFilterMenu() {
    isBranchFilterOpen = !isBranchFilterOpen;
  }

  function closeDropdowns(event: MouseEvent) {
    if (
      branchFilterContainer &&
      !branchFilterContainer.contains(event.target as Node)
    ) {
      isBranchFilterOpen = false;
    }
  }
</script>

<svelte:window onclick={closeDropdowns} />

<div class="gl-commit-head">
  <div class="gl-pane-head border-none">
    <span class="gl-text-strong font-medium">Commits</span>
    <span class="gl-text-soft text-[11px] font-mono ml-2 opacity-60"
      >{totalCount}</span
    >
  </div>

  <div class="gl-commit-controls">
    <div class="gl-view-toggle" data-testid="commit-view-toggle">
      <button
        type="button"
        class:is-active={viewMode === "flow"}
        onclick={() => onSetViewMode("flow")}
        data-testid="commit-view-flow"
      >
        Flow
      </button>
      <button
        type="button"
        class:is-active={viewMode === "graph"}
        onclick={() => onSetViewMode("graph")}
        data-testid="commit-view-graph"
      >
        Graph
      </button>
    </div>

    <div class="gl-search-box flex-1">
      <input
        class="gl-input-search"
        type="search"
        value={searchTerm}
        oninput={(event) =>
          onSearchChange((event.currentTarget as HTMLInputElement).value)}
        placeholder="Search commits..."
        data-testid="commit-search"
      />
    </div>

    <div class="gl-commit-actions">
      <Dropdown
        value={range}
        options={rangeOptions}
        onSelect={(val) => onRangeChange(val as CommitRange)}
        testId="commit-range"
      />

      <div
        class="gl-branch-filter-container"
        bind:this={branchFilterContainer}
        data-testid="commit-branch-filter"
      >
        <button
          type="button"
          class="gl-branch-filter-trigger"
          class:is-open={isBranchFilterOpen}
          onclick={toggleBranchFilterMenu}
        >
          <Filter size={11} class="opacity-40" />
          <span>Branches ({activeBranchFilters.length || "All"})</span>
          <ChevronDown
            size={11}
            class="opacity-40 ml-auto transition-transform"
            style={isBranchFilterOpen ? "transform: rotate(180deg);" : ""}
          />
        </button>

        {#if isBranchFilterOpen}
          <div class="gl-branch-popover animate-fade-in">
            <div
              class="px-3 py-2 border-b border-[var(--line-soft)] mb-1 flex justify-between items-center bg-[var(--bg-hover)]"
            >
              <span
                class="text-[11px] uppercase tracking-wider font-semibold opacity-60"
                >Filter Branches</span
              >
              <button
                type="button"
                class="text-[10px] gl-link opacity-60 hover:opacity-100"
                onclick={onClearBranchFilters}
                data-testid="commit-branch-filter-clear"
              >
                Clear
              </button>
            </div>
            <div class="max-h-[220px] overflow-y-auto p-1">
              {#each branchFilters as branchName}
                <label class="gl-branch-item">
                  <input
                    type="checkbox"
                    checked={isBranchActive(branchName)}
                    onchange={() => onToggleBranchFilter(branchName)}
                    onclick={(e) => e.stopPropagation()}
                    data-testid={`branch-filter-${branchName}`}
                  />
                  <span class="truncate">{branchName}</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if viewMode === "flow"}
        <div
          class="flex items-center gap-1 border-l border-[var(--line-soft)] pl-2"
          data-testid="flow-toolbar"
        >
          <button
            type="button"
            class="gl-icon-button p-1"
            onclick={onExpandAll}
            data-testid="flow-expand-all"
            title="Expand All"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            class="gl-icon-button p-1"
            onclick={onCollapseAll}
            data-testid="flow-collapse-all"
            title="Collapse All"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if viewMode === "graph" && laneLegend.length > 0}
  <div class="gl-graph-legend" data-testid="graph-lane-legend">
    {#each laneLegend.slice(0, MAX_LEGEND_ITEMS) as item}
      <span class="gl-graph-legend-item">
        <span class="gl-legend-dot" style={`background:${item.color};`}></span>
        <span class="gl-legend-label">{item.label}</span>
      </span>
    {/each}
    {#if laneLegend.length > MAX_LEGEND_ITEMS}
      <span class="gl-graph-legend-item is-more">
        +{laneLegend.length - MAX_LEGEND_ITEMS} more lanes
      </span>
    {/if}
  </div>
{/if}

<style>
  .gl-commit-head {
    background: var(--bg-surface);
    border-bottom: 1px solid var(--line-soft);
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .gl-commit-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px 12px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .gl-view-toggle {
    display: inline-flex;
    background: color-mix(in oklab, var(--bg-canvas), transparent 50%);
    padding: 2px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-soft);
    flex-shrink: 0;
  }

  .gl-view-toggle button {
    border: none;
    background: transparent;
    color: var(--text-soft);
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    border-radius: calc(var(--radius-sm) - 2px);
    transition: all var(--transition-fast);
  }

  .gl-view-toggle button.is-active {
    background: var(--bg-active);
    color: var(--text-strong);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .gl-search-box {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 140px;
    flex-grow: 1;
    max-width: 480px;
  }

  .gl-input-search {
    width: 100%;
    height: 30px;
    background: color-mix(in oklab, var(--bg-canvas), transparent 40%);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    padding: 0 12px;
    color: var(--text-strong);
    font-size: 11px;
    outline: none;
    transition: all var(--transition-fast);
    box-sizing: border-box;
  }

  .gl-input-search:focus {
    border-color: var(--accent);
    background: var(--bg-canvas);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--accent), transparent 85%);
  }

  .gl-commit-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .gl-branch-filter-container {
    position: relative;
    font-size: 11px;
    color: var(--text-soft);
  }

  .gl-branch-filter-trigger {
    cursor: pointer;
    background: var(--bg-surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    padding: 0 10px;
    height: 30px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    font-size: 11px;
    color: var(--text-soft);
    transition: all var(--transition-fast);
    user-select: none;
    min-width: 120px;
    box-sizing: border-box;
  }

  .gl-branch-filter-trigger:hover {
    background: var(--bg-hover);
    color: var(--text-strong);
    border-color: var(--line-medium);
  }

  .gl-branch-filter-trigger.is-open {
    border-color: var(--accent);
    color: var(--text-strong);
    background: var(--bg-surface);
  }

  .gl-branch-popover {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    width: 220px;
    background: var(--bg-panel);
    border: 1px solid var(--line-medium);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    backdrop-filter: blur(8px);
  }

  .gl-branch-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-soft);
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .gl-branch-item:hover {
    background: var(--bg-hover);
    color: var(--text-strong);
  }

  .gl-graph-legend {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 8px 16px;
    background: color-mix(in oklab, var(--bg-surface), transparent 40%);
    border-bottom: 1px solid var(--line-soft);
    overflow: hidden;
  }

  .gl-graph-legend::-webkit-scrollbar {
    display: none;
  }

  .gl-graph-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-soft);
    white-space: nowrap;
    opacity: 0.8;
    transition: opacity 0.2s;
  }

  .gl-graph-legend-item:hover {
    opacity: 1;
  }

  .gl-legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
  }

  .gl-legend-label {
    font-family: inherit;
  }

  .gl-graph-legend-item.is-more {
    padding: 1px 7px;
    border-radius: 999px;
    border: 1px dashed var(--line-medium);
    color: var(--text-muted);
    font-size: 10px;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.15s ease-out;
  }
</style>
