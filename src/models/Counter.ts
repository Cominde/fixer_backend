const mongoose = require("mongoose");

/**
 * Monotonic sequences (invoice numbers, customer codes per category).
 * `seq` is the last number handed out; it never goes down.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, collection: "sequence_counters" },
);

export = mongoose.models.SequenceCounter ||
  mongoose.model("SequenceCounter", counterSchema);
