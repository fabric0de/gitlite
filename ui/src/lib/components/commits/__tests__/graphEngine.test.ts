import { describe, expect, it } from 'vitest';
import { MOCK_BRANCHES, MOCK_COMMITS } from '../../../mocks/mockData';
import {
  buildFlowBranchLabelMap,
  buildFlowGroups,
  buildGraph,
  buildLaneByHashMap
} from '../graphEngine';

describe('graphEngine', () => {
  it('builds a graph layout with lanes and edges', () => {
    const layout = buildGraph(MOCK_COMMITS);

    expect(layout.laneByRow).toHaveLength(MOCK_COMMITS.length);
    expect(layout.edges.length).toBeGreaterThan(0);
    expect(layout.laneCount).toBeGreaterThan(0);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('maps commits to inferred branch labels', () => {
    const labels = buildFlowBranchLabelMap(MOCK_COMMITS, MOCK_BRANCHES);

    expect(labels.get('8c0977e')).toBe('main');
    expect(labels.get('6f85307')).toBeTruthy();
  });

  it('groups commits by flow characteristics', () => {
    const layout = buildGraph(MOCK_COMMITS);
    const laneByHash = buildLaneByHashMap(MOCK_COMMITS, layout);
    const labels = buildFlowBranchLabelMap(MOCK_COMMITS, MOCK_BRANCHES);
    const groups = buildFlowGroups({
      commits: MOCK_COMMITS,
      laneByHash,
      resolveBranchLabel: (commit) => labels.get(commit.hash) ?? 'detached'
    });

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]?.commits.length).toBeGreaterThan(0);
    expect(groups[0]?.id).toBeTruthy();
  });
});
