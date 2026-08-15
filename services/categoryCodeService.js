const CategoryCode = require("../models/categoryCode");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");
const ApiFeatures = require("../utils/apiFeatures");
const {searchService} = require("./searchService");
const Car = require ("../models/Car");
const User = require("../models/userModel");
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
exports.getCategoryCode = asyncHandler(async (req, res, next) => {
  const { id } = req.params;     
  const { code } = req.body;      

  let categoryCode = code;

  // If no code was sent directly, but a category id was, look up the category to get its code
  if (!categoryCode && id) {
    const document = await CategoryCode.findById(id);

    if (!document) {
      return next(new apiError(`No document for this id ${id}`, 404));
    }

    categoryCode = document.code;
  }

  if (!categoryCode) {
    return next(new apiError(`Please provide a code or a valid category id`, 400));
  }

  // Escape any regex special chars in the category code (safety)
  const escapedCode = categoryCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const carsCount = await Car.countDocuments({
    generatedCode: { $regex: `^${escapedCode}\\d+$`, $options: 'i' },
  });

  res.status(200).json({
    code: categoryCode,
    carsCount,
  });
});

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
  const d = await Promise.all(
    documents.map(async (doc) => {
      const counter = await Car.countDocuments({
        generatedCode: { $regex: `^${doc.code}\\d+$`, $options: 'i' },
      });
      return { ...doc.toObject(), counter };
    })
  );

  res.status(200).json({
    results: documents.length,
    paginationResult,
    data: d,
  });
});

// @doc get all categories
// @Route get /api/v1/Category/getall/
// @access private
exports.getallCategoryOnly = asyncHandler(async (req, res, next) => {
  const categories = await CategoryCode.distinct("category");

  res.status(200).json({ data: categories });
});

// @doc get next Code number 
// @Route get /api/v1/Category/nextCode/
// @access private

exports.suggestNextCodeNumber = asyncHandler(async (req, res, next) => {
  const { code } = req.params;

  if (!code) {
    return next(new apiError(`Please provide a code`, 400));
  }

  const categoryCode = await CategoryCode.findOne({
    code: { $regex: `^${code}$`, $options: 'i' },
  });

  if (!categoryCode) {
    return next(new apiError(`There is no category with this code ${code}`, 400));
  }

  const escapedCode = categoryCode.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp("^" + escapedCode + "\\d+$", "i");

  const cars = await Car.aggregate([
    { $match: { generatedCode: regex } },
    {
      $project: {
        numericCode: {
          $toInt: {
            $substr: [
              "$generatedCode",
              { $strLenCP: categoryCode.code },
              { $strLenCP: "$generatedCode" },
            ],
          },
        },
      },
    },
    { $sort: { numericCode: -1 } },
    { $limit: 1 },
  ]);

  const lastNumber = cars.length > 0 ? cars[0].numericCode : 0;
  const nextNumber = lastNumber + 1;

  res.status(200).json({
    data: {
      code: categoryCode.code,
      lastNumber,
      nextNumber,
      nextGeneratedCode: categoryCode.code + nextNumber,
    },
  });
});

// @doc move car generatedCode to another category
// @Route put /api/v1/Category/moveCode/
// @access private
exports.moveGeneratedCode = asyncHandler(async (req, res, next) => {
  const { currentCode, targetCategory } = req.body;

  if (!currentCode || !targetCategory) {
    return next(new apiError(`currentCode and targetCategory are required`, 400));
  }

  // Find the car with current generatedCode
  const car = await Car.findOne({ generatedCode: currentCode });
  if (!car) {
    return next(new apiError(`No car found with generatedCode ${currentCode}`, 404));
  }

  // Find the target category code
  const targetCategoryCode = await CategoryCode.findOne({ code: targetCategory });
  if (!targetCategoryCode) {
    return next(new apiError(`No category found with name ${targetCategory}`, 404));
  }

  // Get the last number for the target category
  const escapedCode = targetCategoryCode.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp("^" + escapedCode + "\\d+$", "i");

  const cars = await Car.aggregate([
    { $match: { generatedCode: regex } },
    {
      $project: {
        numericCode: {
          $toInt: {
            $substr: [
              "$generatedCode",
              { $strLenCP: targetCategoryCode.code },
              { $strLenCP: "$generatedCode" },
            ],
          },
        },
      },
    },
    { $sort: { numericCode: -1 } },
    { $limit: 1 },
  ]);

  const lastNumber = cars.length > 0 ? cars[0].numericCode : 0;
  const nextNumber = lastNumber + 1;
  const newGeneratedCode = targetCategoryCode.code + nextNumber;

  // Update car's generatedCode and category
  const oldCode = car.generatedCode;
  car.generatedCode = newGeneratedCode;
  car.category = targetCategory;
  await car.save();

  // Update carCode in user schema
  await User.updateOne(
    { "car.carNumber": car.carNumber },
    { $set: { "car.$.carCode": newGeneratedCode } }
  );

  res.status(200).json({
    message: "Code moved successfully",
    data: {
      oldCode,
      newGeneratedCode,
      targetCategory,
      lastNumber,
      nextNumber,
    },
  });
});

// @doc delete category with car count check
// @Route delete /api/v1/Category/:id
// @access private
exports.deleteCategoryCode = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Find the category code
  const categoryCode = await CategoryCode.findById(id);
  if (!categoryCode) {
    return next(new apiError(`No category found with id ${id}`, 404));
  }

  // Check if there are cars using this category code
  const escapedCode = categoryCode.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const carCount = await Car.countDocuments({
    generatedCode: { $regex: `^${escapedCode}\\d+$`, $options: 'i' },
  });

  if (carCount > 0) {
    return next(
      new apiError(
        `Cannot delete category. There are ${carCount} cars using this category code.`,
        400,
      ),
    );
  }

  // Delete the category
  await CategoryCode.findByIdAndDelete(id);

  res.status(200).json({
    message: "Category deleted successfully",
    data: {
      category: categoryCode.category,
      code: categoryCode.code,
    },
  });
});