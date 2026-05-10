// models/Inventory.js
const { cairoDatePlugin } = require("../utils/cairoDate");
const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Component name is required"],
    },
    quantity: {
      type: Number,
      required: [true, "the quantity is required "],
    },
    price: {
      type: Number,
      required: [true, "the price is required"],
    },
    Unit: {
      type: String,
    },
    Code: {
      type: String,
      required: [true, "the Code is required"],
      unique: [true, "the Code is used before"],
    },
  },
  // مفيده ليا لو عايز اجيب ال منتج الاحدث بالوقت
  { timestamps: true },
);
inventorySchema.plugin(cairoDatePlugin);
module.exports = mongoose.model("Inventory", inventorySchema);
