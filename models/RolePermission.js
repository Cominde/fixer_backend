const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.ObjectId,
      ref: "Role",
      required: [true, "Role ID is required"],
    },
    permissionKey: {
      type: String,
      required: [true, "Permission key is required"],
      trim: true,
    },
  },
  { timestamps: true }
);

// Create compound index to prevent duplicate role-permission pairs
rolePermissionSchema.index({ roleId: 1, permissionKey: 1 }, { unique: true });

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
