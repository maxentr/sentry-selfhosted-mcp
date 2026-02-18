export interface Config {
  baseUrl: string
  authToken: string
  orgSlug: string
}

export function loadConfig(): Config {
  const sentryUrl = process.env.SENTRY_URL
  const authToken = process.env.SENTRY_AUTH_TOKEN
  let orgSlug = process.env.SENTRY_ORG_SLUG

  if (!sentryUrl) {
    throw new Error("SENTRY_URL environment variable is required")
  }
  if (!authToken) {
    throw new Error("SENTRY_AUTH_TOKEN environment variable is required")
  }

  if (!orgSlug) {
    console.warn("SENTRY_ORG_SLUG environment variable not set. Attempting to infer from token.")
    try {
      const tokenPayload = JSON.parse(Buffer.from(authToken.split("_")[1], "base64").toString())
      if (tokenPayload.org) {
        orgSlug = tokenPayload.org
        console.warn(`Inferred SENTRY_ORG_SLUG as: ${orgSlug}`)
      }

      if (!orgSlug) {
        throw new Error(
          "SENTRY_ORG_SLUG environment variable is required and could not be inferred from token.",
        )
      }
    } catch {
      throw new Error(
        "SENTRY_ORG_SLUG environment variable is required and could not be inferred from token.",
      )
    }
  }

  try {
    new URL(sentryUrl)
  } catch {
    throw new Error(`Invalid SENTRY_URL format: ${sentryUrl}`)
  }

  const baseUrl = sentryUrl.endsWith("/") ? sentryUrl.slice(0, -1) : sentryUrl

  return { baseUrl, authToken, orgSlug }
}
