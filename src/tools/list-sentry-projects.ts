import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApiClient } from "../api-client.js"
import { jsonResult } from "../helpers/index.js"

interface Project {
  id: string
  slug: string
  name: string
  platform?: string | null
}

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    "list_sentry_projects",
    "List the projects of the configured organization: slug, name, platform.",
    {},
    async () => {
      console.error(`Fetching projects for org ${orgSlug}`)
      const data = await api.get<Project[]>(`organizations/${orgSlug}/projects/`)
      // The full project objects weigh ~14K tokens per call: only the identifiers are kept.
      return jsonResult(
        data.map((p) => ({ slug: p.slug, name: p.name, platform: p.platform, id: p.id })),
      )
    },
  )
}
