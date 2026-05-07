const searchService = async ({
  Model,
  searchString,
  baseFilter = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 },
}) => {
  const skip = (page - 1) * limit;

  let mongoQuery = { ...baseFilter };
  if (searchString) {
    const stringFields = Object.keys(Model.schema.paths).filter(
      (path) => Model.schema.paths[path].instance === "String",
    );

    mongoQuery.$or = stringFields.map((path) => ({
      [path]: { $regex: searchString, $options: "i" },
    }));
  }

  const documents = await Model.find(mongoQuery)
    .sort(sort)
    .skip(skip)
    .limit(limit);

  const totalDocuments = await Model.countDocuments(mongoQuery);

  return {
    documents,
    paginationResult: {
      currentPage: page,
      limit,
      numberOfPages: Math.ceil(totalDocuments / limit),
      totalDocuments,
    },
  };
};

module.exports = searchService;
