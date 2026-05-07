const express = require("express");
const router = express.Router();

const {
  addComponent,
  getAllCom,
  UpdateComponent,
  getCom,
  searchCom,
} = require("../services/InventoryServies");

router.route("/").get(getAllCom).post(addComponent);

router.route("/:id").get(getCom).put(UpdateComponent);
router.route("/search/:searchString").get(searchCom);

module.exports = router;
