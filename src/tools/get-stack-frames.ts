import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { jsonResult } from "../helpers/index.js"

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "get_stack_frames",
    "Extract structured stack frames from an event (function, file, line, in_app). More efficient than raw_sentry_api for stack analysis.",
    {
      project_slug: z.string().describe("The slug of the project (e.g., 'apple-ios')"),
      event_id: z.string().describe("The event ID to extract stack frames from"),
      in_app_only: z
        .boolean()
        .default(false)
        .describe(
          "Only app-code frames (exclude system/library). Default: false.",
        ),
      max_frames: z
        .number()
        .default(50)
        .describe(
          "Max frames (default 50), kept from bottom of stack (most recent).",
        ),
    },
    async (args) => {
      console.error(
        `Extracting stack frames from event ${args.event_id} in project ${args.project_slug}`,
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventData = await api.get<any>(
        `projects/${orgSlug}/${args.project_slug}/events/${args.event_id}/`,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const frames: any[] = []

      if (eventData.entries && Array.isArray(eventData.entries)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const entry of eventData.entries as any[]) {
          if (entry.type === "exception" && entry.data?.values) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const exc of entry.data.values as any[]) {
              if (exc.stacktrace?.frames) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const frame of exc.stacktrace.frames as any[]) {
                  if (args.in_app_only && !frame.in_app) continue

                  frames.push({
                    function: frame.function || frame.rawFunction || "<unknown>",
                    filename: frame.filename || frame.absPath || null,
                    line_no: frame.lineNo || null,
                    col_no: frame.colNo || null,
                    in_app: frame.in_app || false,
                    module: frame.module || null,
                    package: frame.package || null,
                    instruction_addr: frame.instructionAddr || null,
                    symbol_addr: frame.symbolAddr || null,
                  })
                }
              }
            }
          }
        }
      }

      const limitedFrames = frames.slice(-args.max_frames)

      return jsonResult({
        event_id: args.event_id,
        total_frames: frames.length,
        returned_frames: limitedFrames.length,
        in_app_only: args.in_app_only,
        frames: limitedFrames,
      })
    },
  )
}
