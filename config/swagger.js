const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Fixer API",
      version: "2.0.0",
      description: `
Fixer Flutter Backend - Full API Documentation

## What's new in v2
| Badge | Meaning |
|-------|---------|
| 🟢 NEW | Brand new endpoint |
| 🟡 UPDATED | Existing endpoint that was modified |

## Categories (for new & updated endpoints)
| Badge | Meaning |
|-------|---------|
| 🔧 System | Backend / admin-facing |
| 📱 App | Mobile app / user-facing |
      `,
    },
    servers: [
      {
        url: "https://test-fixer.onrender.com/api/V2",
        description: "Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token from admin/login or loginByCode",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./routes/*.js", "./utils/**/*.js"],
};

// ─── Build the full spec ──────────────────────────────────────────────────
const rawSpec = swaggerJsdoc(options);

// ─── Post-process: add badges to new/updated endpoints ───────────────────
function applyBadges(spec) {
  for (const methods of Object.values(spec.paths || {})) {
    for (const operation of Object.values(methods)) {
      const status = operation["x-status"]; // "new" | "updated"
      const category = operation["x-category"]; // "system" | "app"

      if (!status) continue; // old endpoint — leave untouched

      // ── Add status badge to summary ──────────────────────────────────────
      const statusBadge = status === "new" ? "🟢 NEW — " : "🟡 UPDATED — ";
      operation.summary = statusBadge + (operation.summary || "");

      // ── Add status note to description ───────────────────────────────────
      const statusNote =
        status === "new"
          ? "> **🟢 This is a new endpoint.**\n\n"
          : "> **🟡 This endpoint was recently updated.**\n\n";
      operation.description = statusNote + (operation.description || "");

      // ── Prefix tag with category emoji ───────────────────────────────────
      if (category) {
        operation.tags = (operation.tags || []).map((tag) => {
          if (category === "system") return `🔧 ${tag}`;
          if (category === "app") return `📱 ${tag}`;
          return tag;
        });
      }
    }
  }
  return spec;
}

const swaggerSpec = applyBadges(rawSpec);
module.exports = swaggerSpec;
