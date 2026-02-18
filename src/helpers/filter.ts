/* eslint-disable @typescript-eslint/no-explicit-any */

export function filterObjectFields(
  obj: any,
  includeFields?: string[],
  excludeFields?: string[],
): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => filterObjectFields(item, includeFields, excludeFields));
  }

  let result: any = {};

  if (includeFields && includeFields.length > 0) {
    for (const field of includeFields) {
      if (field.includes('.')) {
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
    result = { ...obj };

    if (excludeFields && excludeFields.length > 0) {
      for (const field of excludeFields) {
        if (field.includes('.')) {
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
}

export function grepFilter(data: any, pattern: string): any {
  const regex = new RegExp(pattern, 'i');
  const jsonStr = JSON.stringify(data, null, 2);
  const lines = jsonStr.split('\n');
  const matchingLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      if (i > 0) matchingLines.push(lines[i - 1]);
      matchingLines.push(lines[i]);
      if (i < lines.length - 1) matchingLines.push(lines[i + 1]);
    }
  }

  const filtered = matchingLines.join('\n');
  try {
    return JSON.parse(filtered);
  } catch {
    return { grep_results: matchingLines, original_pattern: pattern };
  }
}
