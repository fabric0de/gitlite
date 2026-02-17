# ROADMAP

## Phase 1: Backend Foundation (Current)

### Goals
- Harden core Git workflows
- Stabilize and document IPC contracts
- Establish open-source collaboration standards

### Included
- Branch/commit/diff/staging/remote backend workflows
- Pull policy safety guarantees (FF-only)
- Docs, issue templates, and baseline CI

### Excluded
- Full UI implementation
- Native vibrancy experiments

### Exit Criteria
- Backend test suite is stable and repeatable
- New contributors can start from docs alone

## Phase 2: UI Integration (In Progress)

### Goals
- Build desktop UI on top of Phase 1 IPC contracts
- Support core user flows end-to-end (open repo, stage, commit, diff, branch)
- Ship high-density prototype shell first (mock provider), then wire IPC

### Principles
- Keep IPC compatibility where possible
- Avoid backend regressions during UI rollout

### Exit Criteria
- Core end-to-end flows are validated
- Backend reliability metrics remain stable
