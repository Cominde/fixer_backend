const mongoose = require("mongoose");

const CategoryCode = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, "category is required"],
      unique: [true, "this category is used before"],
    },
    code: {
      type: String,
      required: [true, "code is required"],
      unique: [true, "this code is used before"],
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Category", CategoryCode);
