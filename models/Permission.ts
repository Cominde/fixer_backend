const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      required: [true, "Permission key is required"],
      trim: true,
    },
    label: {
      type: String,
      required: [true, "Permission label is required"],
      trim: true,
    },
    module: {
      type: String,
      required: [true, "Permission module is required"],
      trim: true,
    },
    endpoints: {
      type: [
        {
          method: {
            type: String,
            enum: ["GET", "POST", "PUT", "DELETE"],
            required: true,
          },
          path: {
            type: String,
            required: true,
          },
          params: {
            type: [String],
            default: [],
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export = mongoose.model("Permission", permissionSchema);
