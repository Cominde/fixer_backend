/**
 * Invoice header attribution helpers.
 * Keep names short, printable, and free of control / injection characters.
 */

const MAX_PERSON_NAME_LEN = 80;

const RECEPTION_KEYS = [
  "receptionEngineer",
  "createdByName",
  "createdBy",
  "workerName",
  "reception",
  "Reception",
];

const REPRESENTATIVE_KEYS = [
  "representative",
  "delegate",
  "mandob",
  "agentName",
];

/**
 * @param {unknown} value
 * @param {{ fallback?: string | null, allowEmpty?: boolean }} [opts]
 * @returns {string | null}
 */
function sanitizePersonName(value, opts = {}) {
  const fallback = Object.prototype.hasOwnProperty.call(opts, "fallback")
    ? opts.fallback
    : null;
  const allowEmpty = opts.allowEmpty === true;

  if (value == null) {
    return allowEmpty ? null : fallback;
  }

  let text = String(value)
    // Replace control chars with space so "Sara\nAli" → "Sara Ali"
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > MAX_PERSON_NAME_LEN) {
    text = text.slice(0, MAX_PERSON_NAME_LEN).trim();
  }

  if (!text) {
    return allowEmpty ? null : fallback;
  }

  return text;
}

function bodyHasAnyKey(body, keys) {
  if (!body || typeof body !== "object") return false;
  return keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

function hasReceptionInput(body = {}) {
  return bodyHasAnyKey(body, RECEPTION_KEYS);
}

function hasRepresentativeInput(body = {}) {
  return bodyHasAnyKey(body, REPRESENTATIVE_KEYS);
}

/**
 * Reception engineer: Admin → "NA", Worker → display name.
 * Never store empty string.
 * @param {Record<string, unknown>} body
 * @returns {string}
 */
function resolveReceptionEngineer(body = {}) {
  const raw =
    body.receptionEngineer ??
    body.createdByName ??
    body.createdBy ??
    body.workerName ??
    body.reception ??
    body.Reception;

  const cleaned = sanitizePersonName(raw, { fallback: "NA" });
  return cleaned || "NA";
}

/**
 * Sales representative / مندوب. Optional; empty → null (omit on invoice).
 * Accepts `representative` or legacy `delegate`.
 * @param {Record<string, unknown>} body
 * @returns {string | null}
 */
function resolveRepresentative(body = {}) {
  const raw =
    body.representative ?? body.delegate ?? body.mandob ?? body.agentName;
  return sanitizePersonName(raw, { fallback: null, allowEmpty: true });
}

module.exports = {
  MAX_PERSON_NAME_LEN,
  sanitizePersonName,
  hasReceptionInput,
  hasRepresentativeInput,
  resolveReceptionEngineer,
  resolveRepresentative,
};
