import assert from "node:assert/strict"
import { test } from "node:test"
import { errorMessage } from "../build/api-client.js"
import { eventPath, parseSentryRef } from "../build/helpers/ref.js"

const EV = "0123456789abcdef0123456789abcdef"

test("parses IDs, short IDs and event IDs", () => {
  assert.deepEqual(parseSentryRef("123456"), { issueId: "123456" })
  assert.deepEqual(parseSentryRef("API-DATA-1A"), { shortId: "API-DATA-1A" })
  assert.deepEqual(parseSentryRef(EV.toUpperCase()), { eventId: EV })
  assert.deepEqual(parseSentryRef("not a ref"), {})
})

test("parses Sentry URLs", () => {
  assert.deepEqual(
    parseSentryRef(`https://sentry.x/organizations/blue/issues/42/events/${EV}/?project=3`),
    { issueId: "42", eventId: EV },
  )
  assert.deepEqual(parseSentryRef("https://blue.sentry.x/issues/42/"), { issueId: "42" })
  assert.deepEqual(parseSentryRef("https://sentry.x/blue/api-data/issues/42/"), {
    issueId: "42",
    projectSlug: "api-data",
  })
  assert.deepEqual(parseSentryRef(`https://sentry.x/organizations/blue/discover/api-data:${EV}/`), {
    projectSlug: "api-data",
    eventId: EV,
  })
})

test("locates an event by project, or by the issue in its URL", () => {
  assert.equal(eventPath("blue", EV, "api"), `projects/blue/api/events/${EV}/`)
  assert.equal(
    eventPath("blue", `https://sentry.x/organizations/blue/issues/42/events/${EV}/`),
    `organizations/blue/issues/42/events/${EV}/`,
  )
  assert.throws(() => eventPath("blue", EV), /project_slug is required/)
})

test("error messages say what to fix", () => {
  assert.match(
    errorMessage("PUT", "issues/1/", 403, { detail: "nope" }),
    /scope.*\(PUT issues\/1\/\) — nope/,
  )
  assert.match(errorMessage("GET", "issues/9/", 404, "Not Found"), /^Not found/)
})
