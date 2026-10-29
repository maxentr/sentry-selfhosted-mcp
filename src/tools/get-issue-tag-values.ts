import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { jsonResult, resolveIssueId, textResult } from "../helpers/index.js"

interface TagValue {
  value: string
  count: number
  lastSeen?: string
}
interface Tag {
  key: string
  totalValues: number
  topValues?: TagValue[]
}

const top = (values: TagValue[] | undefined, n: number) =>
  (values ?? []).slice(0, n).map((v) => ({ value: v.value, count: v.count, lastSeen: v.lastSeen }))

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "get_issue_tag_values",
    "How an issue spreads: top values of a tag (release, environment, browser, url, user…) with counts. Without key: every tag with its top 3 values. Answers 'since which release?', 'which env?', 'how many users?'.",
    {
      issue_id: z.string().describe("Issue ID, short ID or issue URL."),
      key: z.string().optional().describe('Tag key, e.g. "release". Omit to list all tags.'),
      limit: z.number().min(1).max(100).default(10).describe("Values per tag (default 10)."),
    },
    async (args) => {
      const issueId = await resolveIssueId(api, orgSlug, args.issue_id)
      if (!issueId) return textResult(`Not an issue reference: ${args.issue_id}`, true)
      if (args.key) {
        const tag = await api.get<Tag>(`issues/${issueId}/tags/${encodeURIComponent(args.key)}/`)
        return jsonResult({
          key: tag.key,
          totalValues: tag.totalValues,
          top: top(tag.topValues, args.limit),
        })
      }
      const tags = await api.get<Tag[]>(`issues/${issueId}/tags/`)
      return jsonResult(
        tags.map((t) => ({
          key: t.key,
          totalValues: t.totalValues,
          top: top(t.topValues, Math.min(3, args.limit)),
        })),
      )
    },
  )
}
