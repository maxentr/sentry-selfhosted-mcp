import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { jsonResult } from "../helpers/index.js"

export function register(server: McpServer, api: ApiClient, _orgSlug: string) {
  server.tool(
    "create_sentry_issue_comment",
    "Add a comment to a Sentry issue.",
    {
      issue_id: z.string().describe("The ID of the issue to comment on."),
      comment_text: z.string().describe("The text content of the comment."),
    },
    async (args) => {
      console.error(`Adding comment to issue ${args.issue_id}`)
      const data = await api.post(`issues/${args.issue_id}/comments/`, { text: args.comment_text })
      return jsonResult(data)
    },
  )
}
