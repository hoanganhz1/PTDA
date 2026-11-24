/** Log có cấu trúc (một dòng JSON / event) để đọc bằng mắt và bằng script. */

const enabled = process.env.LOG_SILENT !== "1";

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function logEvent(event: string, fields: LogFields = {}) {
  if (!enabled) return;
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
  } catch {
    console.log(`[log] ${event}`);
  }
}

export function logError(event: string, error: unknown, fields: LogFields = {}) {
  logEvent(event, {
    ...fields,
    level: "error",
    error: error instanceof Error ? error.message : String(error),
  });
}
