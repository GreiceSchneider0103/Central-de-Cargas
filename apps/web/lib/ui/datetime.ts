function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Converts an ISO/timestamptz string (UTC or with offset) to the local
 * "YYYY-MM-DDTHH:mm" format expected by <input type="datetime-local">. */
export function toDatetimeLocalValue(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Converts a "YYYY-MM-DDTHH:mm" value from <input type="datetime-local">
 * (interpreted in the browser's local timezone) into a UTC ISO string
 * ready to send to the API. Returns null for an empty value. */
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
