import type { BranchInfo, CommitSummary } from '../../types/git';

export const ROW_HEIGHT = 46;
export const LANE_WIDTH = 14;
export const LANE_PADDING = 8;
export const MAX_GRAPH_WIDTH = 196;

const FLOW_WINDOW_MS = 1000 * 60 * 60 * 6;
const FLOW_MAX_GROUP_SIZE = 8;

export type GraphEdge = {
  fromRow: number;
  toRow: number;
  fromLane: number;
  toLane: number;
};

export type GraphLayout = {
  laneByRow: number[];
  edges: GraphEdge[];
  laneCount: number;
  laneStep: number;
  width: number;
  height: number;
};

export type RelationKind = 'merge' | 'revert' | 'cherry-pick';

export type FlowRelation = {
  kind: RelationKind;
  label: string;
  count: number;
};

export type FlowGroup = {
  id: string;
  lane: number;
  branchLabel: string;
  typeLabel: string;
  startedAt: number;
  endedAt: number;
  commits: CommitSummary[];
  relations: FlowRelation[];
};

export function buildGraph(items: CommitSummary[]): GraphLayout {
  const hashToRow = new Map<string, number>();
  items.forEach((commit, index) => hashToRow.set(commit.hash, index));

  const commitByHash = new Map<string, CommitSummary>();
  items.forEach((commit) => commitByHash.set(commit.hash, commit));

  const childHashesByParent = new Map<string, string[]>();
  for (const commit of items) {
    for (const parent of commit.parents) {
      if (!hashToRow.has(parent)) continue;
      const children = childHashesByParent.get(parent) ?? [];
      children.push(commit.hash);
      childHashesByParent.set(parent, children);
    }
  }

  for (const children of childHashesByParent.values()) {
    children.sort((a, b) => (hashToRow.get(a) ?? Number.MAX_SAFE_INTEGER) - (hashToRow.get(b) ?? Number.MAX_SAFE_INTEGER));
  }

  const mainline = new Set<string>();
  if (items.length > 0) {
    let cursor = items[0].hash;
    while (cursor && !mainline.has(cursor)) {
      mainline.add(cursor);
      const commit = commitByHash.get(cursor);
      if (!commit) break;
      const next = commit.parents.find((parent) => hashToRow.has(parent));
      if (!next) break;
      cursor = next;
    }
  }

  const primaryChildByParent = new Map<string, string>();
  for (const [parentHash, children] of childHashesByParent) {
    if (children.length === 0) continue;
    const onMainline = children.find((childHash) => mainline.has(childHash));
    if (onMainline) {
      primaryChildByParent.set(parentHash, onMainline);
      continue;
    }
    const firstParentChild = children.find((childHash) => commitByHash.get(childHash)?.parents[0] === parentHash);
    if (firstParentChild) {
      primaryChildByParent.set(parentHash, firstParentChild);
      continue;
    }
    primaryChildByParent.set(parentHash, children[0]);
  }

  const laneByRow: number[] = [];
  const laneByHash = new Map<string, number>();
  const edges: GraphEdge[] = [];

  let laneCount = 1;
  let nextLane = 1;

  function allocateLane(): number {
    const lane = nextLane;
    nextLane += 1;
    laneCount = Math.max(laneCount, lane + 1);
    return lane;
  }

  for (let row = items.length - 1; row >= 0; row -= 1) {
    const commit = items[row];
    const firstParent = commit.parents.find((parent) => hashToRow.has(parent));

    let lane = 0;
    if (!mainline.has(commit.hash)) {
      if (firstParent) {
        const parentLane = laneByHash.get(firstParent) ?? 0;
        const primaryChild = primaryChildByParent.get(firstParent);
        lane = primaryChild === commit.hash && parentLane !== 0 ? parentLane : allocateLane();
      } else {
        lane = allocateLane();
      }
    }

    laneByHash.set(commit.hash, lane);
    laneByRow[row] = lane;
    laneCount = Math.max(laneCount, lane + 1);
  }

  for (let row = 0; row < items.length; row += 1) {
    const commit = items[row];
    const fromLane = laneByHash.get(commit.hash) ?? laneByRow[row] ?? 0;
    for (const parent of commit.parents) {
      const parentRow = hashToRow.get(parent);
      if (parentRow === undefined || parentRow <= row) continue;
      const toLane = laneByHash.get(parent) ?? fromLane;
      edges.push({ fromRow: row, toRow: parentRow, fromLane, toLane });
    }
  }

  const laneStep =
    laneCount <= 1
      ? LANE_WIDTH
      : Math.min(
          LANE_WIDTH,
          Math.max(8, Math.floor((MAX_GRAPH_WIDTH - LANE_PADDING * 2 - LANE_WIDTH) / (laneCount - 1)))
        );

  const width = LANE_PADDING * 2 + (laneCount - 1) * laneStep + LANE_WIDTH;
  const height = items.length * ROW_HEIGHT;
  return { laneByRow, edges, laneCount, laneStep, width, height };
}

