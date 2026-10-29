# @maxentr/sentry-selfhosted-mcp

A Model Context Protocol (MCP) server for interacting with self-hosted Sentry instances.

## Installation

### Via npx (recommended)

No installation needed. Add to your MCP client config:

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "@maxentr/sentry-selfhosted-mcp"],
      "env": {
        "SENTRY_URL": "https://sentry.example.com",
        "SENTRY_AUTH_TOKEN": "your-token",
        "SENTRY_ORG_SLUG": "your-org"
      }
    }
  }
}
```

### From source

```bash
git clone https://github.com/maxentr/sentry-selfhosted-mcp.git
cd sentry-selfhosted-mcp
pnpm install
pnpm build
```

Then reference the built file in your MCP config:

```json
{
  "mcpServers": {
    "sentry": {
      "command": "node",
      "args": ["/path/to/sentry-selfhosted-mcp/build/index.js"],
      "env": {
        "SENTRY_URL": "https://sentry.example.com",
        "SENTRY_AUTH_TOKEN": "your-token",
        "SENTRY_ORG_SLUG": "your-org"
      }
    }
  }
}
```

## Configuration

| Environment Variable | Required | Description                                                                                         |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `SENTRY_URL`         | Yes      | Base URL of your self-hosted Sentry instance                                                        |
| `SENTRY_AUTH_TOKEN`  | Yes      | API auth token (scopes: `issue:read`, `project:read`, `event:read`, `issue:write`, `comment:write`) |
| `SENTRY_ORG_SLUG`    | Yes      | Organization slug                                                                                   |

### HTTP transport

By default the server speaks stdio, one process per client. Set `MCP_TRANSPORT=http` to serve
Streamable HTTP instead: one process then serves every client, each with its own MCP session.

| Environment Variable | Default     | Description                                             |
| -------------------- | ----------- | ------------------------------------------------------- |
| `MCP_TRANSPORT`      | `stdio`     | `http` to serve Streamable HTTP                         |
| `MCP_HTTP_HOST`      | `127.0.0.1` | Bind address. Only loopback `Host` headers are accepted |
| `MCP_HTTP_PORT`      | `8080`      | Port                                                    |
| `MCP_HTTP_PATH`      | `/mcp`      | Endpoint path                                           |

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=7307 SENTRY_URL=… SENTRY_AUTH_TOKEN=… SENTRY_ORG_SLUG=… \
  npx -y @maxentr/sentry-selfhosted-mcp
```

Client configuration: `{ "type": "http", "url": "http://127.0.0.1:7307/mcp" }`. The endpoint has
no authentication of its own: keep it on loopback.

## Available Tools

Every `issue_id` argument takes an issue ID, a short ID (`API-DATA-1A`) or any Sentry issue URL.
Every `event_id` argument takes an event ID or an event URL (then `project_slug` is optional).

| Tool                          | Description                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `get_sentry_issue`            | Issue details, optional latest event, with field filtering and stack truncation      |
| `list_sentry_issues`          | Search issues in a project or the whole org: query, status, sort, period, pagination |
| `get_sentry_event_details`    | Event details with entry prioritization and pagination                               |
| `get_stack_frames`            | Structured stack frames, in-app only by default (falls back to all)                  |
| `get_issue_tag_values`        | Top values of a tag (release, environment, browser…) or of every tag                 |
| `get_issue_activity`          | Issue history: comments, status changes, regressions with release, assignments       |
| `update_sentry_issue`         | Status (incl. resolved in next release, timed ignore) and assignee; skips no-ops     |
| `create_sentry_issue_comment` | Add a comment (max 4096 chars)                                                       |
| `list_sentry_projects`        | Projects of the org: slug, name, platform                                            |
| `raw_sentry_api`              | Raw GET to any Sentry API endpoint, with grep filtering and a size guard             |
| `check_dsym_status`           | Missing dSYM/debug symbols in iOS/macOS crashes                                      |

`SENTRY_MCP_TOOLS=core` leaves out `check_dsym_status`, for organizations without Apple
projects: every tool schema costs tokens in each session.
