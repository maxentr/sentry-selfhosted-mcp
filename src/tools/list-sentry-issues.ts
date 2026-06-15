import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { jsonResult, truncateResponse } from "../helpers/index.js"

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "list_sentry_issues",
    "List issues for a specific project, optionally filtering by query or status. Supports pagination for large result sets.",
    {
      project_slug: z.string().describe('The slug of the project (e.g., "my-web-app").'),
      query: z
        .string()
        .optional()
        .describe('Optional Sentry search query (e.g., "is:unresolved environment:production").'),
      status: z
        .enum(["resolved", "unresolved", "ignored"])
        .optional()
        .describe("Optional issue status filter."),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum number of issues to return (1-100, default: 25)."),
      cursor: z
        .string()
        .optional()
        .describe("Pagination cursor from previous response for getting next page."),
    },
    async (args) => {
      const params: Record<string, string | number> = {}

      if (args.query) params.query = args.query
      if (args.status) {
        params.query = `${params.query ? `${params.query} ` : ""}is:${args.status}`
      }
      if (args.limit) params.limit = args.limit
      if (args.cursor) params.cursor = args.cursor
      if (!params.limit) params.limit = 25

      console.error(`Fetching issues for project ${args.project_slug} in org ${orgSlug}`)
      const data = await api.get(`projects/${orgSlug}/${args.project_slug}/issues/`, params)

      const { data: responseData, truncated, pagination_info } = truncateResponse(data)

      return jsonResult(responseData, truncated && pagination_info ? pagination_info : undefined)
    },
  )
}
