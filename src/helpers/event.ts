/* eslint-disable @typescript-eslint/no-explicit-any */

export function extractEssentialEventEntry(entry: any): any {
  if (entry.type === "exception" && entry.data?.values) {
    return {
      type: entry.type,
      data: {
        values: entry.data.values.map((exc: any) => ({
          type: exc.type,
          value: exc.value,
          mechanism: exc.mechanism,
          stacktrace: exc.stacktrace
            ? {
                frames: exc.stacktrace.frames?.slice(-5).map((frame: any) => ({
                  filename: frame.filename,
                  function: frame.function,
                  lineNo: frame.lineNo,
                  colNo: frame.colNo,
                  absPath: frame.absPath,
                  context: frame.context?.slice(-3, 4),
                  vars: Object.keys(frame.vars || {}).length > 0 ? "..." : undefined,
                })),
              }
            : undefined,
        })),
      },
    }
  }

  if (entry.type === "message") {
    return entry
  }

  if (entry.type === "breadcrumbs" && entry.data?.values) {
    return {
      type: entry.type,
      data: { values: entry.data.values.slice(-10) },
    }
  }

  return { type: entry.type, _truncated: true }
}
