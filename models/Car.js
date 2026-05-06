// models/Car.js
const mongoose = require("mongoose");

const carSchema = new mongoose.Schema({
  ownerName: {
    type: String,
  },
  carNumber: {
    type: String,
    required: [true, "Car Number is required"],
  },
  chassisNumber: {
    type: String,
    //required: [true, "chassis Number is required"],
    unique: [true, "there is a Car with the same chassis"],
  },
  color: {
    type: String,
    required: [true, "color is required"],
  },
  State: {
    type: String,
    enum: ["Repair", "Good", "Need to check", "Done"],
    default: "Good",
  },
  brand: {
    type: String,
    required: [true, "brand is required"],
  },
  category: {
    type: String,
    required: [true, "category is required"],
  },
  model: {
    type: String,
    required: [true, "model is required"],
  },
  generatedCode: {
    type: String,
    unique: true,
    maxlength: 8,
  },
  generatedPassword: {
    type: String,
  },
  nextRepairDate: {
    type: Date,
  },
  lastRepairDate: {
    type: Date,
  },
  periodicRepairs: {
    type: Number,
    default: 0,
  },
  nonPeriodicRepairs: {
    type: Number,
    default: 0,
  },
  componentState: [
    {
      component: String,
      state: String,
      details: String,
    },
  ],
  repairing: {
    type: Boolean,
    default: false,
  },
  distances: {
    type: Number,
  },
  motorNumber: {
    type: String,
    unique: [true, "there is a car with the same motor number"],
  },
  repairing_id: {
    type: mongoose.Schema.ObjectId,
    ref: "repairingModel",
  },
  completedServicesRatio: {
    type: Number,
  },
  nextRepairDistance: {
    type: Number,
  },
});

module.exports = mongoose.model("Car", carSchema);
