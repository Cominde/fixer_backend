const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: [true, "Role name is required"],
      trim: true,
    },
    isFullAccess: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export = mongoose.model("Role", roleSchema);
