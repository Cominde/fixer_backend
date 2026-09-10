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
    },
    alertQuantity: {
      type: Number,
      required: [true, "the alertQuantity is required "],
    },
  },
  // مفيده ليا لو عايز اجيب ال منتج الاحدث بالوقت
  { timestamps: true },
);
inventorySchema.plugin(cairoDatePlugin);
export = mongoose.model("Inventory", inventorySchema);
