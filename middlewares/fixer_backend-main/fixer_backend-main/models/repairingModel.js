const mongoose = require("mongoose");

// Define schema for the array elements
//const additions = new mongoose.Schema({
//  name: {
//    type: String,
//    required: true
//  },
//  servicePrice: {
//    type: Number,
//    required: true
//  }
//});

// Define the main schema
const repairingSchema = new mongoose.Schema(
  {
    client: { type: String },
    genId: {
      type: String,
    },
    brand: { type: String },
    category: { type: String },
    model: { type: String },
    discount: {
      type: Number,
    },
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
    expectedDate: {
      type: Date,
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
    ], //  Services array
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
  },

  // مفيده ليا لو عايز اجيب ال منتج الاحدث بالوقت
  { timestamps: true }
);

module.exports = mongoose.model("repairing", repairingSchema);
