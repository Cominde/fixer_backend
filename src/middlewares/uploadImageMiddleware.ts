const multer = require("multer");
const ApiError = require("../utils/apiError");

const multerOptions = () => {
  const multerStorage = multer.memoryStorage();

  const multerFilter = function (req, file, cb) {
    console.log("File mimetype:", file.mimetype);
    console.log("File originalname:", file.originalname);
    console.log("File fieldname:", file.fieldname);
    
    // Check mimetype
    if (file.mimetype && file.mimetype.startsWith("image")) {
      cb(null, true);
      return;
    }
    
    // Fallback: check file extension if mimetype is missing or not recognized
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (allowedExtensions.includes(fileExtension)) {
      console.log("Accepted by extension check:", fileExtension);
      cb(null, true);
      return;
    }
    
    cb(new ApiError(`Only Images allowed. Received mimetype: ${file.mimetype || 'missing'}, filename: ${file.originalname}`, 400), false);
  };

  const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter,
  });

  return upload;
};

export const uploadSingleImage = (fieldName) => multerOptions().single(fieldName);

export const uploadMixOfImages = (arrayOfFields) =>
  multerOptions().fields(arrayOfFields);
