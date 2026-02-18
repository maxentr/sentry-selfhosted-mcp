import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';
import { grepFilter } from '../helpers/index.js';

export function register(server: McpServer, api: ApiClient, _orgSlug: string) {
  server.tool(
    'raw_sentry_api',
    'Make a raw API call to any Sentry endpoint. Returns unfiltered JSON that agents can process with grep_pattern or other filters. Useful for debugging or accessing data not covered by other tools. WARNING: Event endpoints can return 100K+ tokens. ALWAYS use grep_pattern for events to avoid token limits. Common patterns: \'"function":|"in_app":\' for stack frames, \'"type":\' for breadcrumbs.',
    {
      endpoint: z.string().describe("API endpoint path (e.g., 'projects/beoflow/apple-ios/events/abc123/'). Do NOT include /api/0/ prefix."),
      method: z.enum(['GET']).default('GET').describe('HTTP method (only GET allowed for safety)'),
      params: z.record(z.unknown()).optional().describe('URL query parameters as key-value pairs'),
      body: z.record(z.unknown()).optional().describe('Request body for POST/PUT requests'),
      grep_pattern: z.string().optional().describe('CRITICAL for event endpoints: Regex to filter response. Reduces 100K+ token responses to manageable size. Examples: \'"function":|"filename":|"in_app":true\' for stack traces, \'"breadcrumbs"\' for user actions, \'"tags"\' for metadata. Pattern matches return line + surrounding context.'),
    },
    async (args) => {
      console.error(`Raw API GET request to ${args.endpoint}`);

      const params: Record<string, string | number> | undefined = args.params
        ? Object.fromEntries(Object.entries(args.params).map(([k, v]) => [k, String(v)]))
        : undefined;

      const responseData = await api.get(args.endpoint, params);

      const jsonString = JSON.stringify(responseData, null, 2);
      const estimatedTokens = Math.ceil(jsonString.length / 4);

      if (estimatedTokens > 20000 && !args.grep_pattern) {
        console.error(`WARNING: Response is ~${estimatedTokens} tokens. Consider using grep_pattern.`);
        return {
          content: [{
            type: 'text' as const,
            text: `WARNING: Response is approximately ${estimatedTokens} tokens (limit: 25,000).\n\nThis endpoint returns a large amount of data. Please use grep_pattern to filter the response.\n\nSuggested patterns:\n- Stack traces: '"function":|"filename":|"in_app":true'\n- Breadcrumbs: '"breadcrumbs"'\n- Tags/metadata: '"tags"'\n- Error details: '"type":|"value":'\n\nExample: Add grep_pattern: '"function":|"in_app":' to your request.`,
          }],
        };
      }

      let result = responseData;
      if (args.grep_pattern) {
        console.error(`Applying grep pattern filter: ${args.grep_pattern}`);
        result = grepFilter(responseData, args.grep_pattern);
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
