const CategoryCode = require("../models/categoryCode");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");
const ApiFeatures = require("../utils/apiFeatures");
const searchService = require("./searchService");

// @doc create category code
// @Route post /api/v1/Category/
// @access private

exports.createCategoryCode = asyncHandler(async (req, res, next) => {
  const { category, code } = req.body;
  if (!category || !code) {
    return next(new apiError(`must provide category and code`, 400));
  }
  const therecategory = await CategoryCode.findOne({ category });
  if (therecategory) {
    return next(
      new apiError(
        `this category is alaready used with this code  ${therecategory.code} and this is the id ${therecategory._id}`,
        400,
      ),
    );
  }
  const newCategoryCode = await CategoryCode.create({
    category,
    code,
  });
  res.status(201).json({ data: newCategoryCode });
});

// @doc get category by id
// @Route get /api/v1/Category/:id
// @access private
exports.getCategoryCode = factory.getOne(CategoryCode);

// @doc get all category and codes
// @Route get /api/v1/Category/
// @access private
exports.getallCategoryCode = factory.getAll(CategoryCode);

// @doc update category
// @Route put /api/v1/Category/:id
// @access private
exports.updateCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { category } = req.body;
  const newcategory = await CategoryCode.findByIdAndUpdate(
    id,
    { category: category },
    { new: true },
  );
  if (!newcategory) {
    return next(new apiError(`there is no category with this id ${id}`, 404));
  }
  res.status(200).json({ data: newcategory });
});

// @doc search in category
// @Route get /api/v1/Category/search/:searchString
// @access private
exports.searchInCategory = asyncHandler(async (req, res, next) => {
  const { searchString } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const { documents, paginationResult } = await searchService({
    Model: CategoryCode,
    searchString,
    page,
    limit,
  });
  if (!documents || documents.length === 0) {
    return next(
      new apiError(
        `No document found for the search string ${searchString}`,
        404,
      ),
    );
  }

  res.status(200).json({
    results: documents.length,
    paginationResult,
    data: documents,
  });
});

// @doc get all categories
// @Route get /api/v1/Category/getall/
// @access private
exports.getallCategoryOnly = asyncHandler(async (req, res, next) => {
  const categories = await CategoryCode.distinct("category");

  res.status(200).json({ data: categories });
});
