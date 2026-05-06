// models/Inventory.js
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
  },
  // مفيده ليا لو عايز اجيب ال منتج الاحدث بالوقت
  { timestamps: true }
);

module.exports = mongoose.model("Inventory", inventorySchema);
