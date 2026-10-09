const Inventory = require("../models/Inventory");
//const slugify = require("slugify");
const asyncHandler = require("express-async-handler");
const factory = require("./handlersFactory");
const apiError = require("../utils/apiError");

const { searchService } = require("./searchService");

/**
 * Inventory fields a request may set, validated. Quantities may be
 * fractional (0.5 L of oil); nothing may be negative. The admin app sends
 * `unit` / `minQuantity` alongside `Unit` / `alertQuantity`.
 */
const readInventoryBody = (body, { partial }) => {
  const out: any = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw new apiError("Component name is required", 400);
    out.name = name;
  }
  for (const [field, aliases] of [
    ["quantity", ["quantity"]],
    ["price", ["price"]],
    ["alertQuantity", ["alertQuantity", "minQuantity"]],
  ] as const) {
    const key = aliases.find((k) => body[k] !== undefined && body[k] !== "");
    if (key === undefined) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0) {
      throw new apiError(`${field} must be a number of 0 or more`, 400);
    }
    out[field] = n;
  }
  const unit = body.Unit ?? body.unit;
  if (unit !== undefined) out.Unit = unit;
  if (body.Code !== undefined) out.Code = body.Code;

  if (!partial) {
    for (const field of ["name", "quantity", "price", "alertQuantity"]) {
      if (out[field] === undefined) {
        throw new apiError(`${field} is required`, 400);
      }
    }
  }
  return out;
};

/** Another item already using this name or code. */
const findDuplicate = async ({ name, Code }, excludeId = null) => {
  const exclude = excludeId ? { _id: { $ne: excludeId } } : {};
  if (name) {
    const byName = await Inventory.findOne({ ...exclude, name });
    if (byName) return { field: "name", doc: byName };
  }
  if (Code) {
    const byCode = await Inventory.findOne({ ...exclude, Code });
    if (byCode) return { field: "Code", doc: byCode };
  }
  return null;
};

// @desc add Component
// @Route GET /api/v1/Inventort
// @access private
export const addComponent = asyncHandler(async (req, res, next) => {
  const data = readInventoryBody(req.body || {}, { partial: false });

  const duplicate = await findDuplicate(data);
  if (duplicate) {
    return next(
      new apiError(
        `there is an Component with this ${duplicate.field} , please do update instead of add the id of Component is ${duplicate.doc._id}`,
        400,
      ),
    );
  }

  const newDoc = await Inventory.create(data);
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
export const UpdateComponent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const data = readInventoryBody(req.body || {}, { partial: true });
  if (Object.keys(data).length === 0) {
    return next(new apiError("Nothing to update", 400));
  }

  const duplicate = await findDuplicate(data, id);
  if (duplicate) {
    return next(
      new apiError(
        `another Component already uses this ${duplicate.field} (id ${duplicate.doc._id})`,
        400,
      ),
    );
  }

  const document = await Inventory.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!document) {
    return next(new apiError(`No document for this id ${id}`, 404));
  }
  res.status(200).json({ data: document });
});

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
