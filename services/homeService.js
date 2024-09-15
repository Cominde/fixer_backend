const Inventory = require("../models/Inventory");
const Repairing = require("../models/repairingModel");
const Car = require("../models/Car");
//const slugify = require("slugify");
const apiError = require("../utils/apiError");
const asyncHandler = require("express-async-handler");

// @desc get home prams by car Number
// @Route GET /api/v1/Home/:carNumber
// @access private
exports.getHomepram = asyncHandler(async (req, res, next) => {
  const { carNumber } = req.params;

  try {
    const car = await Car.findOne({ carNumber });

    if (!car) {
      returnnext(
        new apiError(`Can't find car for this car number ${carNumber}`, 404)
      );
    }

    const repairing = await Repairing.findById(car.repairing_id);

    if (!repairing) {
      if (
        car.nextRepairDate === undefined &&
        car.lastRepairDate === undefined
      ) {
        return res.status(200).json({
          data: {
            createdDate: "-/-/-",
            expectedDate: "-/-/-",
            completedServicesRatio: 0,
            state: car.State,
            lastRepairDate: "-/-/-",
            nextRepairDate: "-/-/-",
            periodicRepairs: car.periodicRepairs,
            nonperiodicRepairs: car.nonPeriodicRepairs,
          },
        });
      }
      if (car.nextRepairDate) {
        return res.status(200).json({
          data: {
            createdDate: "-/-/-",
            expectedDate: "-/-/-",
            completedServicesRatio: 0,
            state: car.State,
            lastRepairDate: car.lastRepairDate,
            nextRepairDate: car.nextRepairDate,
            periodicRepairs: car.periodicRepairs,
            nonperiodicRepairs: car.nonPeriodicRepairs,
          },
        });
      }

      if(car.nextRepairDate){
      return res.status(200).json({
        data: {
        createdDate: "-/-/-",
        expectedDate: "-/-/-",
        completedServicesRatio: 0,
        state: car.State,
        lastRepairDate: car.lastRepairDate,
        nextRepairDate: car.nextRepairDate,
        periodicRepairs: car.periodicRepairs,
        nonperiodicRepairs: car.nonPeriodicRepairs,
        },
      });}
    }

    return res.status(200).json({
      data: {
        createdDate: repairing.createdAt,
        expectedDate: repairing.expectedDate,
        completedServicesRatio: repairing.completedServicesRatio,
        state: car.State,
        lastRepairDate: car.lastRepairDate,
        nextRepairDate: car.nextRepairDate,
        periodicRepairs: car.periodicRepairs,
        nonperiodicRepairs: car.nonPeriodicRepairs,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    next(new apiError("Internal Server Error", 500));
  }
});
