# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-15

### Changed

- **Major token reduction on tool responses (~66% on average, lossless).** Measured against a live self-hosted instance:
  - `get_sentry_event_details`: 39,630 → 1,807 tokens (−95%)
  - `get_sentry_issue`: 2,697 → 1,545 tokens (−43%)
  - `list_sentry_issues`: 14,466 → 9,981 tokens (−31%)
  - `list_sentry_projects`: 15,347 → 10,846 tokens (−29%)
- All tool outputs now serialize as compact JSON instead of pretty-printed (whitespace carries no information).
- `null`/`undefined` fields are stripped recursively from responses (`false`, `0`, `""`, `[]`, `{}` are preserved). `raw_sentry_api` keeps the unfiltered shape.
- `get_sentry_event_details` now drops the Sentry `_meta` data-scrubbing annotation tree, which mirrored `entries` and accounted for ~80% of the payload while carrying no debugging value.
- Tool and parameter descriptions tightened (lower per-session schema overhead) without removing guidance.
- Centralized response building in `helpers/result.ts` (`jsonResult`, `textResult`, `stripNullish`, `estimateTokens`); token-size estimates now match the emitted compact format.

### Fixed

- `extractEssentialEventEntry` returned an empty stack-frame `context` due to an incorrect `slice(-3, 4)`; it now keeps the error line ± 1 (3 lines).

### Dependencies

- `@modelcontextprotocol/sdk` `^1.27` → `^1.29`.
- `zod` `^3.25` → `^4.4` (major). `z.record(...)` now requires an explicit key schema; updated `raw_sentry_api` accordingly. No change to tool behavior.

### Tooling

- Migrated from Biome to [oxlint](https://oxc.rs) + [oxfmt](https://oxc.rs/docs/guide/usage/formatter) for linting and formatting.
- Added [lefthook](https://lefthook.dev) git hooks (pre-commit lint/format, pre-push typecheck).
- Bumped pnpm to `11.6.0`, `typescript` to `^6`, `@types/node` to `^25`. pnpm settings moved to `pnpm-workspace.yaml`.

_Dev-tooling and dependency changes only — no change to the published runtime behavior of the MCP tools._

## [1.0.1] - 2026-02-26

### Changed

- Revised README for clarity, structure, and installation instructions (npx + source)

## [1.0.0] - 2026-02-18

### Added

- Initial release
- MCP server for self-hosted Sentry instances
- Tools: `list_sentry_issues`, `get_sentry_issue`, `list_sentry_projects`, `list_sentry_issue_events`, `get_sentry_event_details`, `get_sentry_issue_stacktrace`, `update_sentry_issue_status`, `create_sentry_issue`, `raw_sentry_api`
- Pagination, response truncation, and smart field filtering to reduce token usage
- Raw Sentry API access for unfiltered queries
- Intelligent debugging tools with response size warnings

[1.1.0]: https://github.com/maxentr/sentry-selfhosted-mcp/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/maxentr/sentry-selfhosted-mcp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/maxentr/sentry-selfhosted-mcp/releases/tag/v1.0.0
