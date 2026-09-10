/**
 * Normalizes a date string to UTC midnight to avoid timezone offset issues.
 *
 * Problem:
 *   new Date("2026/11/15") → parsed as LOCAL midnight → saved as 2026-11-14 in UTC (Egypt UTC+2/+3)
 *   new Date("2026-11-15") → parsed as UTC midnight  → saved as 2026-11-15 in UTC ✅
 *
 * Fix:
 *   Always convert the input to ISO format (dashes) and force UTC midnight.
 *
 * @param {string|Date|null|undefined} dateInput
 * @returns {Date|null}
 */
const normalizeToUTCDate = (dateInput) => {
  if (!dateInput) return null;

  // Already a proper Date object — extract UTC date parts and rebuild at midnight UTC
  if (dateInput instanceof Date) {
    const y = dateInput.getUTCFullYear();
    const m = String(dateInput.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dateInput.getUTCDate()).padStart(2, "0");
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  }

  // String input: replace slashes with dashes → force ISO UTC parsing
  const isoString = dateInput.toString().replace(/\//g, "-");

  // Strip time part if present — keep date only
  const datePart = isoString.split("T")[0];

  // Validate basic format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(datePart)) {
    throw new Error(
      `Invalid date format: "${dateInput}". Expected YYYY-MM-DD or YYYY/MM/DD.`,
    );
  }

  return new Date(`${datePart}T00:00:00.000Z`);
};

export = { normalizeToUTCDate };
