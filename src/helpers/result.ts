// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean }

/**
 * Recursively drop null/undefined properties and array elements.
 * Sentry payloads carry many null fields (e.g. unset stack-frame columns,
 * module/package/address fields on JS/Python frames). For an LLM consumer a
 * null key is equivalent to an absent key, so removing them saves tokens
 * without losing information. false, 0, "", [] and {} are preserved because
 * they can be semantically meaningful (e.g. has_missing_symbols: false).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripNullish(value: any): any {
  if (Array.isArray(value)) {
    return value.filter((v) => v !== null && v !== undefined).map(stripNullish)
  }
  if (value && typeof value === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      if (v === null || v === undefined) continue
      out[k] = stripNullish(v)
    }
    return out
  }
  return value
}

/**
 * Build an MCP text result with compact JSON (no pretty-print whitespace).
 * Pretty-printing adds indentation/newlines that are pure tokens with zero
 * informational value, so responses are serialized compactly to save tokens
 * without losing any data. Null/undefined fields are stripped by default
 * (set strip:false to preserve the raw shape, e.g. for raw API passthrough).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonResult(data: any, prefix?: string, opts?: { strip?: boolean }): ToolResult {
  const payload = opts?.strip === false ? data : stripNullish(data)
  const json = JSON.stringify(payload)
  const text = prefix ? `${prefix}\n\n${json}` : json
  return { content: [{ type: "text", text }] }
}

export function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], isError: isError || undefined }
}

/** Estimate tokens for a value as emitted (compact JSON ≈ 4 chars/token). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function estimateTokens(data: any): number {
  return Math.ceil(JSON.stringify(data).length / 4)
}
