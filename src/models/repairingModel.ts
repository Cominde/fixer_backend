const mongoose = require("mongoose");
const { cairoDatePlugin } = require("../utils/cairoDate");

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
    completedAt: {
      type: Date,
      default: null,
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
    oldgenId: {
      type: String,
      required: false,
    },
    carId: {
      type: mongoose.Schema.ObjectId,
      ref: "Car",
    },
    generatedCode: {
      type: String,
    },
    technicians: [
      {
        workerId: {
          type: mongoose.Schema.ObjectId,
          ref: "Worker",
        },
        name: {
          type: String,
        },
      },
    ],
    /// Legacy reception field. Kept in sync with receptionEngineer.
    Reception: {
      type: String,
    },
    /// Reception desk attribution on the invoice (Admin → "NA", Worker → name).
    receptionEngineer: {
      type: String,
      trim: true,
      maxlength: [80, "receptionEngineer is too long"],
      default: "NA",
    },
    /// Optional sales representative / مندوب shown on the invoice.
    representative: {
      type: String,
      trim: true,
      maxlength: [80, "representative is too long"],
      default: null,
    },
  },

  // مفيده ليا لو عايز اجيب ال منتج الاحدث بالوقت
  { timestamps: true },
);

// Pre-save hook to handle completedAt transitions
repairingSchema.pre('save', function(next) {
  if (this.isModified('complete')) {
    if (this.complete === true) {
      // Transitioning to complete: set completedAt if not already set
      if (!this.completedAt) {
        this.completedAt = new Date();
      }
    } else if (this.complete === false) {
      // Reverting from complete: reset completedAt
      this.completedAt = null;
    }
  }
  next();
});

repairingSchema.plugin(cairoDatePlugin);
export = mongoose.model("repairing", repairingSchema);
