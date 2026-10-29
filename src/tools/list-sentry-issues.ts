import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { jsonResult } from "../helpers/index.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const summary = (i: any) => ({
  id: i.id,
  shortId: i.shortId,
  title: i.title,
  culprit: i.culprit,
  project: i.project?.slug,
  level: i.level,
  status: i.status,
  count: i.count,
  userCount: i.userCount,
  firstSeen: i.firstSeen,
  lastSeen: i.lastSeen,
})

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "list_sentry_issues",
    'Search issues in one project, or the whole organization when project_slug is omitted. Query uses Sentry syntax: "is:unresolved level:error release:1.2.0 environment:production". Returns a summary per issue; use get_sentry_issue for details.',
    {
      project_slug: z.string().optional().describe("Project slug. Omit to search all projects."),
      query: z.string().optional().describe('Sentry search query, e.g. "is:unresolved".'),
      status: z.enum(["resolved", "unresolved", "ignored"]).optional().describe("Status filter."),
      sort: z
        .enum(["date", "new", "freq", "user"])
        .optional()
        .describe("date = last seen (default), new = first seen, freq = events, user = users."),
      period: z.string().optional().describe('Stats period, e.g. "24h", "14d" (default 14d).'),
      limit: z.number().min(1).max(100).default(10).describe("Max issues (default 10)."),
      cursor: z.string().optional().describe("Pagination cursor from a previous response."),
    },
    async (args) => {
      const query = [args.query, args.status ? `is:${args.status}` : undefined]
        .filter(Boolean)
        .join(" ")
      const params: Record<string, string | number> = { limit: args.limit }
      if (query) params.query = query
      if (args.sort) params.sort = args.sort
      if (args.period) params.statsPeriod = args.period
      if (args.cursor) params.cursor = args.cursor

      const path = args.project_slug
        ? `projects/${orgSlug}/${args.project_slug}/issues/`
        : `organizations/${orgSlug}/issues/`
      console.error(`Fetching issues: ${path}`)
      const data = await api.get<unknown[]>(path, params)
      return jsonResult(data.map(summary))
    },
  )
}
