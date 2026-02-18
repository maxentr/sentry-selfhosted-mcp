export function getIssueId(input: string): string | null {
  try {
    const url = new URL(input);
    const pathParts = url.pathname.split('/');
    const issuesIndex = pathParts.indexOf('issues');
    if (issuesIndex !== -1 && pathParts.length > issuesIndex + 1) {
      const potentialId = pathParts[issuesIndex + 1];
      if (/^\d+$/.test(potentialId)) return potentialId;
    }
  } catch {
    if (/^\d+$/.test(input)) return input;
  }
  return null;
}

export function extractEssentialIssueFields(issueData: Record<string, unknown>): Record<string, unknown> {
  const essential: Record<string, unknown> = {
    id: issueData.id,
    shortId: issueData.shortId,
    title: issueData.title,
    culprit: issueData.culprit,
    permalink: issueData.permalink,
    logger: issueData.logger,
    level: issueData.level,
    status: issueData.status,
    type: issueData.type,
    platform: issueData.platform,
    project: issueData.project,
    count: issueData.count,
    userCount: issueData.userCount,
    firstSeen: issueData.firstSeen,
    lastSeen: issueData.lastSeen,
    metadata: issueData.metadata,
  };

  if (issueData.annotations || issueData.context || issueData.tags) {
    essential._note = 'Full issue details truncated. Use get_sentry_event_details for stack traces and event data.';
  }

  return essential;
}
