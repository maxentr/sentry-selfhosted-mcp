import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    'list_sentry_projects',
    'List all projects within the configured Sentry organization.',
    {},
    async () => {
      console.error(`Fetching projects for org ${orgSlug}`);
      const data = await api.get(`organizations/${orgSlug}/projects/`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
