// models/MonthlyMoneyReport.js
const mongoose = require("mongoose");

const monthlyMoneyReportSchema = new mongoose.Schema(
  {
    date: { type: Date },
    outCome: { type: Number },
    encome: { type: Number },
    totalGain: { type: Number, default: 0 },
    additions: [
      {
        title: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
        },
      },
    ],
    electricity_bill: { type: Number },
    water_bill: { type: Number },
    gas_bill: { type: Number },
    rent: { type: Number },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MonthlyMoneyReport", monthlyMoneyReportSchema);
