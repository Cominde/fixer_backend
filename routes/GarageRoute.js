const express = require("express");
const router = express.Router();

const {
  addCar,
  getCars,
  getRepairingCars,
  makeCarInRepair,
  searchForallCars,
  searchForRepairingCars,
  updateCar,
  getCar,
  deleteCar,
  getUniqueBrands,
  setCarImg,
} = require("../services/GarageServices");
const { uploadSingleImage } = require("../middlewares/uploadImageMiddleware");
const {
  processCarImage,
  updateCarImage,
} = require("../middlewares/uploadImageCloud");
const { checkPermission } = require("../middlewares/checkPermission");

/**
 * @swagger
 * tags:
 *   name: Garage
 *   description: Car garage management
 */

/**
 * @swagger
 * /Garage:
 *   get:
 *     summary: Get all cars
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: List of all cars
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       carNumber:
 *                         type: string
 *                         example: "أ ن ق - 217"
 *                       brand:
 *                         type: string
 *                         example: "MITSUBISHI"
 *                       category:
 *                         type: string
 *                         example: "LANCER PUMA"
 *                       color:
 *                         type: string
 *                         example: "فضي"
 *                       repairing:
 *                         type: boolean
 *                         example: false
 */
router.route("/").get(checkPermission("cars.view"), getCars);

/**
 * @swagger
 * /Garage/repairing:
 *   get:
 *     summary: Get all cars currently in repair
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of cars currently in repair
 */
router.route("/repairing").get(checkPermission("cars.view"), getRepairingCars);

/**
 * @swagger
 * /Garage/getCarsInDB:
 *   get:
 *     summary: Get all unique car brands in the database
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of unique brands
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["MITSUBISHI", "BMW", "TOYOTA"]
 */
router.route("/getCarsInDB/").get(checkPermission("cars.view"), getUniqueBrands);

/**
 * @swagger
 * /Garage/cloudeniry/updateCarsImageInDB:
 *   post:
 *     summary: (for developer) Upload image on Cloudinary and save the image to all cars with the same (brand , category , model , color)
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded and processed successfully
 */
router
  .route("/cloudeniry/updateCarsImageInDB")
  .post(uploadSingleImage("image"), processCarImage);

/**
 * @swagger
 * /Garage/search/{searchString}:
 *   get:
 *     summary: Search all cars by keyword
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: searchString
 *         required: true
 *         schema:
 *           type: string
 *         example: "MITSUBISHI"
 *     responses:
 *       200:
 *         description: Matching cars
 */
router.route("/search/:searchString").get(checkPermission("cars.view"), searchForallCars);

/**
 * @swagger
 * /Garage/search/repairing/{searchString}:
 *   get:
 *     summary: Search cars currently in repair by keyword
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: searchString
 *         required: true
 *         schema:
 *           type: string
 *         example: "BMW"
 *     responses:
 *       200:
 *         description: Matching cars in repair
 */
router.route("/search/repairing/:searchString").get(checkPermission("cars.view"), searchForRepairingCars);

/**
 * @swagger
 * /Garage/getCar/{id}:
 *   get:
 *     summary: Get a specific car by its ID
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6734de56e41091cfb6b02f7e"
 *     responses:
 *       200:
 *         description: Car details
 *       404:
 *         description: Car not found
 */
router.route("/getCar/:id").get(checkPermission("cars.view"), getCar);

/**
 * @swagger
 * /Garage/add/{id}:
 *   post:
 *     summary: Add a new car to a user's garage
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *         example: "6735c716e41091cfb6b03563"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [carNumber, chassisNumber, brand, category, model, color]
 *             properties:
 *               carNumber:
 *                 type: string
 *                 example: "أ ن ق - 217"
 *               chassisNumber:
 *                 type: string
 *                 example: "U004868"
 *               brand:
 *                 type: string
 *                 example: "MITSUBISHI"
 *               category:
 *                 type: string
 *                 example: "LANCER PUMA"
 *               model:
 *                 type: string
 *                 example: "2010"
 *               color:
 *                 type: string
 *                 example: "فضي"
 *               motorNumber:
 *                 type: string
 *                 example: "2992"
 *     responses:
 *       201:
 *         description: Car added successfully
 *       400:
 *         description: Invalid car number format
 *       404:
 *         description: User not found
 */
