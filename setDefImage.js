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

    // 🔥 تحديث كل العربيات
    const result = await Car.updateMany(
      {},
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
