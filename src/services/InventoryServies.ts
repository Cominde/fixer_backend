const Inventory = require("../models/Inventory");
//const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");

const { searchService } = require("./searchService");

// @desc add Component
// @Route GET /api/v1/Inventort
// @access private
export const addComponent = asyncHandler(async (req, res, next) => {
  const inv = await Inventory.findOne({ name: req.body.name }, { new: true });
  if (inv) {
    return next(
      new apiError(
        `there is an Component with this name , please do update instead of add the id of Component is ${inv._id}`,
        400,
      ),
    );
  }

  if (req.body.Code) {
    const ConponentCode = await Inventory.findOne(
      { Code: req.body.Code },
      { new: true },
    );
    if (ConponentCode) {
      return next(
        new apiError(
          `there is an Component with this Code , please do update instead of add the id of Component is ${ConponentCode._id}`,
          400,
        ),
      );
    }
  }
  const newDoc = await Inventory.create(req.body);
  res.status(201).json({ data: newDoc });
});

// @desc Get list of Components
// @Route GET /api/v1/Inventort
// @access private
export const getAllCom = factory.getAll(Inventory);

// @desc Get list of Components
// @Route GET /api/v1/Inventort
// @access private
export const getAllUnits = asyncHandler(async (req, res) => {
  const Units = await Inventory.distinct("Unit");
  res.status(200).json({ data: Units });
});

// @desc Get spacific Component
// @Route GET /api/v1/Inventort
// @access private
export const getCom = factory.getOne(Inventory);

// @desc Update spacific Component
// @Route GET /api/v1/Inventort
// @access private
export const UpdateComponent = factory.updateOne(Inventory);

// @desc search  Component
// @Route GET /api/v1/Inventort/search/:searchString
// @access private
export const searchCom = asyncHandler(async (req, res, next) => {
  const { searchString } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  let query = Inventory.find();
  const { documents, paginationResult } = await searchService({
    Model: Inventory,
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
  /*
  if (searchString) {
    const schema = Inventory.schema;
    const paths = Object.keys(schema.paths);

    for (let i = 0; i < paths.length; i++) {
      const orConditions = paths

        .filter((path) => schema.paths[path].instance === "String")

        .map((path) => ({
          [path]: { $regex: searchString, $options: "i" },
        }));

      query = query.or(orConditions);
    }
  }
  const documents = await query.sort({ createdAt: -1 }).skip(skip).limit(limit);



>>>>>>> 523b41d (the start of V2)
  const totalDocuments = await Inventory.countDocuments(query.getQuery());
  const totalPages = Math.ceil(totalDocuments / limit);
*/
  res.status(200).json({
    results: documents.length,
    paginationResult,
    data: documents,
  });
  /* sortedCategory = documents.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );*/
});
