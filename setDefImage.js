const mongoose = require("mongoose");
require("dotenv").config({ path: "./config.env" });

// 🔹 لينك الصورة الجديدة
const DEFAULT_IMAGE =
  "https://res.cloudinary.com/dcj7fkdub/image/upload/v1777995080/def_ljjwcj.png";

// 🔹 موديل العربيات (عدّل المسار حسب مشروعك)
const Car = require("./models/Car");

async function updateImages() {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("✅ Connected to DB");

    // 🔥 تحديث العربيات اللي مش عندها صورة بس
    const result = await Car.updateMany(
      { $or: [{ image: { $exists: false } }, { image: null }, { image: "" }] },
      { $set: { image: DEFAULT_IMAGE, imagePublicId: "cars/def_img" } },
    );

    console.log("🚀 Updated cars:", result.modifiedCount);

    await mongoose.disconnect();
    console.log("🔌 Disconnected");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

updateImages();
