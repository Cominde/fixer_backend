// models/Inventory.js
const mongoose = require("mongoose");

const appVersionSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      default: "1.0.0",
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("appVersion", appVersionSchema);
