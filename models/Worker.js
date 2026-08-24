// models/Worker.js
const mongoose = require("mongoose");
const { cairoDatePlugin } = require("../utils/cairoDate");

const workerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "the name is required "] },
    phoneNumber: {
      type: String,
      required: [true, "the phoneNumber is required "],
    },
    jobTitle: { type: String, required: [true, "the jobTitle is required "] },
    salary: { type: Number, required: [true, "the salary is required "] },
    salaryAfterProcces: { type: Number },
    salaryAfterReword: { type: Number },
    IdNumber: {
      type: String,
      required: [true, "the IdNumber is required "],
      unique: [true, "the IdNumber is used before"],
      validate: {
        validator: function (value) {
          return /^\d{14}$/.test(value.toString());
        },
        message: "The IdNumber must be exactly 14 digits long",
      },
    },
    loans: [
      {
        amount: { type: Number, default: 0 },
        date: { type: Date },
      },
    ],
    penalty: [
      {
        amount: { type: Number, default: 0 },
        date: { type: Date },
      },
    ],
    reward: [
      {
        amount: { type: Number, default: 0 },
        date: { type: Date },
      },
    ],
    numberOfRepairs: {
      type: Number,
      default: 0,
    },
   /* role: {
      type: String,
      required:[true,"the role of the worker is required for thew system"]
    }
  },*/
  { timestamps: true },
);
workerSchema.plugin(cairoDatePlugin);
module.exports = mongoose.model("Worker", workerSchema);
