import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { jsonResult, resolveIssueId, textResult } from "../helpers/index.js"

interface Activity {
  type: string
  dateCreated: string
  user?: { name?: string; email?: string } | null
  data?: Record<string, unknown>
}

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "get_issue_activity",
    "Issue history, newest first: comments, status changes, regressions (with release), assignments, first seen.",
    {
      issue_id: z.string().describe("Issue ID, short ID or issue URL."),
      limit: z.number().min(1).max(100).default(20).describe("Max entries (default 20)."),
    },
    async (args) => {
      const issueId = await resolveIssueId(api, orgSlug, args.issue_id)
      if (!issueId) return textResult(`Not an issue reference: ${args.issue_id}`, true)
      // The issue detail carries its activity: no extra endpoint, works on older self-hosted.
      const issue = await api.get<{ activity?: Activity[] }>(`issues/${issueId}/`)
      return jsonResult(
        (issue.activity ?? []).slice(0, args.limit).map((a) => ({
          type: a.type,
          at: a.dateCreated,
          by: a.user?.name ?? a.user?.email ?? "Sentry",
          data: a.data && Object.keys(a.data).length > 0 ? a.data : undefined,
        })),
      )
    },
  )
}
