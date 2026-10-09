const mongoose = require("mongoose");

/**
 * Worker pay as it stood when a payroll month closed. Monthly reports for
 * closed months read salaries from here instead of the live worker rows,
 * which already belong to the next month.
 */
const payrollSnapshotSchema = new mongoose.Schema(
  {
    period: { type: String, required: true, unique: true }, // "YYYY-MM"
    workers: [
      {
        workerId: { type: mongoose.Schema.ObjectId, ref: "Worker" },
        name: String,
        salary: Number,
        salaryAfterProcces: Number,
        salaryAfterReword: Number,
        monthlyRepairs: Number,
      },
    ],
    totalSalaries: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export = mongoose.models.PayrollSnapshot ||
  mongoose.model("PayrollSnapshot", payrollSnapshotSchema);
