const mongoose = require('mongoose');
const Workers = require('../models/Worker');
require('dotenv').config({ path: '../config.env' });



mongoose.connect("mongodb+srv://Fixer_center:FF_120594@cluster0.bimweny.mongodb.net/Fixer_DB?retryWrites=true&w=majority&authSource=admin").then(() => {
  console.log('DB connection successful');
});
const generateUniqueCode = async () => {
  let isUnique = false;
  let code;

  // Generate and check until a unique 8-digit code is found
  while (!isUnique) {
    code = Math.floor(10000000 + Math.random() * 90000000).toString();
    const existingWorker = await Workers.findOne({ generatedPassword: code });

    if (!existingWorker) {
      isUnique = true;
    }
  }

  return code;
};
async function setWorkerPassword() {
  try {
    console.log('Starting updateNextRepairDistance script...');

    // Get all cars with nextRepairDistance = 0 or null
    let workers = await Workers.find({});

    console.log(`Found ${workers.length} `);
    let updatedCount = 0;
    for ( let worker of workers){

    worker.generatedPassword=await generateUniqueCode();
    console.log(`Updated car ${worker._id} with name ${worker.name}`)
    await worker.save();
    updatedCount++;
  }
  

    console.log(`\nSummary:`);
    console.log(`- Updated: ${updatedCount} cars`);
    console.log('Script completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error in setWorkerPassword script:', error);
    process.exit(1);
  }
}

setWorkerPassword();
