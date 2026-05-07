const cloudinary = require("../utils/cloudinary");
const ApiError = require("../utils/apiError");
const { removeBgExternal } = require("../utils/backgroundRemover");
const changeCarColor = async (req, res, next) => {
  if (!req.file || !req.file.buffer)
    return next(new ApiError("Image is required", 400));

  const { color, oldColor } = req.body;

  if (!color || !oldColor)
    return next(new ApiError("New color and old color are required", 400));

  try {
    const bgRemovedBuffer = await removeBgExternal(req.file.buffer);
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "Cars",
          resource_type: "image",
          transformation: [
            {
              effect: `replace_color:${color}`,
              color: oldColor,
              tolerance: 50,
            },
          ],
        },
        (err, uploadResult) => {
          if (err) return reject(err);
          resolve(uploadResult);
        }
      );

      stream.end(bgRemovedBuffer);
    });

    res.status(200).json({
      status: "success",
      image: result.secure_url,
    });
  } catch (err) {
    next(new ApiError(err.message, 500));
  }
};

module.exports = { changeCarColor };
