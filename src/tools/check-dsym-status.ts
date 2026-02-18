import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "check_dsym_status",
    "Check if debug symbols (dSYM files) are missing for iOS/macOS crashes. Missing dSYMs cause stack traces to show addresses instead of function names. Returns list of missing symbols with UUIDs for upload.",
    {
      project_slug: z.string().describe("The slug of the project (e.g., 'apple-ios')"),
      event_id: z
        .string()
        .optional()
        .describe(
          "Optional: Specific event ID to check. If not provided, checks recent events in project.",
        ),
    },
    async (args) => {
      console.error(`Checking dSYM status for project ${args.project_slug}`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let eventData: any

      if (args.event_id) {
        eventData = await api.get(
          `projects/${orgSlug}/${args.project_slug}/events/${args.event_id}/`,
        )
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const issues = await api.get<any[]>(`projects/${orgSlug}/${args.project_slug}/issues/`, {
          limit: 1,
        })

        if (!issues || issues.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No recent issues found in project. Cannot check dSYM status.",
              },
            ],
          }
        }

        const issueId = issues[0].id
        eventData = await api.get(`organizations/${orgSlug}/issues/${issueId}/events/latest/`)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const missingDsyms: any[] = []
      if (eventData.errors && Array.isArray(eventData.errors)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const error of eventData.errors as any[]) {
          if (error.type === "native_missing_dsym" || error.type === "proguard_missing_mapping") {
            missingDsyms.push({
              type: error.type,
              message: error.message,
              image_path: error.data?.image_path,
              image_uuid: error.data?.image_uuid,
              image_name: error.data?.image_name,
            })
          }
        }
      }

      const hasMissingSymbols = missingDsyms.length > 0

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                project: args.project_slug,
                event_id: eventData.eventID || args.event_id,
                has_missing_symbols: hasMissingSymbols,
                missing_count: missingDsyms.length,
                missing_symbols: missingDsyms,
                recommendation: hasMissingSymbols
                  ? "Upload missing dSYM files to Sentry to see full function names in stack traces. Use 'sentry-cli upload-dif' command."
                  : "All debug symbols are present for this event.",
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )
}
