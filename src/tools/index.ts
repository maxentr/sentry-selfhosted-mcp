import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApiClient } from "../api-client.js"
import * as checkDsymStatus from "./check-dsym-status.js"
import * as createSentryIssueComment from "./create-sentry-issue-comment.js"
import * as getIssueActivity from "./get-issue-activity.js"
import * as getIssueTagValues from "./get-issue-tag-values.js"
import * as getSentryEventDetails from "./get-sentry-event-details.js"
import * as getSentryIssue from "./get-sentry-issue.js"
import * as getStackFrames from "./get-stack-frames.js"
import * as listSentryIssues from "./list-sentry-issues.js"
import * as listSentryProjects from "./list-sentry-projects.js"
import * as rawSentryApi from "./raw-sentry-api.js"
import * as updateSentryIssue from "./update-sentry-issue.js"

const CORE = [
  getSentryIssue,
  listSentryIssues,
  getSentryEventDetails,
  getStackFrames,
  getIssueTagValues,
  getIssueActivity,
  updateSentryIssue,
  createSentryIssueComment,
  listSentryProjects,
  rawSentryApi,
]

/**
 * `SENTRY_MCP_TOOLS=core` leaves out the platform-specific tools (dSYM check for iOS/macOS):
 * each tool schema costs tokens in every session.
 */
export function registerAllTools(server: McpServer, api: ApiClient, orgSlug: string) {
  const tools = process.env.SENTRY_MCP_TOOLS === "core" ? CORE : [...CORE, checkDsymStatus]
  for (const tool of tools) tool.register(server, api, orgSlug)
}
