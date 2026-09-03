// models/MonthlyMoneyReport.js
const { cairoDatePlugin } = require("../utils/cairoDate");
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
        type: {
          type: String,
          enum: ['reward', 'penalty', 'null'],
          default: 'null',
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
  },
);
monthlyMoneyReportSchema.plugin(cairoDatePlugin);
module.exports = mongoose.model("MonthlyMoneyReport", monthlyMoneyReportSchema);
