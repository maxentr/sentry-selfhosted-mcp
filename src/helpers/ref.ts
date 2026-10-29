import type { ApiClient } from "../api-client.js"

/** What a pasted Sentry reference points to. */
export interface SentryRef {
  issueId?: string
  shortId?: string
  eventId?: string
  projectSlug?: string
}

const EVENT_ID = /^[0-9a-f]{32}$/i
// Short IDs look like `API-DATA-1A`: a project prefix, a dash, a base-36 counter.
const SHORT_ID = /^[A-Z0-9][A-Z0-9-]*-[A-Z0-9]+$/

/**
 * Accepts a numeric issue ID, a short ID, a 32-hex event ID, or any Sentry URL:
 * `/organizations/{org}/issues/{id}/events/{eventId}/`, `{org}.host/issues/{id}/`,
 * legacy `/{org}/{project}/issues/{id}/`, `/discover/{project}:{eventId}/`.
 */
export function parseSentryRef(input: string): SentryRef {
  const text = input.trim()
  if (/^\d+$/.test(text)) return { issueId: text }
  if (EVENT_ID.test(text)) return { eventId: text.toLowerCase() }
  if (SHORT_ID.test(text) && /[A-Z]/.test(text)) return { shortId: text }

  let parts: string[]
  try {
    parts = new URL(text).pathname.split("/").filter((p) => p.length > 0)
  } catch {
    return {}
  }
  const ref: SentryRef = {}
  const issues = parts.indexOf("issues")
  const issue = issues === -1 ? undefined : parts[issues + 1]
  if (issue !== undefined && /^\d+$/.test(issue)) ref.issueId = issue
  if (issue !== undefined && SHORT_ID.test(issue)) ref.shortId = issue
  // Legacy layout: /{org}/{project}/issues/{id}/
  if (issues === 2 && parts[0] !== "organizations") ref.projectSlug = parts[1]
  const events = parts.indexOf("events")
  const event = events === -1 ? undefined : parts[events + 1]
  if (event !== undefined && EVENT_ID.test(event)) ref.eventId = event.toLowerCase()
  const discover = parts.indexOf("discover")
  const pair = discover === -1 ? undefined : parts[discover + 1]?.split(":")
  if (pair?.length === 2 && EVENT_ID.test(pair[1] ?? "")) {
    ref.projectSlug = pair[0]
    ref.eventId = pair[1]?.toLowerCase()
  }
  return ref
}

/** Numeric issue ID from an ID, a short ID or an issue URL; null when the input names no issue. */
export async function resolveIssueId(
  api: ApiClient,
  orgSlug: string,
  input: string,
): Promise<string | null> {
  const ref = parseSentryRef(input)
  if (ref.issueId) return ref.issueId
  if (!ref.shortId) return null
  const data = await api.get<{ groupId?: string }>(
    `organizations/${orgSlug}/shortids/${ref.shortId}/`,
  )
  return data.groupId ?? null
}

/**
 * Event endpoint for an event ID or event URL. A project slug or an issue ID locates it:
 * an event URL from the issue page carries the issue ID, so no project slug is needed.
 */
export function eventPath(orgSlug: string, eventInput: string, projectSlug?: string): string {
  const ref = parseSentryRef(eventInput)
  const eventId = ref.eventId
  if (!eventId) throw new Error(`Not an event ID or event URL: ${eventInput}`)
  const project = projectSlug ?? ref.projectSlug
  if (project) return `projects/${orgSlug}/${project}/events/${eventId}/`
  if (ref.issueId) return `organizations/${orgSlug}/issues/${ref.issueId}/events/${eventId}/`
  throw new Error("project_slug is required with a bare event ID (or pass the event URL).")
}
