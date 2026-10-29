import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { jsonResult, resolveIssueId, textResult } from "../helpers/index.js"

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "create_sentry_issue_comment",
    "Add a comment (Markdown, max 4096 chars) to a Sentry issue.",
    {
      issue_id: z.string().describe("Issue ID, short ID or issue URL."),
      comment_text: z.string().min(1).max(4096).describe("Comment text."),
    },
    async (args) => {
      const issueId = await resolveIssueId(api, orgSlug, args.issue_id)
      if (!issueId) return textResult(`Not an issue reference: ${args.issue_id}`, true)
      console.error(`Adding comment to issue ${issueId}`)
      const data = await api.post<{ id?: string; dateCreated?: string }>(
        `issues/${issueId}/comments/`,
        { text: args.comment_text },
      )
      return jsonResult({ ok: true, issue_id: issueId, comment_id: data.id, at: data.dateCreated })
    },
  )
}
