#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError } from 'axios';

// Read configuration from environment variables
const SENTRY_URL = process.env.SENTRY_URL;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG_SLUG = process.env.SENTRY_ORG_SLUG; // Added Org Slug

if (!SENTRY_URL) {
  throw new Error('SENTRY_URL environment variable is required');
}
if (!SENTRY_AUTH_TOKEN) {
  throw new Error('SENTRY_AUTH_TOKEN environment variable is required');
}
if (!SENTRY_ORG_SLUG) {
  // Try to extract from token if not provided, otherwise throw error
   console.warn('SENTRY_ORG_SLUG environment variable not set. Attempting to infer from token (this might fail).');
   // Basic extraction attempt - assumes standard token format
   try {
       const tokenPayload = JSON.parse(Buffer.from(SENTRY_AUTH_TOKEN.split('_')[1], 'base64').toString());
       if (tokenPayload.org) {
           process.env.SENTRY_ORG_SLUG = tokenPayload.org; // Set it for later use
           console.warn(`Inferred SENTRY_ORG_SLUG as: ${tokenPayload.org}`);
       } else {
            throw new Error('SENTRY_ORG_SLUG environment variable is required and could not be inferred from token.');
       }
   } catch (e) {
       throw new Error('SENTRY_ORG_SLUG environment variable is required and could not be inferred from token.');
   }

}


// Validate the URL format basic check
try {
  new URL(SENTRY_URL);
} catch (e) {
  throw new Error(`Invalid SENTRY_URL format: ${SENTRY_URL}`);
}

// Ensure URL doesn't end with a slash for consistency
const SENTRY_BASE_URL = SENTRY_URL.endsWith('/') ? SENTRY_URL.slice(0, -1) : SENTRY_URL;
const ORG_SLUG = process.env.SENTRY_ORG_SLUG; // Use the potentially inferred value

// --- Argument Type Guards ---
const isValidGetIssueArgs = (args: any): args is {
  issue_id_or_url: string;
  include_fields?: string[];
  exclude_fields?: string[];
  grep_pattern?: string;
  max_stack_frames?: number;
} =>
  typeof args === 'object' && args !== null && typeof args.issue_id_or_url === 'string' &&
  (args.include_fields === undefined || Array.isArray(args.include_fields)) &&
  (args.exclude_fields === undefined || Array.isArray(args.exclude_fields)) &&
  (args.grep_pattern === undefined || typeof args.grep_pattern === 'string') &&
  (args.max_stack_frames === undefined || typeof args.max_stack_frames === 'number');

const isValidListIssuesArgs = (args: any): args is { project_slug: string; query?: string; status?: string } =>
  typeof args === 'object' && args !== null && typeof args.project_slug === 'string' &&
  (args.query === undefined || typeof args.query === 'string') &&
  (args.status === undefined || typeof args.status === 'string');

const isValidGetEventArgs = (args: any): args is { project_slug: string; event_id: string } =>
    typeof args === 'object' && args !== null && typeof args.project_slug === 'string' && typeof args.event_id === 'string';

const isValidUpdateIssueArgs = (args: any): args is { issue_id: string; status: 'resolved' | 'ignored' | 'unresolved' } =>
    typeof args === 'object' && args !== null && typeof args.issue_id === 'string' &&
    typeof args.status === 'string' && ['resolved', 'ignored', 'unresolved'].includes(args.status);

const isValidCreateCommentArgs = (args: any): args is { issue_id: string; comment_text: string } =>
    typeof args === 'object' && args !== null && typeof args.issue_id === 'string' && typeof args.comment_text === 'string';


// --- Helper Functions ---
const getIssueId = (input: string): string | null => {
  try {
    const url = new URL(input);
    const pathParts = url.pathname.split('/');
    const issuesIndex = pathParts.indexOf('issues');
    if (issuesIndex !== -1 && pathParts.length > issuesIndex + 1) {
      const potentialId = pathParts[issuesIndex + 1];
      if (/^\d+$/.test(potentialId)) return potentialId;
    }
  } catch (e) {
    if (/^\d+$/.test(input)) return input;
  }
  return null;
};

