const Inventory = require("../models/Inventory");
//const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");

// @desc add Component
// @Route GET /api/v1/Inventort
// @access private
exports.addComponent = asyncHandler(async (req, res, next) => {
  const inv = await Inventory.findOne({ name: req.body.name }, { new: true });
  if (inv) {
    return next(
      new apiError(
        `there is an Component with this name , please do update instead of add the id of Component is ${inv._id}`,
        400
      )
    );
  }
  const newDoc = await Inventory.create(req.body);
  res.status(201).json({ data: newDoc });
});

// @desc Get list of Components
// @Route GET /api/v1/Inventort
// @access private
exports.getAllCom = factory.getAll(Inventory);
//exports.getAllCom = asyncHandler(async (req, res) => {
//  const page = req.query.page * 1 || 1;
//  const limit = req.query.limit * 1 || 5;
//  const skip = (page - 1) * limit; // if page 2 then (2-1)*5=5 then it will skip the first 5 docs
//  const components = await Inventory.find({}).skip(skip).limit(limit);
// res.status(200).json({ results: components.length, page, data: components });
//});

// @desc Get spacific Component
// @Route GET /api/v1/Inventort
// @access private
exports.getCom = factory.getOne(Inventory);

// @desc Update spacific Component
// @Route GET /api/v1/Inventort
// @access private
exports.UpdateComponent = factory.updateOne(Inventory);

// @desc search  Component
// @Route GET /api/v1/Inventort/search/:searchString
// @access private
exports.searchCom = asyncHandler(async (req, res, next) => {
  const { searchString } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  let query = Inventory.find();

  if (searchString) {
    const schema = Inventory.schema;
    const paths = Object.keys(schema.paths);

    for (let i = 0; i < paths.length; i++) {
      const orConditions = paths
        .filter(
          (path) =>
            schema.paths[path].instance === "String" && // Filter only string type parameters
            path === "name" // Filter specific fields for search
        )
        .map((path) => ({
          [path]: { $regex: searchString, $options: "i" },
        }));

      query = query.or(orConditions);
    }
  }
  const documents = await query.sort({ createdAt: -1 }).skip(skip).limit(limit);

  if (!documents || documents.length === 0) {
    return next(
      new apiError(
        `No document found for the search string ${searchString}`,
        404
      )
    );
  }
  const totalDocuments = await Inventory.countDocuments(query.getQuery());
  const totalPages = Math.ceil(totalDocuments / limit);
  res.status(200).json({
    results: documents.length,
    paginationResult: {
      currentPage: page,
      limit: limit,
      numberOfPages: totalPages,
    },
    data: documents,
  });
  /* sortedCategory = documents.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );*/
});
