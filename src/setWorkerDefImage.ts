const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
require("dotenv").config({ path: "./config.env" });

// 🔹 Worker Model
const Worker = require("./models/Worker");

// 🔹 Path to the worker default image
const WORKER_IMAGE_PATH = path.join(__dirname, "../../worker_def_image.jpg");

// 🔹 Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadWorkerDefaultImage() {
  try {
    console.log("🔍 Checking if worker default image exists locally...");
    
    // Check if the file exists
    if (!fs.existsSync(WORKER_IMAGE_PATH)) {
      throw new Error(`Worker default image not found at: ${WORKER_IMAGE_PATH}`);
    }
    
    console.log("✅ Worker default image found:", WORKER_IMAGE_PATH);
    
    // Upload to Cloudinary
    console.log("☁️ Uploading worker default image to Cloudinary...");
    
    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        WORKER_IMAGE_PATH,
        {
          folder: "Workers",
          public_id: "workers/def_img",
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });
    
    console.log("✅ Image uploaded successfully!");
    console.log("🔗 Image URL:", result.secure_url);
    console.log("🆔 Public ID:", result.public_id);
    
    return {
      imageUrl: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error("❌ Error uploading image:", error);
    throw error;
  }
}

async function updateWorkerImages(imageUrl, publicId) {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("✅ Connected to DB");

    // 🔥 Update workers that don't have an image or have null/empty image
    const result = await Worker.updateMany(
      { 
        $or: [
          { image: { $exists: false } }, 
          { image: null }, 
          { image: "" },
          { imagePublicId: { $exists: false } },
          { imagePublicId: null },
          { imagePublicId: "" }
        ]
      },
      { 
        $set: { 
          image: imageUrl, 
          imagePublicId: publicId 
        } 
      }
    );

    console.log("🚀 Updated workers without images:", result.modifiedCount);
    
    // Optional: Also update all workers if you want to replace ALL images
    // Uncomment the following lines if you want to replace ALL worker images:
    /*
    const allWorkersResult = await Worker.updateMany(
      {},
      { 
        $set: { 
          image: imageUrl, 
          imagePublicId: publicId 
        } 
      }
    );
    console.log("🔄 Updated ALL workers:", allWorkersResult.modifiedCount);
    */

    await mongoose.disconnect();
    console.log("🔌 Disconnected from DB");
    
    return result.modifiedCount;
  } catch (err) {
    console.error("❌ Error updating workers:", err);
    throw err;
  }
}

async function main() {
  try {
    console.log("🎯 Starting worker default image setup...\n");
    
    // Step 1: Upload the image to Cloudinary
    const { imageUrl, publicId } = await uploadWorkerDefaultImage();
    
    console.log("\n📋 Image upload completed successfully!");
    
    // Step 2: Update worker documents in database
    const updatedCount = await updateWorkerImages(imageUrl, publicId);
    
    console.log("\n✅ Process completed successfully!");
    console.log(`📊 Total workers updated: ${updatedCount}`);
    console.log(`🔗 Default worker image URL: ${imageUrl}`);
    console.log(`🆔 Default worker image Public ID: ${publicId}`);
    
  } catch (error) {
    console.error("\n❌ Process failed:", error);
    process.exit(1);
  }
}

main();

export {};