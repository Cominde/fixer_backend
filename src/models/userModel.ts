const mongoose = require("mongoose");
const { cairoDatePlugin } = require("../utils/cairoDate");
//const bcrypt = require("bcryptjs");
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "name required"],
    },
    image: {
      type: String,
    },
    imagePublicId: {
      type: String,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    email: {
      type: String,
      lowercase: true,
    },
    phone: String,
    profileImg: String,

    password: {
      type: String,
      minlength: [6, "Too short password"],
    },
    passwordChangedAt: Date,
    passwordResetCode: String,
    passwordResetExpires: Date,
    passwordResetVerified: Boolean,
    role: {
      type: String,
      enum: ["user", "manager", "admin"],
      default: "user",
    },
    active: {
      type: Boolean,
      default: true,
    },
    loginToken: {
      token: { type: String, default: null },
      expiresAt: { type: Date, default: null },
    },
    phoneNumber: {
      type: String,
      //required: [true, "phoneNumber is required"],
    },
    car: [
      {
        id: {
          type: mongoose.Schema.ObjectId,
          ref: "Car",
        },
        carCode: {
          type: String,
          unique: true,
          maxlength: 8,
        },
        carNumber: {
          type: String,
          required: [true, "Car Number is required"],
          unique: [true, "there is a Car with the same Number"],
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
        image: {
          type: String,
        },
        imagePublicId: {
          type: String,
        },
      },
    ],
    vertified: {
      type: Boolean,
      default: false,
    },
    fcmToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

//userSchema.pre("save", async function (next) {
// if (!this.isModified("password")) return next();
// Hashing user password
//  this.password = await bcrypt.hash(this.password, 12);
//  next();
//});

userSchema.plugin(cairoDatePlugin);

export = mongoose.model("User", userSchema);
