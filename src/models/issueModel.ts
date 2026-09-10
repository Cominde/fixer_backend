const mongoose = require("mongoose");
const { cairoDatePlugin } = require("../utils/cairoDate");

const issueSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "user_id is required"],
    },
    platform: {
      type: String,
      enum: ["android", "ios"],
      required: [
        function () {
          return this.app_type === "app";
        },
        "platform is required when app_type is 'app'",
      ],
    },
    app_type: {
      type: String,
      enum: ["system", "app"],
      required: [true, "app_type is required"],
    },
    description: {
      type: String,
      required: [true, "description is required"],
      trim: true,
    },
    solved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

issueSchema.plugin(cairoDatePlugin);

export = mongoose.model("Issue", issueSchema);
