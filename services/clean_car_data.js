const Car = require("../models/Car");
const asyncHandler = require("express-async-handler");
// @desc    get brands
// @route   get /api/V2/ClearCarData/brands/
// @access  PUBLIC
exports.getAllCategory = asyncHandler(async (req, res) => {
  const categories = await Car.distinct("category");
  res.status(200).json({ data: categories });
});
// @desc    get category
// @route   get /api/V2/ClearCarData/category/
// @access  PUBLIC
exports.getAllBrands = asyncHandler(async (req, res) => {
  const brands = await Car.distinct("brand");
  res.status(200).json({ data: brands });
});
// @desc    clean brand
// @route   put /api/V2/ClearCarData/brands/
// @access  PUBLIC
exports.cleanBrands = asyncHandler(async (req, res, next) => {
  // Map of wrong spellings → correct spelling
  const brandCorrections = {
    CHEVORLET: "CHEVROLET",
    CHEVORLETE: "CHEVROLET",
    CHEVROET: "CHEVROLET",
    HUYNDAI: "HYUNDAI",
    MIRSUBISHI: "MITSUBISHI",
    PEJAUTE: "PEUGEOT",
    TOWOTA: "TOYOTA",
    towota: "TOYOTA",
    LANCER: "MITSUBISHI", // Lancer is a Mitsubishi model, not a brand
  };

  const cars = await Car.find({});
  let updatedCount = 0;

  for (const car of cars) {
    const updates = {};

    if (car.brand) {
      const upperBrand = car.brand.toUpperCase().trim();
      const correctedBrand =
        brandCorrections[upperBrand] ||
        brandCorrections[car.brand] ||
        upperBrand;

      if (correctedBrand !== car.brand) {
        updates.brand = correctedBrand;
      }
    }

    if (Object.keys(updates).length > 0) {
      await Car.findByIdAndUpdate(car._id, updates);
      updatedCount++;
    }
  }

  res.status(200).json({
    message: `✅ Cleaned ${updatedCount} cars successfully`,
    updatedCount,
  });
});
// @desc    clean category
// @route   put /api/V2/ClearCarData/
// @access  PUBLIC
exports.cleanCategories = asyncHandler(async (req, res, next) => {
  const categoryCorrections = {
    // ACCENT
    "ACCENENT -RB": "ACCENT RB",
    "ACCENT -RB": "ACCENT RB",
    "ACCENT- RB": "ACCENT RB",
    "ACCENT-RB": "ACCENT RB",
    "ACEENT-RB": "ACCENT RB",
    "NEW-ACCENT": "NEW ACCENT",

    // ELANTRA
    "ELANTRA ": "ELANTRA",
    "EALNTRA-AD": "ELANTRA AD",
    "ELANTRA - AD": "ELANTRA AD",
    "ELANTRA -AVANTE": "ELANTRA AVANTE",
    "ELANTRA -HD": "ELANTRA HD",
    "ELANTRA -MD": "ELANTRA MD",
    "ELANTRA HD ": "ELANTRA HD",
    "ELANTRA-AD": "ELANTRA AD",
    "ELANTRA-CN7": "ELANTRA CN7",
    "ELANTRA-HD": "ELANTRA HD",
    "ELANTRA-MD": "ELANTRA MD",
    "ELANTRA-XD": "ELANTRA XD",
    MD: "ELANTRA MD",
    CN7: "ELANTRA CN7",

    // SUNNY
    "SUNNY - N17": "SUNNY N17",
    "SUNNY -N17": "SUNNY N17",
    "SUNNY- N16": "SUNNY N16",
    "SUNNY- N17": "SUNNY N17",
    "SUNNY-N16": "SUNNY N16",
    "SUNNY-N17": "SUNNY N17",
    N17: "SUNNY N17",

    // CERATO
    "CERATO- K2": "CERATO K2",
    "CERATO- K3": "CERATO K3",
    "CERATO-K2": "CERATO K2",
    "CERATO-K3": "CERATO K3",
    "CERATO-K4": "CERATO K4",
    "Cerato K3": "CERATO K3",
    "GRAND-CERATO": "GRAND CERATO",

    // RIO
    "RIO-3": "RIO 3",
    "RIO-4": "RIO 4",

    // LANCER
    "LANCER-EX": "LANCER EX",
    LANCER: "UNKNOWN",
    PUMA: "LANCER PUMA",
    SHARK: "LANCER SHARK",

    // YARIS
    "YARIS -H.B": "YARIS H.B",

    // C-ELYSEE
    "C-ELYSEE\r": "C-ELYSEE",
    "C-ELYSSE": "C-ELYSEE",

    // COROLLA
    CROLLA: "COROLLA",

    // SOLARIS
    SOlARIS: "SOLARIS",

    // GRAND I10
    "GRAND-I10": "GRAND I10",

    // TIGGO
    "TIGGO-4PRO": "TIGGO 4PRO",

    // invalid — same as brand name
    CHEVORLET: "UNKNOWN",
    CHEVROLET: "UNKNOWN",
    HYUNDAI: "UNKNOWN",
    HUYNDAI: "UNKNOWN",
    NISSAN: "UNKNOWN",
    TOYOTA: "UNKNOWN",
    PEUGEOT: "UNKNOWN",
    SKODA: "UNKNOWN",
    DAIHATSU: "UNKNOWN",
    KIA: "UNKNOWN",

    // lowercase
    supra: "SUPRA",
  };

  const cars = await Car.find({});
  let updatedCount = 0;
  const changeLog = []; // to see exactly what changed

  for (const car of cars) {
    const updates = {};

    if (car.category) {
      const trimmed = car.category.trim();

      if (categoryCorrections.hasOwnProperty(trimmed)) {
        updates.category = categoryCorrections[trimmed];
      } else if (car.category !== trimmed) {
        updates.category = trimmed;
      }
    }

    if (Object.keys(updates).length > 0) {
      await Car.findByIdAndUpdate(car._id, updates);
      changeLog.push({
        id: car._id,
        from: car.category,
        to: updates.category,
      });
      updatedCount++;
    }
  }

  res.status(200).json({
    message: `✅ Cleaned ${updatedCount} categories successfully`,
    updatedCount,
    changeLog, // shows exactly what changed
  });
});
