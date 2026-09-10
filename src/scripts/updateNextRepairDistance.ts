const mongoose = require('mongoose');
const Repairing = require('../models/repairingModel');
const Car = require('../models/Car');
require('dotenv').config({ path: '../config.env' });



mongoose.connect(process.env.DB_URL).then(() => {
  console.log('DB connection successful');
});

async function updateNextRepairDistance() {
  try {
    console.log('Starting updateNextRepairDistance script...');

    // Get all cars with nextRepairDistance = 0 or null
    const cars = await Car.find({
      $or: [
        { nextRepairDistance: 0 },
        { nextRepairDistance: null },
        { nextRepairDistance: undefined }
      ]
    });

    console.log(`Found ${cars.length} cars with nextRepairDistance = 0/null`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const car of cars) {
      // Find the last periodic repair for this car
      const lastPeriodicRepair = await Repairing.findOne({
        carNumber: car.carNumber,
        type: 'periodic',
        // Pre-existing behaviour kept verbatim. The original literal was
        // `{ $ne: 0, $ne: null, $ne: undefined }`; duplicate keys mean the last
        // one wins, so the filter that actually reached Mongo was — and still
        // is — `{ $ne: undefined }`. Probably meant to be `{ $nin: [0, null] }`.
        nextRepairDistance: { $ne: undefined }
      }).sort({ createdAt: -1 });

      if (lastPeriodicRepair && lastPeriodicRepair.nextRepairDistance) {
        // Update the car's nextRepairDistance from the last periodic repair
        car.nextRepairDistance = lastPeriodicRepair.nextRepairDistance;
        await car.save();

        console.log(`Updated car ${car.carNumber} with nextRepairDistance: ${lastPeriodicRepair.nextRepairDistance} from periodic repair ${lastPeriodicRepair._id}`);
        updatedCount++;
      } else {
        console.log(`No periodic repair with valid nextRepairDistance found for car ${car.carNumber} , ${car.generatedCode}`);
        skippedCount++;
      }
    }

    console.log(`\nSummary:`);
    console.log(`- Updated: ${updatedCount} cars`);
    console.log(`- Skipped: ${skippedCount} cars`);
    console.log('Script completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error in updateNextRepairDistance script:', error);
    process.exit(1);
  }
}

updateNextRepairDistance();

export {};
