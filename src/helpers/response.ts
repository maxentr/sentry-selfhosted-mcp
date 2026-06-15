/* eslint-disable @typescript-eslint/no-explicit-any */

export function truncateResponse(
  data: any,
  maxTokens = 15000,
): { data: any; truncated: boolean; pagination_info?: string } {
  const jsonString = JSON.stringify(data)
  const estimatedTokens = Math.ceil(jsonString.length / 4)

  if (estimatedTokens <= maxTokens) {
    return { data, truncated: false }
  }

  if (Array.isArray(data)) {
    const itemsToKeep = Math.floor(data.length * (maxTokens / estimatedTokens))
    const truncatedData = data.slice(0, Math.max(1, itemsToKeep))
    return {
      data: truncatedData,
      truncated: true,
      pagination_info: `Response truncated. Showing ${truncatedData.length} of ${data.length} items. Use limit and cursor/offset parameters to paginate through all results.`,
    }
  }

  if (typeof data === "object" && data !== null) {
    const truncatedData = { ...data }
    const largeFields = [
      "entries",
      "stacktrace",
      "frames",
      "breadcrumbs",
      "contexts",
      "tags",
      "extra",
    ]

    for (const field of largeFields) {
      if (truncatedData[field] && Array.isArray(truncatedData[field])) {
        const originalLength = truncatedData[field].length
        if (originalLength > 10) {
          truncatedData[field] = truncatedData[field].slice(0, 10)
          truncatedData[`${field}_truncated`] =
            `Showing 10 of ${originalLength} entries. Use pagination parameters to get more.`
        }
      }
    }

    return {
      data: truncatedData,
      truncated: true,
      pagination_info:
        "Response truncated due to size. Use limit and offset parameters to paginate through large nested data.",
    }
  }

  return { data, truncated: false }
}

export function truncateStackTraces(data: any, maxFrames: number): any {
  if (!data || typeof data !== "object") return data

  if (Array.isArray(data)) {
    return data.map((item) => truncateStackTraces(item, maxFrames))
  }

  const result = { ...data }

  if (result.entries && Array.isArray(result.entries)) {
    result.entries = result.entries.map((entry: any) => {
      if (entry.type === "exception" && entry.data?.values) {
        entry.data.values = entry.data.values.map((value: any) => {
          if (value.stacktrace?.frames && Array.isArray(value.stacktrace.frames)) {
            const frames = value.stacktrace.frames
            if (frames.length > maxFrames) {
              value.stacktrace.frames = frames.slice(-maxFrames)
              value.stacktrace.frames_omitted = frames.length - maxFrames
            }
          }
          return value
        })
      }
      return entry
    })
  }

  for (const key in result) {
    if (typeof result[key] === "object") {
      result[key] = truncateStackTraces(result[key], maxFrames)
    }
  }

  return result
}
