const cloudinary = require("../utils/cloudinary");
const ApiError = require("../utils/apiError");
const { removeBgExternal } = require("../utils/backgroundRemover");

exports.processUserImage = async (req, res, next) => {
  if (!req.file || !req.file.buffer) return next();

  try {
    const bgRemovedBuffer = await removeBgExternal(req.file.buffer);

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "Users",
          resource_type: "image",
          format: "png",
          transformation: [
            { width: 500, height: 500, crop: "fill", gravity: "auto" },
          ],
        },
        (err, uploadResult) => {
          if (err) return reject(err);
          resolve(uploadResult);
        }
      );
      stream.end(bgRemovedBuffer);
    });

    req.body.image = result.secure_url;
    req.body.imagePublicId = result.public_id;

    next();
  } catch (err) {
    next(new ApiError(`Error processing image: ${err.message}`, 500));
  }
};
// update user image
exports.UpdateUserImage = async (req, res, next) => {
  if (!req.file || !req.file.buffer) return next();
  try {
    if (req.user?.imagePublicId) {
      await cloudinary.uploader.destroy(req.user.imagePublicId);
    }
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "Users" },
        (err, uploadResult) => {
          if (err) return reject(err);
          resolve(uploadResult);
        }
      );

      stream.end(req.file.buffer);
    });
    req.body.image = result.secure_url;
    req.body.imagePublicId = result.public_id;
    next();
  } catch (err) {
    next(new ApiError(`Error processing image: ${err.message}`, 500));
  }
};
exports.deleteUserImage = async (req, res, next) => {
  if (req.user?.imagePublicId) {
    await cloudinary.uploader.destroy(req.user.imagePublicId);
  }
  req.body.image = null;
  req.body.imagePublicId = null;
  next();
};
