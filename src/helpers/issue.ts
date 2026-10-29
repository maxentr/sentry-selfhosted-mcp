export function extractEssentialIssueFields(
  issueData: Record<string, unknown>,
): Record<string, unknown> {
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
  }

  if (issueData.annotations || issueData.context || issueData.tags) {
    essential._note =
      "Full issue details truncated. Use get_sentry_event_details for stack traces and event data."
  }

  return essential
}
