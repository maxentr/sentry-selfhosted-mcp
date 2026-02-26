# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.1]: https://github.com/maxentr/sentry-selfhosted-mcp/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/maxentr/sentry-selfhosted-mcp/releases/tag/v1.0.0
