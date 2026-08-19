const mongoose = require("mongoose");
const { cairoDatePlugin } = require("../utils/cairoDate");

const measurementSchema = new mongoose.Schema(
  {
    client: { type: String },
    measurementNumber: {
      type: String,
      required: [true, "Measurement Number is required"],
      unique: true,
    },
    brand: { type: String },
    category: { type: String },
    model: { type: String },
    totalPrice: {
      type: Number,
    },
    carNumber: {
      type: String,
      required: [true, "Car Number is required"],
    },
    type: {
      type: String,
      enum: ["periodic", "nonPeriodic"],
      default: "periodic",
    },
    Services: [
      {
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        state: {
          type: String,
          enum: ["repairing", "completed"],
          default: "repairing",
        },
      },
    ],
    additions: [
      {
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    component: [
      {
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],

    discount: {
      type: Number,
    },
    priceAfterDiscount: {
      type: Number,
    },
    expectedDate: {
      type: Date,
    },
    complete: {
      type: Boolean,
      default: false,
    },
    completedServicesRatio: {
      type: Number,
    },
    Note1: {
      type: String,
    },
    Note2: {
      type: String,
    },
    distance: {
      type: Number,
    },
    nextRepairDistance: {
      type: Number,
    },
    nextRepairDate: {
      type: Date,
    },
    acceptance: {
      type: Boolean,
      default: false,
    },
    acceptedAt: {
      type: Date,
    },
    convertedToRepair: {
      type: Boolean,
      default: false,
    },
    repairId: {
      type: mongoose.Schema.ObjectId,
      ref: "repairing",
    },
    carId: {
      type: mongoose.Schema.ObjectId,
      ref: "Car",
    },
    generatedCode: {
      type: String,
    },
  },
  { timestamps: true },
);

measurementSchema.plugin(cairoDatePlugin);
module.exports = mongoose.model("measurement", measurementSchema);
