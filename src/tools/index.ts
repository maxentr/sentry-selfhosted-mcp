import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';

import * as getSentryIssue from './get-sentry-issue.js';
import * as listSentryProjects from './list-sentry-projects.js';
import * as listSentryIssues from './list-sentry-issues.js';
import * as getSentryEventDetails from './get-sentry-event-details.js';
import * as updateSentryIssueStatus from './update-sentry-issue-status.js';
import * as createSentryIssueComment from './create-sentry-issue-comment.js';
import * as rawSentryApi from './raw-sentry-api.js';
import * as getStackFrames from './get-stack-frames.js';
import * as checkDsymStatus from './check-dsym-status.js';

export function registerAllTools(server: McpServer, api: ApiClient, orgSlug: string) {
  getSentryIssue.register(server, api, orgSlug);
  listSentryProjects.register(server, api, orgSlug);
  listSentryIssues.register(server, api, orgSlug);
  getSentryEventDetails.register(server, api, orgSlug);
  updateSentryIssueStatus.register(server, api, orgSlug);
  createSentryIssueComment.register(server, api, orgSlug);
  rawSentryApi.register(server, api, orgSlug);
  getStackFrames.register(server, api, orgSlug);
  checkDsymStatus.register(server, api, orgSlug);
}
