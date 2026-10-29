import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ApiClient } from "../api-client.js"
import { eventPath, jsonResult } from "../helpers/index.js"

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "get_stack_frames",
    "Extract structured stack frames from an event (function, file, line, in_app). More efficient than raw_sentry_api for stack analysis.",
    {
      event_id: z.string().describe("Event ID, or event URL (then project_slug is optional)."),
      project_slug: z.string().optional().describe("Project slug; needed with a bare event ID."),
      in_app_only: z
        .boolean()
        .default(true)
        .describe("Only app-code frames. Default true; falls back to all frames if none."),
      max_frames: z
        .number()
        .default(15)
        .describe("Max frames (default 15), kept from the crash end of the stack."),
    },
    async (args) => {
      console.error(
        `Extracting stack frames from event ${args.event_id} in project ${args.project_slug}`,
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventData = await api.get<any>(eventPath(orgSlug, args.event_id, args.project_slug))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allFrames: any[] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const entry of (eventData.entries ?? []) as any[]) {
        if (entry.type !== "exception") continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const exc of (entry.data?.values ?? []) as any[]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const frame of (exc.stacktrace?.frames ?? []) as any[]) {
            allFrames.push({
              function: frame.function || frame.rawFunction || "<unknown>",
              filename: frame.filename || frame.absPath,
              line_no: frame.lineNo,
              col_no: frame.colNo,
              // The REST API sends `inApp`; `in_app` is the SDK payload name.
              in_app: Boolean(frame.inApp ?? frame.in_app),
              module: frame.module,
              package: frame.package,
              instruction_addr: frame.instructionAddr,
              symbol_addr: frame.symbolAddr,
            })
          }
        }
      }
      const inApp = allFrames.filter((f) => f.in_app)
      const useInApp = args.in_app_only && inApp.length > 0
      const frames = useInApp ? inApp : allFrames

      const limitedFrames = frames.slice(-args.max_frames)

      return jsonResult({
        event_id: args.event_id,
        total_frames: frames.length,
        returned_frames: limitedFrames.length,
        in_app_only: useInApp,
        ...(args.in_app_only && !useInApp ? { _note: "No in-app frame: all frames shown." } : {}),
        frames: limitedFrames,
      })
    },
  )
}
