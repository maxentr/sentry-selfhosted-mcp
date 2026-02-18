import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';

export function register(server: McpServer, api: ApiClient, _orgSlug: string) {
  server.tool(
    'update_sentry_issue_status',
    'Update the status of a Sentry issue.',
    {
      issue_id: z.string().describe('The ID of the issue to update.'),
      status: z.enum(['resolved', 'ignored', 'unresolved']).describe('The new status for the issue.'),
    },
    async (args) => {
      console.error(`Updating issue ${args.issue_id} status to ${args.status}`);
      const data = await api.put(`issues/${args.issue_id}/`, { status: args.status });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
