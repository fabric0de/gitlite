<script lang="ts">
  import { tick } from "svelte";
  import type { BranchInfo, CommitSummary } from "../../types/git";
  import CommitViewHeader from "./CommitViewHeader.svelte";
  import FlowGroupList from "./FlowGroupList.svelte";
  import GraphList from "./GraphList.svelte";
  import {
    buildFlowBranchLabelMap,
    buildFlowGroups,
    buildGraph,
    buildLaneByHashMap,
    LANE_PADDING,
    LANE_WIDTH,
    ROW_HEIGHT,
    type FlowGroup,
    type GraphEdge,
    type GraphLayout,
  } from "./graphEngine";

  let {
    commits,
    branches,
    selectedHash,
    branchFilters,
    activeBranchFilter,
    onChangeBranchFilter,
    onSelect,
    onCherryPick,
    onReset,
    onCreateBranch,
    onCheckoutCommit,
    onRevert,
    viewMode,
    onSetViewMode,
  }: {
    commits: CommitSummary[];
    branches: BranchInfo[];
    selectedHash: string;
    branchFilters: string[];
    activeBranchFilter: string;
    onChangeBranchFilter: (filter: string) => Promise<void>;
    onSelect: (hash: string) => void;
    onCherryPick: (hash: string) => Promise<void>;
    onReset: (hash: string, mode: "soft" | "mixed" | "hard") => Promise<void>;
    onCreateBranch: (hash: string, name: string) => Promise<void>;
    onCheckoutCommit: (hash: string) => Promise<void>;
    onRevert: (hash: string) => Promise<void>;
    viewMode: CommitViewMode;
    onSetViewMode: (mode: CommitViewMode) => void;
  } = $props();

  const NODE_RADIUS = 4;
  const EDGE_NODE_OFFSET = NODE_RADIUS - 0.2;
  type CommitViewMode = "flow" | "graph";
  type CommitRange = "50" | "100" | "200" | "all";

  let searchTerm = $state("");
  let range = $state<CommitRange>("100");
  let selectedBranchFilters = $state<string[]>([]);
  let collapsedFlowGroups = $state(new Set<string>());
  let menu = $state<{
    hash: string;
    x: number;
    y: number;
  } | null>(null);
  let isClearing = $state(false);

  $effect(() => {
    const validFilters = new Set(branchFilters);
    const normalized = selectedBranchFilters.filter((name) =>
      validFilters.has(name),
    );

    if (normalized.length !== selectedBranchFilters.length) {
      selectedBranchFilters = normalized;
    }

    if (
      !isClearing &&
      activeBranchFilter !== "all" &&
      selectedBranchFilters.length === 0 &&
      validFilters.has(activeBranchFilter)
    ) {
      selectedBranchFilters = [activeBranchFilter];
    }
  });

  const branchLabelByHash = $derived(
    buildFlowBranchLabelMap(commits, branches),
  );
  const filteredCommits = $derived(
    applyFilters(commits, selectedBranchFilters, searchTerm, range),
  );
  const graph = $derived(buildGraph(filteredCommits));
  const flowGroups = $derived(
    buildFlowGroups({
      commits: filteredCommits,
      laneByHash: buildLaneByHashMap(filteredCommits, graph),
      resolveBranchLabel: branchLabelOfCommit,
    }),
  );
  const laneLegend = $derived(buildLaneLegend(filteredCommits, graph));

  function normalizeBranchName(name: string, isRemote = false): string {
    if (isRemote) return name.replace(/^origin\//, "");
    return name;
  }

  function laneColor(lane: number): string {
    const palette = [
      "var(--lane-1)",
      "var(--lane-2)",
      "var(--lane-3)",
      "var(--lane-4)",
      "var(--lane-5)",
      "var(--lane-6)",
    ];
    return palette[lane % palette.length];
  }

  function lanePaint(lane: number): string {
    return lane === 0 ? "var(--line-strong)" : laneColor(lane);
  }

  function edgeColor(edge: GraphEdge): string {
    if (edge.fromLane === edge.toLane) {
      return lanePaint(edge.fromLane);
    }
    if (edge.fromLane === 0) {
      return `color-mix(in oklab, ${lanePaint(edge.toLane)} 68%, var(--line-soft) 32%)`;
    }
    if (edge.toLane === 0) {
      return `color-mix(in oklab, ${lanePaint(edge.fromLane)} 68%, var(--line-soft) 32%)`;
    }
    return `color-mix(in oklab, ${lanePaint(edge.fromLane)} 56%, ${lanePaint(edge.toLane)} 44%)`;
  }

  function laneX(lane: number, layout: GraphLayout = graph): number {
    return LANE_PADDING + lane * layout.laneStep + Math.floor(LANE_WIDTH / 2);
  }

  function rowY(row: number): number {
    return row * ROW_HEIGHT + Math.floor(ROW_HEIGHT / 2);
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function edgePath(edge: GraphEdge, layout: GraphLayout = graph): string {
    const x1 = laneX(edge.fromLane, layout);
    const x2 = laneX(edge.toLane, layout);
    const yStart = rowY(edge.fromRow) + EDGE_NODE_OFFSET;
    const yBottom = rowY(edge.toRow) - EDGE_NODE_OFFSET;

    if (yBottom <= yStart) {
      return `M ${x1} ${rowY(edge.fromRow)} L ${x2} ${rowY(edge.toRow)}`;
    }

    if (edge.fromLane === edge.toLane) {
      return `M ${x1} ${yStart} L ${x2} ${yBottom}`;
    }

    const dx = x2 - x1;
    const dir = Math.sign(dx) || 1;
    const horizontal = Math.abs(dx);
    const vertical = yBottom - yStart;
    const startX = x1 + dir * NODE_RADIUS * 0.56;
    const startY = yStart + 0.25;

    if (vertical <= ROW_HEIGHT * 0.82) {
      const c1x = startX + dir * Math.max(2, horizontal * 0.5);
      const c1y = yStart + Math.max(2, ROW_HEIGHT * 0.15);
      const c2x = x2 - dir * Math.max(2, horizontal * 0.35);
      const c2y = yBottom - Math.max(2, ROW_HEIGHT * 0.2);
      return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${yBottom}`;
    }

    const bendY = clamp(
      yStart + vertical * 0.75,
      yStart + ROW_HEIGHT * 0.3,
      yBottom - 4,
    );
    const c1x = startX + dir * Math.max(3, horizontal * 0.5);
    const c1y = yStart + Math.max(2, ROW_HEIGHT * 0.1);
    const c2x = x2 - dir * Math.max(3, horizontal * 0.3);
    const c2y = bendY - Math.max(3, ROW_HEIGHT * 0.15);
    return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${bendY} L ${x2} ${yBottom}`;
  }

  function formatTime(date: number): string {
    // Git timestamps are commonly seconds; normalize to milliseconds for Date APIs.
    const ms = date < 10000000000 ? date * 1000 : date;
    const d = new Date(ms);

    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function shortHash(hash: string): string {
    return hash.slice(0, 7);
  }

  function commitHashMatches(
    targetHash: string | null | undefined,
    commitHash: string,
  ): boolean {
    if (!targetHash) return false;
    return (
      targetHash === commitHash ||
      targetHash.startsWith(commitHash) ||
      commitHash.startsWith(targetHash)
    );
  }

  function refsForCommit(commitHash: string): BranchInfo[] {
    return branches.filter((branch) =>
      commitHashMatches(branch.targetHash, commitHash),
    );
  }

  function branchLabelOfCommit(commit: CommitSummary): string {
    const inferred = branchLabelByHash.get(commit.hash);
    if (inferred) return inferred;

    const refs = refsForCommit(commit.hash);
    if (refs[0]) return normalizeBranchName(refs[0].name, refs[0].isRemote);

    if (selectedBranchFilters.length === 1) return selectedBranchFilters[0];
    return "detached";
  }

  function buildLaneLegend(
    items: CommitSummary[],
    layout: GraphLayout,
  ): Array<{ lane: number; label: string; color: string }> {
    const legendMap = new Map<number, string>();

    // Scan backwards to favor labels closer to the tips (more likely to be specific branch names)
    for (let row = items.length - 1; row >= 0; row--) {
      const lane = layout.laneByRow[row] ?? 0;
      if (legendMap.has(lane)) continue;

      const commit = items[row];
      const inferred = branchLabelByHash.get(commit.hash);

      if (inferred && inferred !== "detached") {
        legendMap.set(lane, inferred);
        continue;
      }

      const refs = refsForCommit(commit.hash);
      const preferredRef =
        refs.find((ref) => ref.isCurrent) ??
        refs.find((ref) => !ref.isRemote) ??
        refs[0];

      if (preferredRef) {
        legendMap.set(
          lane,
          normalizeBranchName(preferredRef.name, preferredRef.isRemote),
        );
      }
    }

    // Secondary pass for any missing lanes
    items.forEach((commit, row) => {
      const lane = layout.laneByRow[row] ?? 0;
      if (legendMap.has(lane)) return;

      legendMap.set(lane, lane === 0 ? "mainline" : `branch-${lane}`);
    });

    return [...legendMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([lane, label]) => ({ lane, label, color: laneColor(lane) }));
  }

  function applyFilters(
    items: CommitSummary[],
    filters: string[],
    search: string,
    limitRange: CommitRange,
  ): CommitSummary[] {
    const selected = new Set(filters);
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = items.filter((commit) => {
      const ms =
        !normalizedSearch ||
        commit.hash.toLowerCase().includes(normalizedSearch) ||
        commit.message.toLowerCase().includes(normalizedSearch) ||
        commit.author.toLowerCase().includes(normalizedSearch);

      let mb = selected.size === 0;
      if (!mb) {
        const refs = refsForCommit(commit.hash);
        for (const ref of refs) {
          if (selected.has(normalizeBranchName(ref.name, ref.isRemote))) {
            mb = true;
            break;
          }
        }
        if (!mb) {
          const inferred = branchLabelByHash.get(commit.hash);
          if (inferred && selected.has(inferred)) mb = true;
        }
      }
      return ms && mb;
    });

    if (limitRange === "all") return filtered;
    const limit = Number.parseInt(limitRange, 10);
    if (!Number.isFinite(limit) || limit <= 0) return filtered;
    return filtered.slice(0, limit);
  }

  function toggleBranchFilter(branch: string) {
    const next = new Set(selectedBranchFilters);
    if (next.has(branch)) {
      next.delete(branch);
    } else {
      next.add(branch);
    }
    selectedBranchFilters = [...next];
  }

  async function clearBranchFilters() {
    isClearing = true;
    selectedBranchFilters = [];
    try {
      await onChangeBranchFilter("all");
      await tick();
      selectedBranchFilters = [];
    } finally {
      isClearing = false;
    }
  }

  function toggleFlowGroup(id: string) {
    const next = new Set(collapsedFlowGroups);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    collapsedFlowGroups = next;
  }

  function openContextMenu(event: MouseEvent, hash: string) {
    event.preventDefault();
    const menuWidth = 236;
    const menuHeight = 220;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const x = Math.max(
      8,
      Math.min(event.clientX, viewportWidth - menuWidth - 8),
    );
    const y = Math.max(
      8,
      Math.min(event.clientY, viewportHeight - menuHeight - 8),
    );
    menu = { hash, x, y };
  }

  function closeContextMenu() {
    menu = null;
  }

  function setRange(next: CommitRange) {
    range = next;
  }

  function setViewMode(mode: CommitViewMode) {
    viewMode = mode;
  }

  function expandAllFlowGroups() {
    collapsedFlowGroups = new Set();
  }

  function collapseAllFlowGroups() {
    collapsedFlowGroups = new Set(flowGroups.map((g) => g.id));
  }

  async function runCherryPick() {
    if (!menu) return;
    const hash = menu.hash;
    menu = null;
    await onCherryPick(hash);
  }

  async function runReset(mode: "soft" | "mixed" | "hard") {
    if (!menu) return;
    const hash = menu.hash;
    const confirmed = window.confirm(
      `Reset current branch (${mode}) to ${shortHash(hash)}?\nThis rewrites local history.`,
    );
    if (!confirmed) return;
    menu = null;
    await onReset(hash, mode);
  }

  async function runCreateBranchFromCommit() {
    if (!menu) return;
    const hash = menu.hash;
    const branchName = window
      .prompt("New branch name", `feature/from-${shortHash(hash)}`)
      ?.trim();
    if (!branchName) return;
    menu = null;
    await onCreateBranch(hash, branchName);
  }

  async function runCheckoutCommit() {
    if (!menu) return;
    const hash = menu.hash;
    const confirmed = window.confirm(
      `Checkout commit ${shortHash(hash)} in detached HEAD mode?`,
    );
    if (!confirmed) return;
    menu = null;
    await onCheckoutCommit(hash);
  }

  async function runRevertCommit() {
    if (!menu) return;
    const hash = menu.hash;
    const confirmed = window.confirm(
      `Revert commit ${shortHash(hash)} on current branch?`,
    );
    if (!confirmed) return;
    menu = null;
    await onRevert(hash);
  }
</script>

<svelte:window
  onclick={closeContextMenu}
  onkeydown={(event) => {
    if (event.key === "Escape") closeContextMenu();
  }}
/>

<section class="gl-panel gl-commit" data-testid="commit-table">
  <CommitViewHeader
    {viewMode}
    totalCount={filteredCommits.length}
    {branchFilters}
    activeBranchFilters={selectedBranchFilters}
    {searchTerm}
    {range}
    {laneLegend}
    onSetViewMode={setViewMode}
    onToggleBranchFilter={toggleBranchFilter}
    onClearBranchFilters={clearBranchFilters}
    onSearchChange={(value) => (searchTerm = value)}
    onRangeChange={setRange}
    onExpandAll={expandAllFlowGroups}
    onCollapseAll={collapseAllFlowGroups}
  />

  <div class="gl-list gl-commit-list-wrap" data-testid="commit-list">
    {#if filteredCommits.length === 0}
      <div
        class="px-4 py-3 text-sm gl-soft"
        data-testid="commit-empty-filtered"
      >
        No commits match the current filters.
      </div>
    {:else if viewMode === "graph"}
      <GraphList
        commits={filteredCommits}
        {graph}
        {selectedHash}
        rowHeight={ROW_HEIGHT}
        {laneX}
        {rowY}
        {edgePath}
        {laneColor}
        {edgeColor}
        {refsForCommit}
        {formatTime}
        {shortHash}
        {onSelect}
        onContextMenu={openContextMenu}
      />
    {:else}
      <FlowGroupList
        groups={flowGroups}
        {selectedHash}
        collapsedGroupIds={collapsedFlowGroups}
        {laneColor}
        {formatTime}
        {shortHash}
        onToggleGroup={toggleFlowGroup}
        {onSelect}
        onContextMenu={openContextMenu}
      />
    {/if}
  </div>

  {#if menu}
    <div
      class="gl-context-menu"
      style={`left:${menu.x}px; top:${menu.y}px;`}
      data-testid="commit-context-menu"
    >
      <button
        type="button"
        onclick={runCreateBranchFromCommit}
        data-testid="ctx-create-branch"
      >
        Create branch from this commit
      </button>
      <button
        type="button"
        onclick={runCheckoutCommit}
        data-testid="ctx-checkout-commit"
      >
        Checkout this commit (detached head)
      </button>
      <button
        type="button"
        onclick={runRevertCommit}
        data-testid="ctx-revert-commit"
      >
        Revert this commit
      </button>
      <button
        type="button"
        onclick={runCherryPick}
        data-testid="ctx-cherry-pick"
      >
        Cherry-pick to current branch
      </button>
      <div class="gl-menu-sep"></div>
      <button
        type="button"
        onclick={() => runReset("soft")}
        data-testid="ctx-reset-soft"
      >
        Reset current branch (soft)
      </button>
      <button
        type="button"
        onclick={() => runReset("mixed")}
        data-testid="ctx-reset-mixed"
      >
        Reset current branch (mixed)
      </button>
      <button
        type="button"
        onclick={() => runReset("hard")}
        data-testid="ctx-reset-hard"
      >
        Reset current branch (hard)
      </button>
    </div>
  {/if}
</section>

<style>
  .gl-commit {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .gl-commit-list-wrap {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-canvas);
  }

  .gl-context-menu {
    position: fixed;
    background: var(--bg-panel);
    border: 1px solid var(--line-medium);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 10000;
    min-width: 220px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    backdrop-filter: blur(12px);
  }

  .gl-context-menu button {
    text-align: left;
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 13px;
    color: var(--text-normal);
    transition: all var(--transition-fast);
  }

  .gl-context-menu button:hover {
    background: var(--accent);
    color: white;
  }

  .gl-menu-sep {
    height: 1px;
    background: var(--line-soft);
    margin: 4px;
  }
</style>
