<script lang="ts">
  import type { BranchInfo, CommitSummary } from "../../types/git";
  import type { GraphEdge, GraphLayout } from "./graphEngine";

  const NODE_RADIUS = 4;
  const NODE_RADIUS_SELECTED = 5.5;
  const TIP_LABEL_MAX_WIDTH = 340;

  let {
    commits = [],
    graph,
    selectedHash = "",
    rowHeight = 46,
    laneX,
    rowY,
    edgePath,
    laneColor,
    edgeColor,
    refsForCommit,
    formatTime,
    shortHash,
    onSelect,
    onContextMenu,
  }: {
    commits: CommitSummary[];
    graph: GraphLayout;
    selectedHash: string;
    rowHeight: number;
    laneX: (lane: number, layout?: GraphLayout) => number;
    rowY: (row: number) => number;
    edgePath: (edge: GraphEdge, layout?: GraphLayout) => string;
    laneColor: (lane: number) => string;
    edgeColor: (edge: GraphEdge) => string;
    refsForCommit: (hash: string) => BranchInfo[];
    formatTime: (value: number) => string;
    shortHash: (value: string) => string;
    onSelect: (hash: string) => void;
    onContextMenu: (event: MouseEvent, hash: string) => void;
  } = $props();

  let hoveredHash = $state("");

  function isNodeHighlighted(commitHash: string) {
    return selectedHash === commitHash || hoveredHash === commitHash;
  }

  type TipLabel = {
    name: string;
    title: string;
    isCurrent: boolean;
    isRemote: boolean;
  };

  function tipLabelForCommit(commitHash: string): TipLabel | null {
    const refs = [...refsForCommit(commitHash)];
    if (refs.length === 0) return null;

    refs.sort((a, b) => {
      const aPriority = a.isCurrent ? 0 : a.isRemote ? 2 : 1;
      const bPriority = b.isCurrent ? 0 : b.isRemote ? 2 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.name.localeCompare(b.name);
    });

    const ref = refs[0];
    return {
      name: ref.name,
      title: ref.name,
      isCurrent: ref.isCurrent,
      isRemote: ref.isRemote,
    };
  }

  function estimateTipLabelWidth(label: TipLabel): number {
    // Rough compact UI font width + chip paddings.
    return 14 + label.name.length * 7.1;
  }

  function computeTipLabelColumnWidth(): number {
    let maxWidth = 0;
    for (const commit of commits) {
      const label = tipLabelForCommit(commit.hash);
      if (!label) continue;
      const width = estimateTipLabelWidth(label);
      if (width > maxWidth) maxWidth = width;
    }
    if (maxWidth <= 0) return 0;
    return Math.min(TIP_LABEL_MAX_WIDTH, Math.ceil(maxWidth));
  }

  const tipLabelColumnWidth = $derived(computeTipLabelColumnWidth());

  function commitTooltip(commit: CommitSummary): string {
    const tip = tipLabelForCommit(commit.hash);
    const lines = [
      commit.message,
      `${shortHash(commit.hash)} • ${formatTime(commit.date)}`,
      `Author: ${commit.author}`,
    ];
    if (tip) lines.push(`Tip: ${tip.name}`);
    return lines.join("\n");
  }
</script>

