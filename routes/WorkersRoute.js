const express = require("express");
const router = express.Router();

const {
  UpdateWorkerDetals,
  addWorker,
  getAllWorkers,
  searchForWorker,
  UpdateWorkerDetalsByNID,
  deleteWorker,
  moneyFromToworker,
  getSpacificWorker,
} = require("../services/WorksServices");

const {
  addWorkerValidator,
} = require("../utils/validator/phoneNumberValidator");
router.route("/").get(getAllWorkers).post(addWorkerValidator, addWorker);
router
  .route("/:id")
  .delete(deleteWorker)
  .post(moneyFromToworker)
  .get(getSpacificWorker);
router.route("/search/:searchString").get(searchForWorker);
router.route("/withoutNID/:id").put(UpdateWorkerDetals);
router.route("/:IdNumber").put(UpdateWorkerDetalsByNID);

module.exports = router;
