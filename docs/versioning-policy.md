# Versioning Policy

GitLite follows standard open-source Semantic Versioning with pre-1.0 rules.

## Initial release line
- Initial public line starts at `v0.1.0`.
- Tag format is `v<major>.<minor>.<patch>` (example: `v0.1.0`).

## While major version is `0`
- `0.y.z` is considered early-stage.
- Breaking changes may occur between minor releases.
- Patch releases should remain backward-compatible whenever possible.

## Change type guidance
- `fix:` -> patch bump (`0.1.0` -> `0.1.1`)
- `feat:` -> minor bump (`0.1.0` -> `0.2.0`)
- Explicit breaking changes should be clearly documented in release notes.

## Stable milestone
- Move to `v1.0.0` when:
  - core workflows are stable,
  - public behavior is predictable,
  - upgrade/rollback guidance is mature.
