// utils/cairoDate.js
const formatDateToCairo = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleString("en-EG", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
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
