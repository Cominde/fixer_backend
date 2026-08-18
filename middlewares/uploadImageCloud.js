const cloudinary = require("../utils/cloudinary");
const ApiError = require("../utils/apiError");
const Car = require("../models/Car");
const { removeBgExternal } = require("../utils/backgroundRemover");

// @desc    save user image on cloudinary
// @route   Post /api/v2/user/
// @access  public
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
        },
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
// @desc    save user image in data base
// @route   put /api/v2/user/:id
// @access  public
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
        },
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
// @desc    delete user image from data base
// @route   delete /api/v2/user/:id
// @access  public
exports.deleteUserImage = async (req, res, next) => {
  if (req.user?.imagePublicId) {
    await cloudinary.uploader.destroy(req.user.imagePublicId);
  }
  req.body.image = null;
  req.body.imagePublicId = null;
  next();
};

// @desc    save car image in cloudinary
// @route   post /api/v2/Garage/updateCarsImageInDB/
// @access  public
exports.processCarImage = async (req, res, next) => {
  if (!req.file || !req.file.buffer) return next();

  try {
    const bgRemovedBuffer = await removeBgExternal(req.file.buffer);

    const { brand, category, model, color } = req.body;
    const fileName = `${brand}.${category}.${model}.${color}`
      .toLowerCase()
      .replace(/\s+/g, "_");
    const publicId = `Cars/${fileName}`;

    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      console.log(`🗑️ Old image deleted: ${publicId}`);
    } catch (err) {
      // Image didn't exist — no problem, continue
      console.log(`ℹ️ No existing image to delete: ${publicId}`);
    }
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "Cars",
          public_id: fileName,
          resource_type: "image",
          format: "png",
          transformation: [
            { effect: "trim:10" },
            { width: 1920, height: 1080, crop: "fill", gravity: "center"},
            ,
          ],
        },
        (err, uploadResult) => {
          if (err) return reject(err);
          resolve(uploadResult);
        },
      );
      stream.end(bgRemovedBuffer);
    });

    req.body.image = result.secure_url;
    req.body.imagePublicId = result.public_id;

    // Update all cars with the same brand, category, model, and color
    await Car.updateMany(
      {
        brand: brand,
        category: category,
        model: model,
        color: color,
      },
      {
        $set: {
          image: result.secure_url,
          imagePublicId: result.public_id,
        },
      },
    );

    return res.status(200).json({
      status: "success",
      message: "Car image uploaded and DB updated successfully",
      image: result.secure_url,
      imagePublicId: result.public_id,
    });
  } catch (err) {
    next(new ApiError(`Error processing image: ${err.message}`, 500));
  }
};
// @desc    save user image in dataBase
// @route   post /api/v2/car/:id
// @access  public
exports.updateCarImage = async (req, res, next) => {
  if (!req.file || !req.file.buffer) return next();

  try {
    // 1. Get the car by id from the database
    const car = await Car.findById(req.params.id);
    if (!car) return next(new ApiError("Car not found", 404));

    const { brand, category, model, color } = car;

    // 2. Build filename from car fields
    const fileName = `${brand}.${category}.${model}.${color}`
      .toLowerCase()
      .replace(/\s+/g, "_");

    const expectedPublicId = `Cars/${fileName}`;
    const bgRemovedBuffer = await removeBgExternal(req.file.buffer);
    // 3. Delete existing image if it exists on Cloudinary
    try {
      await cloudinary.uploader.destroy(expectedPublicId, { resource_type: "image" });
      console.log(`🗑️ Old image deleted: ${expectedPublicId}`);
    } catch (err) {
      // Image didn't exist — no problem, continue
      console.log(`ℹ️ No existing image to delete: ${expectedPublicId}`);
    }

    // 4. Upload new image to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "Cars",
          public_id: fileName,
          resource_type: "image",
          format: "png",
          transformation: [
            { width: 1920, height: 1080, crop: "fill", gravity: "center" },
          ],
        },
        (err, uploadResult) => {
          if (err) return reject(err);
          resolve(uploadResult);
        },
      );
      stream.end(bgRemovedBuffer);
    });

    // 5. Set image to req.body for updateCar middleware
    req.body.image = result.secure_url;
    req.body.imagePublicId = result.public_id;
    next();
  } catch (err) {
    next(new ApiError(`Error updating car image: ${err.message}`, 500));
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