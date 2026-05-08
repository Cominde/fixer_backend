// utils/cairoDate.js
const formatDateToCairo = (date) => {
  if (!date) return null;

  const d = new Date(date);

  const options = { timeZone: "Africa/Cairo" };

  const day = String(
    new Intl.DateTimeFormat("en", { ...options, day: "2-digit" }).format(d),
  );
  const month = String(
    new Intl.DateTimeFormat("en", { ...options, month: "2-digit" }).format(d),
  );
  const year = String(
    new Intl.DateTimeFormat("en", { ...options, year: "numeric" }).format(d),
  );
  const hour = String(
    new Intl.DateTimeFormat("en", {
      ...options,
      hour: "2-digit",
      hour12: false,
    }).format(d),
  ).padStart(2, "0");
  const minute = String(
    new Intl.DateTimeFormat("en", { ...options, minute: "2-digit" }).format(d),
  ).padStart(2, "0");
  const second = String(
    new Intl.DateTimeFormat("en", { ...options, second: "2-digit" }).format(d),
  ).padStart(2, "0");

  return `${year}/${month}/${day}T${hour}:${minute}:${second}+00:00`;
  // Output: "2026/05/07T23:51:12+00:00"
};

// Mongoose plugin — add to any schema
const cairoDatePlugin = (schema) => {
  schema.methods.toJSON = function () {
    const obj = this.toObject();
    Object.keys(obj).forEach((key) => {
      if (obj[key] instanceof Date) {
        obj[key] = formatDateToCairo(obj[key]);
      }
    });
    return obj;
  };
};

module.exports = { formatDateToCairo, cairoDatePlugin };
