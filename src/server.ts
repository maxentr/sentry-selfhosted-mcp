import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { ApiClient } from "./api-client.js"
import { loadConfig } from "./config.js"
import { httpOptionsFromEnv, startHttpServer } from "./http.js"
import { registerAllTools } from "./tools/index.js"

const VERSION = "1.3.0"

export async function startServer() {
  const config = loadConfig()
  const api = new ApiClient(config.baseUrl, config.authToken)

  const createMcpServer = () => {
    const server = new McpServer({ name: "sentry-selfhosted-mcp", version: VERSION })
    registerAllTools(server, api, config.orgSlug)
    return server
  }

  if (process.env.MCP_TRANSPORT === "http") {
    await startHttpServer(createMcpServer, httpOptionsFromEnv())
    return
  }

  await createMcpServer().connect(new StdioServerTransport())

  console.error(
    `Self-hosted Sentry MCP server v${VERSION} running for org "${config.orgSlug}" at ${config.baseUrl}`,
  )
}
