const express = require("express");
const router = express.Router();

const {
  createReport,
  getAllReports,
  put_the_bills_rent,
  addorSubthing,
  getmonthWork,
  deleteReport,
} = require("../services/moneyReportServices");

router.route("/").get(getAllReports).post(createReport);
router.route("/put_bills_rent/:year_month").put(put_the_bills_rent);
router.route("/addthing/").post(addorSubthing);
router.route("/home/work/:year_month").get(getmonthWork);
router.route("/delete/:year_month").delete(deleteReport);
module.exports = router;
