import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';
import { extractEssentialEventEntry, truncateResponse } from '../helpers/index.js';

export function register(server: McpServer, api: ApiClient, orgSlug: string) {
  server.tool(
    'get_sentry_event_details',
    'Retrieve details for a specific event ID within a project. IMPORTANT: For large events, always use limit parameter (e.g., limit: 10) to avoid token limits. Use offset for pagination.',
    {
      project_slug: z.string().describe('The slug of the project.'),
      event_id: z.string().describe('The ID of the event.'),
      limit: z.number().min(1).default(10).describe('RECOMMENDED: Limit the number of entries returned (e.g., 10 for large stack traces). Use this to avoid exceeding token limits.'),
      offset: z.number().min(0).default(0).describe('Offset for pagination through event entries. Start with 0, then use 10, 20, etc.'),
      entry_type: z.enum(['exception', 'message', 'breadcrumbs', 'request', 'threads', 'debugmeta', 'contexts']).optional().describe("Filter to only get specific entry type (e.g., 'exception', 'message', 'breadcrumbs'). By default returns most important entries."),
    },
    async (args) => {
      console.error(`Fetching event ${args.event_id} for project ${args.project_slug}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventData: any = await api.get(`projects/${orgSlug}/${args.project_slug}/events/${args.event_id}/`);

      const offset = args.offset;
      const limit = args.limit;

      if (eventData.entries && Array.isArray(eventData.entries)) {
        const totalEntries = eventData.entries.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allEntries = [...eventData.entries] as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let selectedEntries: any[];

        if (args.entry_type) {
          selectedEntries = eventData.entries
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((e: any) => e.type === args.entry_type)
            .slice(offset, offset + limit);

          if (selectedEntries.length === 0) {
            eventData.entries = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eventData.error = `No entries of type '${args.entry_type}' found. Available types: ${[...new Set(allEntries.map((e: any) => e.type))].join(', ')}`;
          }
        } else {
          const priorityTypes = ['exception', 'message', 'breadcrumbs', 'request'];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const importantEntries: any[] = [];

          for (const type of priorityTypes) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entry = eventData.entries.find((e: any) => e.type === type);
            if (entry && importantEntries.length < limit) {
              importantEntries.push(entry);
            }
          }

          if (importantEntries.length < limit) {
            const otherEntries = eventData.entries
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((e: any) => !priorityTypes.includes(e.type))
              .slice(0, limit - importantEntries.length);
            importantEntries.push(...otherEntries);
          }

          selectedEntries = importantEntries;
        }

        eventData.entries = selectedEntries.map(extractEssentialEventEntry);

        eventData.pagination_info = {
          total_entries: totalEntries,
          showing: eventData.entries.length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          entry_types: eventData.entries.map((e: any) => e.type),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          available_types: [...new Set(eventData.entries.map((e: any) => e.type))],
          tip: args.entry_type
            ? `Showing only '${args.entry_type}' entries. Remove entry_type parameter to see prioritized entries.`
            : "Showing prioritized entries. Use entry_type='exception' to see only stack traces.",
        };
      }

      const fieldsToRemove = ['sdk', 'packages', 'contexts', 'user', 'request', 'environment'];
      for (const field of fieldsToRemove) {
        if (eventData[field]) {
          eventData[`_${field}_removed`] = true;
          delete eventData[field];
        }
      }

      const { data: responseData, truncated, pagination_info } = truncateResponse(eventData);

      let resultText = JSON.stringify(responseData, null, 2);
      if (truncated && pagination_info) {
        resultText = `${pagination_info}\n\n${resultText}`;
      }

      return { content: [{ type: 'text' as const, text: resultText }] };
    },
  );
}