<div class="gl-graph-container">
  <svg
    class="gl-commit-graph-overlay"
    width={graph.width}
    height={graph.height}
    aria-hidden="true"
    style={`height:${graph.height}px; width:${graph.width}px;`}
  >
    <!-- Edges Background -->
    {#each graph.edges as edge}
      <path
        d={edgePath(edge, graph)}
        class="gl-commit-edge"
        style={`stroke:${edgeColor(edge)};`}
      />
    {/each}

    <!-- Edge Highlights (on hover/select) -->
    {#each graph.edges as edge}
      {#if commits[edge.fromRow]?.hash === (hoveredHash || selectedHash) || commits[edge.toRow]?.hash === (hoveredHash || selectedHash)}
        <path
          d={edgePath(edge, graph)}
          class="gl-commit-edge-highlight"
          style={`stroke:${edgeColor(edge)};`}
        />
      {/if}
    {/each}

    <!-- Nodes -->
    {#each commits as commit, row}
      <circle
        cx={laneX(graph.laneByRow[row] ?? 0, graph)}
        cy={rowY(row)}
        r={isNodeHighlighted(commit.hash) ? NODE_RADIUS_SELECTED : NODE_RADIUS}
        class:is-selected={selectedHash === commit.hash}
        class:is-hovered={hoveredHash === commit.hash}
        class="gl-commit-node"
        style={`fill:${laneColor(graph.laneByRow[row] ?? 0)};`}
      />
    {/each}
  </svg>

  <div class="gl-commit-rows">
    {#each commits as commit, row}
      <button
        type="button"
        class="gl-list-row gl-commit-row"
        class:is-active={selectedHash === commit.hash}
        class:is-hovered={hoveredHash === commit.hash}
        onclick={() => onSelect(commit.hash)}
        oncontextmenu={(event) => onContextMenu(event, commit.hash)}
        onmouseenter={() => (hoveredHash = commit.hash)}
        onmouseleave={() => (hoveredHash = "")}
        data-testid={`commit-row-${commit.hash}`}
        style={`padding-left:${graph.width + 12}px; height:${rowHeight}px;`}
      >
        {#if tipLabelColumnWidth > 0}
          <div
            class="gl-tip-label-slot"
            style={`width:${tipLabelColumnWidth}px;`}
            aria-hidden="true"
          >
            {#if tipLabelForCommit(commit.hash)}
              <span
                class="gl-tip-label"
                class:is-current={!!tipLabelForCommit(commit.hash)?.isCurrent}
                class:is-remote={!!tipLabelForCommit(commit.hash)?.isRemote}
                title={tipLabelForCommit(commit.hash)?.title}
              >
                {tipLabelForCommit(commit.hash)?.name}
              </span>
            {/if}
          </div>
        {/if}
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
            <span class="gl-commit-date gl-soft">{formatTime(commit.date)}</span
            >
          </div>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .gl-graph-container {
    position: relative;
    width: 100%;
    min-height: 100%;
    background: var(--bg-canvas);
    container-type: inline-size;
  }

  .gl-commit-graph-overlay {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 10;
  }

  .gl-commit-edge {
    fill: none;
    stroke-width: 1.2px;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.4;
    transition: opacity var(--transition-medium);
  }

  .gl-commit-edge-highlight {
    fill: none;
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 1;
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.2));
  }

  .gl-commit-node {
    stroke: var(--bg-canvas);
    stroke-width: 2px;
    transition: all var(--transition-fast) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .gl-commit-node.is-selected {
    stroke: var(--text-strong);
    stroke-width: 2px;
    filter: brightness(1.2);
  }

  .gl-commit-node.is-hovered:not(.is-selected) {
    stroke: var(--line-medium);
    stroke-width: 2px;
    filter: brightness(1.1);
  }

  .gl-commit-rows {
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
    padding-right: 16px;
    gap: 12px;
    position: relative;
    transition: background-color var(--transition-fast);
  }

  .gl-commit-row {
    position: relative;
  }

  .gl-tip-label-slot {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 0 0 auto;
    overflow: hidden;
    padding-right: 2px;
  }

  .gl-tip-label {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid var(--line-soft);
    background: color-mix(in oklab, var(--bg-surface), transparent 5%);
    color: var(--text-soft);
    font-size: 10px;
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    pointer-events: none;
  }

  .gl-tip-label.is-current {
    border-color: color-mix(in oklab, var(--accent), transparent 40%);
    color: var(--accent);
    background: color-mix(in oklab, var(--accent), transparent 90%);
  }

  .gl-tip-label.is-remote {
    border-style: dashed;
    opacity: 0.92;
  }

  .gl-list-row:hover,
  .gl-list-row.is-hovered {
    background: var(--bg-hover);
  }

  .gl-list-row.is-active {
    background: var(--bg-active);
  }

  .gl-commit-hash {
    font-size: 11px;
    min-width: 54px;
    flex-shrink: 0;
    opacity: 0.6;
    letter-spacing: 0.02em;
  }

  .gl-commit-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .gl-commit-msg-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .gl-commit-message {
    color: var(--text-strong);
    font-weight: 500;
    font-size: 13px;
  }

  .gl-commit-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .gl-dot-sep {
    opacity: 0.3;
  }

  .gl-commit-date {
    font-size: 11px;
    white-space: nowrap;
  }

  .gl-commit-author {
    font-weight: 450;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @container (max-width: 860px) {
    .gl-tip-label-slot {
      display: none;
    }
  }

  @container (max-width: 700px) {
    .gl-list-row {
      gap: 8px;
      padding-right: 10px;
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
