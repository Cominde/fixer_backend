const express = require("express");
const router = express.Router();

const {
  addCar,
  getCars,
  getRepairingCars,
  makeCarInRepair,
  searchForallCars,
  searchForRepairingCars,
  updateCar,
  getCar,
  deleteCar,
} = require("../services/GarageServices");

router.route("/").get(getCars);
router.route("/getCar/:id").get(getCar);
router.route("/add/:id").post(addCar);
router.route("/repairing").get(getRepairingCars);
router.route("/:carNumber").put(makeCarInRepair);
router.route("/search/:searchString").get(searchForallCars);
router.route("/search/repairing/:searchString").get(searchForRepairingCars);
router.route("/update/:id").put(updateCar);
router.route("/delete/:id").delete(deleteCar);

module.exports = router;