// Filter object fields based on include/exclude lists
const filterObjectFields = (obj: any, includeFields?: string[], excludeFields?: string[]): any => {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => filterObjectFields(item, includeFields, excludeFields));
  }

  let result: any = {};

  // If include fields specified, only include those
  if (includeFields && includeFields.length > 0) {
    for (const field of includeFields) {
      if (field.includes('.')) {
        // Handle nested field paths like "latest_event.entries"
        const [parent, ...rest] = field.split('.');
        if (obj[parent] !== undefined) {
          if (!result[parent]) result[parent] = {};
          const childField = rest.join('.');
          result[parent] = filterObjectFields(obj[parent], [childField], undefined);
        }
      } else if (obj[field] !== undefined) {
        result[field] = obj[field];
      }
    }
  } else {
    // Start with all fields
    result = { ...obj };

    // Remove excluded fields
    if (excludeFields && excludeFields.length > 0) {
      for (const field of excludeFields) {
        if (field.includes('.')) {
          // Handle nested field paths
          const [parent, ...rest] = field.split('.');
          if (result[parent]) {
            const childField = rest.join('.');
            result[parent] = filterObjectFields(result[parent], undefined, [childField]);
          }
        } else {
          delete result[field];
        }
      }
    }
  }

  return result;
};

// Apply grep pattern filtering to JSON content
const grepFilter = (data: any, pattern: string): any => {
  const regex = new RegExp(pattern, 'gi');
  const jsonStr = JSON.stringify(data, null, 2);
  const lines = jsonStr.split('\n');
  const matchingLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      // Include context (previous and next line)
      if (i > 0) matchingLines.push(lines[i - 1]);
      matchingLines.push(lines[i]);
      if (i < lines.length - 1) matchingLines.push(lines[i + 1]);
    }
  }

  // Try to parse the filtered content, fall back to text if invalid JSON
  const filtered = matchingLines.join('\n');
  try {
    return JSON.parse(filtered);
  } catch {
    return { grep_results: matchingLines, original_pattern: pattern };
  }
};

// Truncate stack traces to specified number of frames
const truncateStackTraces = (data: any, maxFrames: number): any => {
  if (!data || typeof data !== 'object') return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => truncateStackTraces(item, maxFrames));
  }

  // Clone the object
  const result = { ...data };

  // Look for stack trace patterns
  if (result.entries && Array.isArray(result.entries)) {
    result.entries = result.entries.map((entry: any) => {
      if (entry.type === 'exception' && entry.data?.values) {
        entry.data.values = entry.data.values.map((value: any) => {
          if (value.stacktrace?.frames && Array.isArray(value.stacktrace.frames)) {
            // Keep only the most relevant frames (usually the last ones are most relevant)
            const frames = value.stacktrace.frames;
            if (frames.length > maxFrames) {
              value.stacktrace.frames = frames.slice(-maxFrames);
              value.stacktrace.frames_omitted = frames.length - maxFrames;
            }
          }
          return value;
        });
      }
      return entry;
    });
  }

  // Recursively process nested objects
  for (const key in result) {
    if (typeof result[key] === 'object') {
      result[key] = truncateStackTraces(result[key], maxFrames);
    }
  }

  return result;
};

