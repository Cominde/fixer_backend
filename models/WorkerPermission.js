const mongoose = require("mongoose");

const workerPermissionSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.ObjectId,
      ref: "Worker",
      required: [true, "Worker ID is required"],
    },
    permissionKey: {
      type: String,
      required: [true, "Permission key is required"],
      trim: true,
    },
    granted: {
      type: Boolean,
      required: [true, "Granted status is required"],
      default: true,
    },
  },
  { timestamps: true }
);

// Create compound index to prevent duplicate worker-permission pairs
workerPermissionSchema.index({ workerId: 1, permissionKey: 1 }, { unique: true });

module.exports = mongoose.model("WorkerPermission", workerPermissionSchema);
