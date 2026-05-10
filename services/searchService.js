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

    // لو  محدد حقول معينة للبحث
    if (searchFields.length > 0) {
      fieldsToSearch = searchFields;
    } else {
      //  يبحث في كل الحقول النصية
      fieldsToSearch = Object.keys(Model.schema.paths).filter(
        (path) => Model.schema.paths[path].instance === "String",
      );
    }

    const regex = new RegExp(searchString, "i");

    mongoQuery.$or = fieldsToSearch.map((path) => ({
      [path]: regex,
    }));
  }

  let mongooseQuery = Model.find(mongoQuery).sort(sort).skip(skip).limit(limit);

  if (select) {
    mongooseQuery = mongooseQuery.select(select);
  }

  const documents = await mongooseQuery;

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
