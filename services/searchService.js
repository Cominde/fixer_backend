const { normalizeCarNumber } = require("../utils/carNumberCheck"); // adjust path

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: build all car number format variants the DB might have stored
// ─────────────────────────────────────────────────────────────────────────────
const buildCarNumberVariants = (str) => {
  const variants = new Set();
  variants.add(str);

  const canonical = str.match(
    /^(\d+)\s*-\s*([\u0600-\u06FF][\u0600-\u06FF\s]*)$/,
  );

  if (canonical) {
    const digits = canonical[1].trim();
    const letters = canonical[2].trim();
    const lettersNoSpace = letters.replace(/\s+/g, "");

    // digits first
    variants.add(`${digits} - ${letters}`);
    variants.add(`${digits}-${letters}`);
    variants.add(`${digits} -${letters}`);
    variants.add(`${digits}- ${letters}`);

    // letters first
    variants.add(`${letters} - ${digits}`);
    variants.add(`${letters}-${digits}`);
    variants.add(`${letters} -${digits}`);
    variants.add(`${letters}- ${digits}`);

    // no spaces between letters
    variants.add(`${digits} - ${lettersNoSpace}`);
    variants.add(`${digits}-${lettersNoSpace}`);
    variants.add(`${lettersNoSpace} - ${digits}`);
    variants.add(`${lettersNoSpace}-${digits}`);
  }

  return [...variants];
};

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: escape special regex characters
// ─────────────────────────────────────────────────────────────────────────────
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─────────────────────────────────────────────────────────────────────────────
//  GENERIC SEARCH  — users, categories, any string-field model
// ─────────────────────────────────────────────────────────────────────────────
const searchService = async ({
  Model,
  searchString,
  baseFilter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
  searchFields = [],
  select = "",
}) => {
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;

  const skip = (page - 1) * limit;

  let mongoQuery = { ...baseFilter };

  if (searchString) {
    let fieldsToSearch;

    if (searchFields.length > 0) {
      fieldsToSearch = searchFields;
    } else {
      // auto-detect all string fields on the schema
      fieldsToSearch = Object.keys(Model.schema.paths).filter(
        (path) => Model.schema.paths[path].instance === "String",
      );
    }

    const regex = new RegExp(escapeRegex(searchString), "i");

    mongoQuery.$or = fieldsToSearch.map((path) => ({
      [path]: { $regex: regex },
    }));
  }

  let mongooseQuery = Model.find(mongoQuery).sort(sort).skip(skip).limit(limit);

  if (select) mongooseQuery = mongooseQuery.select(select);

  const [documents, totalDocuments] = await Promise.all([
    mongooseQuery,
    Model.countDocuments(mongoQuery),
  ]);

  const numberOfPages = Math.ceil(totalDocuments / limit);

  const paginationResult = {
    currentPage: page,
    limit,
    numberOfPages,
    totalDocuments,
  };

  if (page < numberOfPages) paginationResult.next = page + 1;
  if (page > 1) paginationResult.prev = page - 1;

  return { documents, paginationResult };
};

// ─────────────────────────────────────────────────────────────────────────────
//  CAR SEARCH  — handles all Arabic car number format variants and attribute search
// ─────────────────────────────────────────────────────────────────────────────
const searchCarService = async ({
  Model,
  searchString,
  brand,
  category,
  model,
  baseFilter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
  select = "",
  searchField = "carNumber", // ← new param, default is Car model
}) => {
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;
  const skip = (page - 1) * limit;

  const mongoQuery = { ...baseFilter };

  // Search by car number (with Arabic format variants) if searchString is provided
  if (searchString) {
    const normalized = normalizeCarNumber(searchString);
    const variants = buildCarNumberVariants(normalized);
    const regexPattern = variants.map(escapeRegex).join("|");
    const searchRegex = new RegExp(regexPattern, "i");
    mongoQuery[searchField] = { $regex: searchRegex };
  }

  // Search by attributes (brand, category, model) - optional filters
  if (brand && brand.trim()) {
    mongoQuery.brand = { $regex: new RegExp(escapeRegex(brand.trim()), "i") };
  }
  if (category && category.trim()) {
    mongoQuery.category = { $regex: new RegExp(escapeRegex(category.trim()), "i") };
  }
  if (model && model.trim()) {
    mongoQuery.model = { $regex: new RegExp(escapeRegex(model.trim()), "i") };
  }

  let mongooseQuery = Model.find(mongoQuery).sort(sort).skip(skip).limit(limit);
  if (select) mongooseQuery = mongooseQuery.select(select);

  const [documents, totalDocuments] = await Promise.all([
    mongooseQuery,
    Model.countDocuments(mongoQuery),
  ]);

  const numberOfPages = Math.ceil(totalDocuments / limit);
  const paginationResult = {
    currentPage: page,
    limit,
    numberOfPages,
    totalDocuments,
  };

  if (page < numberOfPages) paginationResult.next = page + 1;
  if (page > 1) paginationResult.prev = page - 1;

  return { documents, paginationResult };
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = { searchService, searchCarService };