// --- Main Server Class ---
class SelfHostedSentryServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'sentry-selfhosted-mcp',
        version: '0.2.1', // Added filtering capabilities
        description: 'MCP server for self-hosted Sentry instances with extended tools and filtering.',
      },
      { capabilities: { resources: {}, tools: {} } }
    );

    this.axiosInstance = axios.create({
      baseURL: `${SENTRY_BASE_URL}/api/0/`,
      headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 20000, // Increased timeout slightly
    });

    this.setupToolHandlers();
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => { await this.server.close(); process.exit(0); });
  }

  private setupToolHandlers() {
    // --- List Tools ---
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_sentry_issue",
          description:
            "Retrieve details for a specific Sentry issue by ID or URL, including the stacktrace from the latest event. Supports filtering to reduce response size.",
          inputSchema: {
            type: "object",
            properties: {
              issue_id_or_url: {
                type: "string",
                description:
                  "Sentry issue ID or full issue URL. Issue ID is a number e.g: 123456",
              },
              include_fields: {
                type: "array",
                items: { type: "string" },
                description:
                  "Optional: List of fields to include (whitelist). Use dot notation for nested fields (e.g., 'latest_event.entries'). If specified, only these fields will be returned.",
              },
              exclude_fields: {
                type: "array",
                items: { type: "string" },
                description:
                  "Optional: List of fields to exclude (blacklist). Use dot notation for nested fields. Applied only if include_fields is not specified.",
              },
              grep_pattern: {
                type: "string",
                description:
                  "Optional: Regex pattern to filter response content. Returns only matching lines with context.",
              },
              max_stack_frames: {
                type: "number",
                description:
                  "Optional: Maximum number of stack trace frames to return (default: all). Keeps the most relevant (bottom) frames.",
              },
            },
            required: ["issue_id_or_url"],
          },
        },
        {
          name: "list_sentry_projects",
          description:
            "List all projects within the configured Sentry organization.",
          inputSchema: { type: "object", properties: {}, required: [] }, // No input args needed
        },
        {
          name: "list_sentry_issues",
          description:
            "List issues for a specific project, optionally filtering by query or status.",
          inputSchema: {
            type: "object",
            properties: {
              project_slug: {
                type: "string",
                description: 'The slug of the project (e.g., "my-web-app").',
              },
              query: {
                type: "string",
                description:
                  'Optional Sentry search query (e.g., "is:unresolved environment:production").',
              },
              status: {
                type: "string",
                enum: ["resolved", "unresolved", "ignored"],
                description: "Optional issue status filter.",
              },
            },
            required: ["project_slug"],
          },
        },
        {
          name: "get_sentry_event_details",
          description:
            "Retrieve details for a specific event ID within a project.",
          inputSchema: {
            type: "object",
            properties: {
              project_slug: {
                type: "string",
                description: "The slug of the project.",
              },
              event_id: { type: "string", description: "The ID of the event." },
            },
            required: ["project_slug", "event_id"],
          },
        },
        {
          name: "update_sentry_issue_status",
          description: "Update the status of a Sentry issue.",
          inputSchema: {
            type: "object",
            properties: {
              issue_id: {
                type: "string",
                description: "The ID of the issue to update.",
              },
              status: {
                type: "string",
                enum: ["resolved", "ignored", "unresolved"],
                description: "The new status for the issue.",
              },
            },
            required: ["issue_id", "status"],
          },
        },
        {
          name: "create_sentry_issue_comment",
          description: "Add a comment to a Sentry issue.",
          inputSchema: {
            type: "object",
            properties: {
              issue_id: {
                type: "string",
                description: "The ID of the issue to comment on.",
              },
              comment_text: {
                type: "string",
                description: "The text content of the comment.",
              },
            },
            required: ["issue_id", "comment_text"],
          },
        },
      ],
    }));

    // --- Call Tool ---
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments;

      try {
        // --- get_sentry_issue ---
        if (toolName === "get_sentry_issue") {
          if (!isValidGetIssueArgs(args))
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid args for get_sentry_issue."
            );
          const issueId = getIssueId(args.issue_id_or_url);
          if (!issueId)
            throw new McpError(
              ErrorCode.InvalidParams,
              `Could not extract issue ID from: ${args.issue_id_or_url}`
            );
          console.error(
            `Fetching Sentry issue ${issueId} from ${SENTRY_BASE_URL}`
          );
          const issueResponse = await this.axiosInstance.get(
            `issues/${issueId}/`
          );
          const issueData = issueResponse.data;

          let combinedData: any = { ...issueData, latest_event: null };

          try {
            console.error(
              `Fetching latest event for issue ${issueId} in org ${ORG_SLUG}`
            );
            const eventResponse = await this.axiosInstance.get(
              `organizations/${ORG_SLUG}/issues/${issueId}/events/latest/`
            );
            combinedData.latest_event = eventResponse.data;
          } catch (eventError) {
            console.warn(
              `Could not fetch latest event for issue ${issueId}. It might not have any events or there was an API error.`,
              eventError
            );
          }

          // Apply filtering if specified
          if (args.max_stack_frames) {
            console.error(`Truncating stack traces to ${args.max_stack_frames} frames`);
            combinedData = truncateStackTraces(combinedData, args.max_stack_frames);
          }

          if (args.include_fields || args.exclude_fields) {
            console.error(`Applying field filters - include: ${args.include_fields?.join(', ') || 'none'}, exclude: ${args.exclude_fields?.join(', ') || 'none'}`);
            combinedData = filterObjectFields(combinedData, args.include_fields, args.exclude_fields);
          }

          if (args.grep_pattern) {
            console.error(`Applying grep pattern filter: ${args.grep_pattern}`);
            combinedData = grepFilter(combinedData, args.grep_pattern);
          }

          return {
            content: [
              { type: "text", text: JSON.stringify(combinedData, null, 2) },
            ],
          };
        }
        // --- list_sentry_projects ---
        else if (toolName === "list_sentry_projects") {
          console.error(`Fetching projects for org ${ORG_SLUG}`);
          const response = await this.axiosInstance.get(
            `organizations/${ORG_SLUG}/projects/`
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response.data, null, 2) },
            ],
          };
        }
        // --- list_sentry_issues ---
        else if (toolName === "list_sentry_issues") {
          if (!isValidListIssuesArgs(args))
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid args for list_sentry_issues."
            );
          const params: Record<string, string> = {};
          if (args.query) params.query = args.query;
          if (args.status)
            params.query =
              (params.query ? params.query + " " : "") + `is:${args.status}`; // Append status to query

          console.error(
            `Fetching issues for project ${args.project_slug} in org ${ORG_SLUG} with params:`,
            params
          );
          const response = await this.axiosInstance.get(
            `projects/${ORG_SLUG}/${args.project_slug}/issues/`,
            { params }
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response.data, null, 2) },
            ],
          };
        }
        // --- get_sentry_event_details ---
        else if (toolName === "get_sentry_event_details") {
          if (!isValidGetEventArgs(args))
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid args for get_sentry_event_details."
            );
          console.error(
            `Fetching event ${args.event_id} for project ${args.project_slug} in org ${ORG_SLUG}`
          );
          // Note: Sentry API might use issue ID for event context, or this endpoint might work. Adjust if needed.
          const response = await this.axiosInstance.get(
            `projects/${ORG_SLUG}/${args.project_slug}/events/${args.event_id}/`
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response.data, null, 2) },
            ],
          };
        }
        // --- update_sentry_issue_status ---
        else if (toolName === "update_sentry_issue_status") {
          if (!isValidUpdateIssueArgs(args))
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid args for update_sentry_issue_status."
            );
          console.error(
            `Updating issue ${args.issue_id} status to ${args.status}`
          );
          const response = await this.axiosInstance.put(
            `issues/${args.issue_id}/`,
            { status: args.status }
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response.data, null, 2) },
            ],
          };
        }
        // --- create_sentry_issue_comment ---
        else if (toolName === "create_sentry_issue_comment") {
          if (!isValidCreateCommentArgs(args))
            throw new McpError(
              ErrorCode.InvalidParams,
              "Invalid args for create_sentry_issue_comment."
            );
          console.error(`Adding comment to issue ${args.issue_id}`);
          const response = await this.axiosInstance.post(
            `issues/${args.issue_id}/comments/`,
            { text: args.comment_text }
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response.data, null, 2) },
            ],
          };
        }
        // --- Unknown Tool ---
        else {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${toolName}`
          );
        }
      } catch (error) {
        console.error(`Error calling tool ${toolName}:`, error);
        let errorMessage = `Failed to execute tool ${toolName}.`;
        let isClientError = false; // Flag for 4xx errors

        if (axios.isAxiosError(error)) {
          errorMessage = `Sentry API error for ${toolName}: ${error.message}`;
          if (error.response) {
            errorMessage += ` Status: ${
              error.response.status
            }. Response: ${JSON.stringify(error.response.data)}`;
            if (error.response.status >= 400 && error.response.status < 500) {
              isClientError = true; // Indicate it's likely a bad request (permissions, not found, bad args)
              if (
                error.response.status === 401 ||
                error.response.status === 403
              ) {
                errorMessage = `Sentry API permission denied for ${toolName}. Check auth token validity and permissions.`;
              } else if (error.response.status === 404) {
                errorMessage = `Sentry resource not found for ${toolName}. Check IDs/slugs.`;
              }
            }
          }
        } else if (error instanceof McpError) {
          // If it's already an McpError (like InvalidParams), re-throw it directly
          throw error;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        // Return structured error for MCP
        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true,
          // Optionally use InvalidRequest for client-side errors (4xx)
          // errorCode: isClientError ? ErrorCode.InvalidRequest : ErrorCode.InternalError
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`Self-hosted Sentry MCP server v0.2.1 running for org "${ORG_SLUG}" at ${SENTRY_BASE_URL}`);
  }
}

const server = new SelfHostedSentryServer();
server.run().catch(error => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
