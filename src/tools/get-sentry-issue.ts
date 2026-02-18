import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';
import {
  getIssueId,
  extractEssentialIssueFields,
  extractEssentialEventEntry,
  truncateStackTraces,
  filterObjectFields,
  grepFilter,
} from '../helpers/index.js';

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    'get_sentry_issue',
    'Retrieve details for a specific Sentry issue by ID or URL, including the stacktrace from the latest event. Supports filtering and automatic truncation to reduce response size.',
    {
      issue_id_or_url: z.string().describe('Sentry issue ID or full issue URL. Issue ID is a number e.g: 123456'),
      include_latest_event: z.boolean().default(false).describe('Include latest event details (default: false to reduce response size)'),
      include_fields: z.array(z.string()).optional().describe("Optional: List of fields to include (whitelist). Use dot notation for nested fields (e.g., 'latest_event.entries'). If specified, only these fields will be returned."),
      exclude_fields: z.array(z.string()).optional().describe('Optional: List of fields to exclude (blacklist). Use dot notation for nested fields. Applied only if include_fields is not specified.'),
      grep_pattern: z.string().optional().describe('Optional: Regex pattern to filter response content. Returns only matching lines with context.'),
      max_stack_frames: z.number().optional().describe('Optional: Maximum number of stack trace frames to return (default: all). Keeps the most relevant (bottom) frames.'),
    },
    async (args) => {
      const issueId = getIssueId(args.issue_id_or_url);
      if (!issueId) {
        return { content: [{ type: 'text' as const, text: `Could not extract issue ID from: ${args.issue_id_or_url}` }], isError: true };
      }

      console.error(`Fetching Sentry issue ${issueId}`);
      const issueResponse = await api.get<Record<string, unknown>>(`issues/${issueId}/`);

      let issueData = extractEssentialIssueFields(issueResponse);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let combinedData: any = { ...issueData, latest_event: null };

      if (args.include_latest_event) {
        try {
          console.error(`Fetching latest event for issue ${issueId}`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eventResponse = await api.get<any>(`organizations/${orgSlug}/issues/${issueId}/events/latest/`);

          if (eventResponse.entries) {
            combinedData.latest_event = {
              id: eventResponse.id,
              eventID: eventResponse.eventID,
              dateCreated: eventResponse.dateCreated,
              entries: eventResponse.entries.slice(0, 3).map(extractEssentialEventEntry),
              _note: 'Event truncated. Use get_sentry_event_details for full event data.',
            };
          } else {
            combinedData.latest_event = eventResponse;
          }
        } catch (eventError) {
          console.warn(`Could not fetch latest event for issue ${issueId}.`, eventError);
        }
      }

      if (args.max_stack_frames) {
        combinedData = truncateStackTraces(combinedData, args.max_stack_frames);
      }

      if (args.include_fields || args.exclude_fields) {
        combinedData = filterObjectFields(combinedData, args.include_fields, args.exclude_fields);
      }

      if (args.grep_pattern) {
        combinedData = grepFilter(combinedData, args.grep_pattern);
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(combinedData, null, 2) }] };
    },
  );
}
