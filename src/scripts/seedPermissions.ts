const mongoose = require("mongoose");
const Permission = require("../models/Permission");
const registry = require("../utils/permissions/registry");

require("dotenv").config({path : "../config.env"});

async function seedPermissions() {
  try {
    await mongoose.connect("mongodb+srv://Fixer_center:FF_120594@cluster0.bimweny.mongodb.net/Fixer_DB?retryWrites=true&w=majority&authSource=admin");
    console.log("Connected to MongoDB");

    // Clear existing permissions
    await Permission.deleteMany({});
    console.log("Cleared existing permissions");

    // Create permissions from registry
    const permissions = [];
    for (const [module, moduleData] of Object.entries<any>(registry)) {
      for (const [key, permData] of Object.entries<any>(moduleData.permissions)) {
        permissions.push({
          key,
          label: permData.label,
          module,
          endpoints: permData.endpoints || [],
        });
      }
    }

    await Permission.insertMany(permissions);
    console.log(`Seeded ${permissions.length} permissions`);

    console.log("Permissions seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding permissions:", error);
    process.exit(1);
  }
}

seedPermissions();

export {};
