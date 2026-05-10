const mongoose = require("mongoose");
const { cairoDatePlugin } = require("../utils/cairoDate");
const challengeSchema = new mongoose.Schema(
  {
    challenge: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["register", "login"],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    email: {
      type: String,
      required: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
challengeSchema.index({ type: 1, expiresAt: 1, usedAt: 1 });

// TTL index to automatically expire challenges after expiresAt
challengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

challengeSchema.plugin(cairoDatePlugin);
module.exports = mongoose.model("Challenge", challengeSchema);