router.route("/add/:id").post(checkPermission("cars.add"), addCar);

/**
 * @swagger
 * /Garage/update/{id}:
 *   put:
 *     summary: Update car details and optionally its image
 *     tags: [Garage]
 *     x-category: system
 *     x-status: "updated"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6734de56e41091cfb6b02f7e"
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               carNumber:
 *                 type: string
 *                 example: "أ ن ق - 217"
 *               brand:
 *                 type: string
 *               category:
 *                 type: string
 *               color:
 *                 type: string
 *               model:
 *                 type: string
 *     responses:
 *       200:
 *         description: Car updated successfully
 *       404:
 *         description: Car not found
 */
router
  .route("/updateCar/:id")
  .put(checkPermission("cars.edit"), uploadSingleImage("image"), updateCarImage, updateCar);

/**
 * @swagger
 * /Garage/delete/{id}:
 *   delete:
 *     summary: Delete a car by ID
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "6734de56e41091cfb6b02f7e"
 *     responses:
 *       200:
 *         description: Car deleted successfully
 *       404:
 *         description: Car not found
 */
router.route("/delete/:id").delete(checkPermission("cars.delete"), deleteCar);

/**
 * @swagger
 * /Garage/{carNumber}:
 *   put:
 *     summary: Toggle car repair status by car number
 *     tags: [Garage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: carNumber
 *         required: true
 *         schema:
 *           type: string
 *         example: "أ ن ق - 217"
 *     responses:
 *       200:
 *         description: Car repair state updated
 *       404:
 *         description: Car not found
 */
router.route("/:carNumber").put(checkPermission("cars.edit"), makeCarInRepair);
/**
 * @swagger
 * /Garage/carImg/setCarImg/:
 *   put:
 *     summary: Set or generate a car image
 *     description:
 *       Either generate a car image automatically from imagin.studio using
 *       brand/model/category/color, or upload a custom image file.
 *       The resulting Cloudinary URL is saved to the matching car document.
 *     tags:
 *       - Cars
 *     x-category: system
 *     x-status: "new"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - method
 *               - brand
 *               - model
 *               - category
 *               - color
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [generate, upload]
 *                 description: >
 *                   "generate" fetches & processes image from imagin.studio.
 *                   "upload" uses the uploaded file directly.
 *                 example: generate
 *               brand:
 *                 type: string
 *                 description: Car make — used to find the car document and build the imagin.studio URL.
 *                 example: bmw
 *               model:
 *                 type: string
 *                 description: Model year suffix passed to imagin.studio.
 *                 example: "24"
 *               category:
 *                 type: string
 *                 description: Body type / model family — used to find the car document and build the URL.
 *                 example: sedan
 *               color:
 *                 type: string
 *                 description: Paint color name passed to imagin.studio.
 *                 example: red
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image file — required only when method is "upload".
 *     responses:
 *       200:
 *         description: Image processed and saved to car document successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicId:
 *                   type: string
 *                   example: cars/bmw_24_sedan_red
 *                 url:
 *                   type: string
 *                   example: https://res.cloudinary.com/dcj7fkdub/image/upload/cars/bmw_24_sedan_red.jpg
 *                 width:
 *                   type: integer
 *                   example: 1920
 *                 height:
 *                   type: integer
 *                   example: 1080
 *                 bytes:
 *                   type: integer
 *                   example: 204800
 *       400:
 *         description: Missing required fields or invalid method value.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: method, brand, model, category and color are required
 *       404:
 *         description: No car found matching the given brand, model and category.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Can't find car with brand: bmw, model: 24, category: sedan"
 *       500:
 *         description: Upstream error from imagin.studio or Cloudinary.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */
router.route("/carImg/setCarImg").put(checkPermission("cars.image.generate"), uploadSingleImage("image"), setCarImg);
module.exports = router;
