const mongoose = require("mongoose");
const User = require("./models/userModel");
const Car = require("./models/Car");
require("dotenv").config({ path: "./config.env" });

const syncPasswordsToCards = async () => {
  await mongoose.connect(process.env.DB_URL);
  console.log("✅ Connected to DB");

  const users = await User.find({ password: { $exists: true } });

  for (const user of users) {
    for (const carSubDoc of user.car) {
      const car = await Car.findById(carSubDoc.id);

      if (!car) {
        console.log(
          `⚠️  Car ${carSubDoc.id} not found in DB${carSubDoc.carNumber}//${user.id} // ${user.name} // `,
        );

        continue;
      }

      if (!car.generatedPassword) {
        console.log(`⚠️  Car ${car._id} has no generatedPassword set`);
        continue;
      }

      // ✅ Compare car's generatedPassword with user's password
      if (car.generatedPassword === user.password) {
        console.log(`✅ MATCH   — car ${car._id} | user ${user._id}`);
      } else {
        console.log(`❌ MISMATCH — car ${car._id} | user ${user._id}`);
        console.log(`   car.generatedPassword : ${car.generatedPassword}`);
        console.log(`   user.password         : ${user.password}`);
      }
    }
  }

  console.log("🎉 Done checking all passwords");
  await mongoose.disconnect();
};

syncPasswordsToCards().catch(console.error);
