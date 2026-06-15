import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { extractEssentialEventEntry, jsonResult, truncateResponse } from "../helpers/index.js"

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "get_sentry_event_details",
    "Get details for an event by ID within a project. For large events, use limit (default 10) and offset to paginate and avoid token limits.",
    {
      project_slug: z.string().describe("The slug of the project."),
      event_id: z.string().describe("The ID of the event."),
      limit: z
        .number()
        .min(1)
        .default(10)
        .describe(
          "Max entries returned (default 10). Lower for large stack traces to avoid token limits.",
        ),
      offset: z
        .number()
        .min(0)
        .default(0)
        .describe(
          "Pagination offset over entries (0, 10, 20, …).",
        ),
      entry_type: z
        .enum([
          "exception",
          "message",
          "breadcrumbs",
          "request",
          "threads",
          "debugmeta",
          "contexts",
        ])
        .optional()
        .describe(
          "Filter to one entry type. Default: prioritized entries.",
        ),
    },
    async (args) => {
      console.error(`Fetching event ${args.event_id} for project ${args.project_slug}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventData: any = await api.get(
        `projects/${orgSlug}/${args.project_slug}/events/${args.event_id}/`,
      )

      const offset = args.offset
      const limit = args.limit

      if (eventData.entries && Array.isArray(eventData.entries)) {
        const totalEntries = eventData.entries.length
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allEntries = [...eventData.entries] as any[]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let selectedEntries: any[]

        if (args.entry_type) {
          selectedEntries = eventData.entries
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((e: any) => e.type === args.entry_type)
            .slice(offset, offset + limit)

          if (selectedEntries.length === 0) {
            eventData.entries = []
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eventData.error = `No entries of type '${args.entry_type}' found. Available types: ${[...new Set(allEntries.map((e: any) => e.type))].join(", ")}`
          }
        } else {
          const priorityTypes = ["exception", "message", "breadcrumbs", "request"]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const importantEntries: any[] = []

          for (const type of priorityTypes) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entry = eventData.entries.find((e: any) => e.type === type)
            if (entry && importantEntries.length < limit) {
              importantEntries.push(entry)
            }
          }

          if (importantEntries.length < limit) {
            const otherEntries = eventData.entries
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((e: any) => !priorityTypes.includes(e.type))
              .slice(0, limit - importantEntries.length)
            importantEntries.push(...otherEntries)
          }

          selectedEntries = importantEntries
        }

        eventData.entries = selectedEntries.map(extractEssentialEventEntry)

        eventData.pagination_info = {
          total_entries: totalEntries,
          showing: eventData.entries.length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entry_types: eventData.entries.map((e: any) => e.type),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          available_types: [...new Set(eventData.entries.map((e: any) => e.type))],
          tip: args.entry_type
            ? `Showing only '${args.entry_type}' entries. Remove entry_type parameter to see prioritized entries.`
            : "Showing prioritized entries. Use entry_type='exception' to see only stack traces.",
        }
      }

      // _meta is Sentry's data-scrubbing annotation tree (which chars were
      // redacted, by which rule, at which offset). It mirrors `entries` and is
      // pure noise for debugging — the actual values are already in entries.
      // On real events it dominates the payload (~80%+), so drop it.
      const fieldsToRemove = ["_meta", "sdk", "packages", "contexts", "user", "request", "environment"]
      for (const field of fieldsToRemove) {
        if (eventData[field]) {
          eventData[`_${field}_removed`] = true
          delete eventData[field]
        }
      }

      const { data: responseData, truncated, pagination_info } = truncateResponse(eventData)

      return jsonResult(responseData, truncated && pagination_info ? pagination_info : undefined)
    },
  )
}
