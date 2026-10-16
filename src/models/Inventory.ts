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
    barcode: {
      type: String,
      unique:true,
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

inventorySchema.index({ name: 1 });

export = mongoose.model("Inventory", inventorySchema);
