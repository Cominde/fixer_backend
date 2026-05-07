const express = require("express");
const router = express.Router();

const {
  createRepairing,
  getCarRepairsByNumber,
  updateServiceStateById,
  getAllComRepairs,
  getCarRepairsByid,
  getCarRepairsByGenCode,
  getRepairsReport,
  suggestNextCodeNumber,
  updateRepair,
  deleteRepair,
} = require("../services/repairingService");
router.route("/").post(createRepairing).get(getAllComRepairs);
router.route("/:carNumber").get(getCarRepairsByNumber);
router.route("/getById/:id").get(getCarRepairsByid);
router.route("/update/:id").put(updateRepair);
router.route("/gen/:generatedCode").get(getCarRepairsByGenCode);
router.route("/report/:id").get(getRepairsReport);
router.route("/nextCode/suggestNextCodeNumber").get(suggestNextCodeNumber);
router.route("/:serviceId").put(updateServiceStateById);
router.route("/delete/:id").delete(deleteRepair);

module.exports = router;
