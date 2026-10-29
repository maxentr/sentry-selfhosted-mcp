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

| Tool                          | Description                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `get_sentry_issue`            | Retrieve issue details by ID or URL, with filtering and stack trace truncation |
| `list_sentry_projects`        | List all projects in the organization                                          |
| `list_sentry_issues`          | List issues for a project with query/status filters and pagination             |
| `get_sentry_event_details`    | Retrieve event details with smart entry prioritization and pagination          |
| `update_sentry_issue_status`  | Update issue status (resolved/ignored/unresolved)                              |
| `create_sentry_issue_comment` | Add a comment to an issue                                                      |
| `raw_sentry_api`              | Raw GET requests to any Sentry API endpoint with grep filtering                |
| `get_stack_frames`            | Extract structured stack trace frames from an event                            |
| `check_dsym_status`           | Check for missing dSYM/debug symbols in iOS/macOS crashes                      |
