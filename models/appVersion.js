// models/Inventory.js
const { cairoDatePlugin } = require("../utils/cairoDate");
const mongoose = require("mongoose");

const appVersionSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      default: "1.0.0",
    },
  },

  { timestamps: true },
);
appVersionSchema.plugin(cairoDatePlugin);

module.exports = mongoose.model("appVersion", appVersionSchema);
