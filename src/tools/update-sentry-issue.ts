import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { jsonResult, resolveIssueId, textResult } from "../helpers/index.js"

interface Issue {
  status?: string
  assignedTo?: { type?: string; id?: string; name?: string; email?: string } | null
}

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "update_sentry_issue",
    "Change an issue's status and/or assignee. Skips the call when nothing would change.",
    {
      issue_id: z.string().describe("Issue ID, short ID or issue URL."),
      status: z
        .enum(["resolved", "resolvedInNextRelease", "unresolved", "ignored"])
        .optional()
        .describe("New status. resolvedInNextRelease reopens it if it occurs in a later release."),
      ignore_minutes: z.number().min(1).optional().describe("With ignored: ignore for N minutes."),
      ignore_count: z
        .number()
        .min(1)
        .optional()
        .describe("With ignored: ignore until N more events."),
      assigned_to: z
        .string()
        .optional()
        .describe('Username, email, "team:<slug>", or "" to unassign.'),
    },
    async (args) => {
      if (args.status === undefined && args.assigned_to === undefined) {
        return textResult("Nothing to change: pass status and/or assigned_to.", true)
      }
      const issueId = await resolveIssueId(api, orgSlug, args.issue_id)
      if (!issueId) return textResult(`Not an issue reference: ${args.issue_id}`, true)

      const current = await api.get<Issue>(`issues/${issueId}/`)
      const body: Record<string, unknown> = {}
      if (args.status === "resolvedInNextRelease") {
        body.status = "resolved"
        body.statusDetails = { inNextRelease: true }
      } else if (args.status === "ignored") {
        body.status = "ignored"
        const details: Record<string, number> = {}
        if (args.ignore_minutes) details.ignoreDuration = args.ignore_minutes
        if (args.ignore_count) details.ignoreCount = args.ignore_count
        if (Object.keys(details).length > 0) body.statusDetails = details
      } else if (args.status && args.status !== current.status) {
        body.status = args.status
      }
      if (args.assigned_to !== undefined) {
        const who = current.assignedTo
        const same =
          args.assigned_to === ""
            ? !who
            : [who?.name, who?.email, `${who?.type}:${who?.name}`].includes(args.assigned_to)
        if (!same) body.assignedTo = args.assigned_to
      }
      // Several agents share one process: an update that changes nothing is not sent.
      if (Object.keys(body).length === 0) {
        return jsonResult({ ok: true, issue_id: issueId, unchanged: true, status: current.status })
      }

      console.error(`Updating issue ${issueId}: ${JSON.stringify(body)}`)
      const data = await api.put<Issue>(`issues/${issueId}/`, body)
      return jsonResult({
        ok: true,
        issue_id: issueId,
        status: data.status,
        assigned_to: data.assignedTo?.email ?? data.assignedTo?.name,
      })
    },
  )
}
