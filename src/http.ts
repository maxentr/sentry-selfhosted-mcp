import { randomUUID } from "node:crypto"
import { createServer, type IncomingMessage } from "node:http"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"

export interface HttpOptions {
  host: string
  port: number
  path: string
}

export function httpOptionsFromEnv(): HttpOptions {
  const port = Number(process.env.MCP_HTTP_PORT ?? "8080")
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid MCP_HTTP_PORT: ${process.env.MCP_HTTP_PORT}`)
  }
  return {
    host: process.env.MCP_HTTP_HOST ?? "127.0.0.1",
    port,
    path: process.env.MCP_HTTP_PATH ?? "/mcp",
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString("utf8")
  return text.length === 0 ? undefined : JSON.parse(text)
}

/**
 * Streamable HTTP: one process serves many clients, each with its own MCP session (and its own
 * McpServer, since a server connects to a single transport).
 */
export function startHttpServer(createMcpServer: () => McpServer, options: HttpOptions) {
  const { host, port, path } = options
  const transports = new Map<string, StreamableHTTPServerTransport>()
  // Loopback by default: the Host check blocks DNS rebinding from a browser page.
  const allowedHosts = [`${host}:${port}`, `localhost:${port}`, `127.0.0.1:${port}`]

  const httpServer = createServer(async (req, res) => {
    try {
      if (new URL(req.url ?? "/", "http://localhost").pathname !== path) {
        res.writeHead(404).end()
        return
      }
      const body = req.method === "POST" ? await readJsonBody(req) : undefined
      const sessionId = req.headers["mcp-session-id"]
      let transport = typeof sessionId === "string" ? transports.get(sessionId) : undefined

      if (!transport) {
        if (req.method !== "POST" || !isInitializeRequest(body)) {
          res.writeHead(400, { "content-type": "application/json" }).end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32000, message: "Bad request: no valid session ID" },
              id: null,
            }),
          )
          return
        }
        const created = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, created)
          },
          enableDnsRebindingProtection: true,
          allowedHosts,
        })
        created.onclose = () => {
          if (created.sessionId) transports.delete(created.sessionId)
        }
        await createMcpServer().connect(created)
        transport = created
      }

      await transport.handleRequest(req, res, body)
    } catch (error) {
      console.error("MCP HTTP request failed:", error)
      if (!res.headersSent) res.writeHead(500).end()
    }
  })

  return new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject)
    httpServer.listen(port, host, () => {
      console.error(`Self-hosted Sentry MCP server listening on http://${host}:${port}${path}`)
      resolve()
    })
  })
}
