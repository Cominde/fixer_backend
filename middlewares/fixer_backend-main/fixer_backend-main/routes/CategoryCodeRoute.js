const express = require("express");

//const authService = require("../services/authService");
const router = express.Router();
//router.use(authService.protect);

//router.use(authService.allowedTo("admin"));

const {
  createCategoryCode,
  getCategoryCode,
  getallCategoryCode,
  updateCategory,
  searchInCategory,
  getallCategoryOnly,
} = require("../services/categoryCodeService");

router.route("/").post(createCategoryCode).get(getallCategoryCode);
router.route("/:id").get(getCategoryCode).put(updateCategory);
router.route("/search/:searchString").get(searchInCategory);
router.route("/category/fordrop/").get(getallCategoryOnly);

module.exports = router;
