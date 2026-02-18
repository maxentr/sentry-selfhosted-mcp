import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { ApiClient } from "./api-client.js"
import { loadConfig } from "./config.js"
import { registerAllTools } from "./tools/index.js"

export async function startServer() {
  const config = loadConfig()

  const server = new McpServer({
    name: "sentry-selfhosted-mcp",
    version: "1.0.0",
  })

  const api = new ApiClient(config.baseUrl, config.authToken)

  registerAllTools(server, api, config.orgSlug)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error(
    `Self-hosted Sentry MCP server v1.0.0 running for org "${config.orgSlug}" at ${config.baseUrl}`,
  )
}
