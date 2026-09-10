// models/Inventory.js
const { cairoDatePlugin } = require("../utils/cairoDate");
const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "the request is required "],
    },
    description: {
      type: String,
      required: [true, "the description is required "],
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },
    date: {
      type: Date,
      required: [true, "the date is required "],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "the user is required "],
    },
    user_name: {
      type: String,
      required: [true, "the user name is required "],
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: [true, "the car is required "],
    },
    car_number: {
      type: String,
      required: [true, "the car number is required "],
    },
  },

  { timestamps: true },
);
BookingSchema.plugin(cairoDatePlugin);

export = mongoose.model("Booking", BookingSchema);
