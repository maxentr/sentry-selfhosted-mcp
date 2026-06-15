import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import {
  extractEssentialEventEntry,
  extractEssentialIssueFields,
  filterObjectFields,
  getIssueId,
  grepFilter,
  jsonResult,
  textResult,
  truncateStackTraces,
} from "../helpers/index.js"

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "get_sentry_issue",
    "Get a Sentry issue by ID or URL, with the latest event's stacktrace. Supports field filtering and truncation.",
    {
      issue_id_or_url: z
        .string()
        .describe("Sentry issue ID or full issue URL. Issue ID is a number e.g: 123456"),
      include_latest_event: z
        .boolean()
        .default(false)
        .describe("Include latest event details (default: false to reduce response size)"),
      include_fields: z
        .array(z.string())
        .optional()
        .describe(
          "Whitelist of fields to return (dot notation for nested, e.g. 'latest_event.entries'). If set, only these are returned.",
        ),
      exclude_fields: z
        .array(z.string())
        .optional()
        .describe("Blacklist of fields to drop (dot notation). Ignored if include_fields is set."),
      grep_pattern: z
        .string()
        .optional()
        .describe(
          "Optional: Regex pattern to filter response content. Returns only matching lines with context.",
        ),
      max_stack_frames: z
        .number()
        .optional()
        .describe(
          "Max stack frames to return (default: all). Keeps bottom (most relevant) frames.",
        ),
    },
    async (args) => {
      const issueId = getIssueId(args.issue_id_or_url)
      if (!issueId) {
        return textResult(`Could not extract issue ID from: ${args.issue_id_or_url}`, true)
      }

      console.error(`Fetching Sentry issue ${issueId}`)
      const issueResponse = await api.get<Record<string, unknown>>(`issues/${issueId}/`)

      const issueData = extractEssentialIssueFields(issueResponse)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let combinedData: any = { ...issueData, latest_event: null }

      if (args.include_latest_event) {
        try {
          console.error(`Fetching latest event for issue ${issueId}`)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eventResponse = await api.get<any>(
            `organizations/${orgSlug}/issues/${issueId}/events/latest/`,
          )

          if (eventResponse.entries) {
            combinedData.latest_event = {
              id: eventResponse.id,
              eventID: eventResponse.eventID,
              dateCreated: eventResponse.dateCreated,
              entries: eventResponse.entries.slice(0, 3).map(extractEssentialEventEntry),
              _note: "Event truncated. Use get_sentry_event_details for full event data.",
            }
          } else {
            combinedData.latest_event = eventResponse
          }
        } catch (eventError) {
          console.warn(`Could not fetch latest event for issue ${issueId}.`, eventError)
        }
      }

      if (args.max_stack_frames) {
        combinedData = truncateStackTraces(combinedData, args.max_stack_frames)
      }

      if (args.include_fields || args.exclude_fields) {
        combinedData = filterObjectFields(combinedData, args.include_fields, args.exclude_fields)
      }

      if (args.grep_pattern) {
        combinedData = grepFilter(combinedData, args.grep_pattern)
      }

      return jsonResult(combinedData)
    },
  )
}
