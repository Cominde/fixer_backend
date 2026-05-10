const mongoose = require("mongoose");
const { cairoDatePlugin } = require("../utils/cairoDate");
const passkeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    credentialId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    counter: {
      type: Number,
      default: 0,
      required: true,
    },
    transports: {
      type: [String],
      required: true,
    },
    aaguid: {
      type: String,
      required: false,
    },
    label: {
      type: String,
      required: false,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      required: false,
    },
    revokedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
passkeySchema.index({ userId: 1, revokedAt: 1 });
passkeySchema.index({ credentialId: 1, revokedAt: 1 });

passkeySchema.plugin(cairoDatePlugin);

module.exports = mongoose.model("Passkey", passkeySchema);