export function buildFlowBranchLabelMap(items: CommitSummary[], branchItems: BranchInfo[]): Map<string, string> {
  type Assignment = { label: string; priority: number; distance: number };

  const rows = new Map<string, number>();
  const commitsByHash = new Map<string, CommitSummary>();
  items.forEach((commit, index) => {
    rows.set(commit.hash, index);
    commitsByHash.set(commit.hash, commit);
  });

  const assignments = new Map<string, Assignment>();
  const sortedBranches = [...branchItems].sort((a, b) => {
    const aPriority = a.isCurrent ? 0 : a.isRemote ? 2 : 1;
    const bPriority = b.isCurrent ? 0 : b.isRemote ? 2 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.name.localeCompare(b.name);
  });

  for (const branch of sortedBranches) {
    const tip = branch.targetHash;
    if (!tip || !rows.has(tip)) continue;

    const priority = branch.isCurrent ? 0 : branch.isRemote ? 2 : 1;
    const label = branch.isRemote ? branch.name.replace(/^origin\//, '') : branch.name;
    const seen = new Set<string>();
    let cursor = tip;
    let distance = 0;

    while (cursor && rows.has(cursor) && !seen.has(cursor) && distance <= items.length + 8) {
      seen.add(cursor);
      const existing = assignments.get(cursor);
      if (
        !existing ||
        priority < existing.priority ||
        (priority === existing.priority && distance < existing.distance)
      ) {
        assignments.set(cursor, { label, priority, distance });
      }

      const next = commitsByHash
        .get(cursor)
        ?.parents.find((parentHash) => rows.has(parentHash));
      if (!next) break;
      cursor = next;
      distance += 1;
    }
  }

  const map = new Map<string, string>();
  for (const [hash, assignment] of assignments.entries()) {
    map.set(hash, assignment.label);
  }
  return map;
}

export function buildLaneByHashMap(items: CommitSummary[], graph: GraphLayout): Map<string, number> {
  const map = new Map<string, number>();
  items.forEach((commit, row) => {
    map.set(commit.hash, graph.laneByRow[row] ?? 0);
  });
  return map;
}

function normalizedType(message: string): string {
  const conventional = message.match(/^([a-z]+)(\([^)]+\))?!?:/i);
  if (conventional?.[1]) return conventional[1].toLowerCase();
  if (/^merge\b/i.test(message)) return 'merge';
  if (/^revert\b/i.test(message)) return 'revert';
  if (/cherry[\s-]?pick/i.test(message)) return 'cherry-pick';
  return 'commit';
}

function relationOf(message: string): { kind: RelationKind; label: string } | null {
  if (/^merge\b/i.test(message)) return { kind: 'merge', label: 'Merge' };
  if (/^revert\b/i.test(message)) return { kind: 'revert', label: 'Revert' };
  if (/cherry[\s-]?pick/i.test(message)) return { kind: 'cherry-pick', label: 'Cherry-pick' };
  return null;
}

type BuildFlowGroupsOptions = {
  commits: CommitSummary[];
  laneByHash: Map<string, number>;
  resolveBranchLabel: (commit: CommitSummary) => string;
};

export function buildFlowGroups(options: BuildFlowGroupsOptions): FlowGroup[] {
  const { commits, laneByHash, resolveBranchLabel } = options;
  const groups: FlowGroup[] = [];

  for (const commit of commits) {
    const branchLabel = resolveBranchLabel(commit);
    const typeLabel = normalizedType(commit.message);
    const relation = relationOf(commit.message);
    const lane = laneByHash.get(commit.hash) ?? 0;
    const current = groups[groups.length - 1];

    const canAppend =
      !!current &&
      current.branchLabel === branchLabel &&
      current.typeLabel === typeLabel &&
      current.commits.length < FLOW_MAX_GROUP_SIZE &&
      Math.abs(current.endedAt - commit.date) <= FLOW_WINDOW_MS;

    if (!canAppend) {
      groups.push({
        id: commit.hash,
        lane,
        branchLabel,
        typeLabel,
        startedAt: commit.date,
        endedAt: commit.date,
        commits: [commit],
        relations: relation ? [{ ...relation, count: 1 }] : []
      });
      continue;
    }

    current.commits.push(commit);
    current.endedAt = commit.date;
    current.startedAt = Math.max(current.startedAt, commit.date);
    if (!relation) continue;

    const existing = current.relations.find((item) => item.kind === relation.kind);
    if (existing) {
      existing.count += 1;
    } else {
      current.relations.push({ ...relation, count: 1 });
    }
  }

  return groups;
}
