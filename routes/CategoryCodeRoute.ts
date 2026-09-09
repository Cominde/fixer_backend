const express = require("express");
const router = express.Router();

const {
  createCategoryCode,
  getCategoryCode,
  getallCategoryCode,
  updateCategory,
  searchInCategory,
  getallCategoryOnly,
  suggestNextCodeNumber,
  moveGeneratedCode,
  deleteCategoryCode
} = require("../services/categoryCodeService");

/**
 * @swagger
 * tags:
 *   name: Category Code
 *   description: Car brand and category codes management
 */

/**
 * @swagger
 * /Category:
 *   get:
 *     summary: Get all category codes
 *     tags: [Category Code]
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
 *         description: List of all category codes
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
 *                       brand:
 *                         type: string
 *                         example: "MITSUBISHI"
 *                       category:
 *                         type: string
 *                         example: "LANCER PUMA"
 *                       code:
 *                         type: string
 *                         example: "M-LP"
 *   post:
 *     summary: Create a new category code
 *     tags: [Category Code]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [brand, category]
 *             properties:
 *               brand:
 *                 type: string
 *                 example: "MITSUBISHI"
 *               category:
 *                 type: string
 *                 example: "LANCER PUMA"
 *               code:
 *                 type: string
 *                 example: "M-LP"
 *     responses:
 *       201:
 *         description: Category code created successfully
 *       400:
 *         description: Validation error
 */
router.route("/").post(createCategoryCode).get(getallCategoryCode);

/**
 * @swagger
 * /Category/category/fordrop:
 *   get:
 *     summary: Get all categories formatted for dropdown lists
 *     tags: [Category Code]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories list for dropdown
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
 *                       brand:
 *                         type: string
 *                       category:
 *                         type: string
 */
router.route("/category/fordrop/").get(getallCategoryOnly);
/**
 * @swagger
 * /Category/moveCode:
 *   put:
 *     summary: Move a car's generatedCode to another category
 *     tags: [Category Code]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentCode, targetCategory]
 *             properties:
 *               currentCode:
 *                 type: string
 *                 example: "E11"
 *                 description: The current generatedCode of the car
 *               targetCategory:
 *                 type: string
 *                 example: "LANCER PUMA"
 *                 description: The target category name to move the car to
 *     responses:
 *       200:
 *         description: Code moved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Code moved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     oldCode:
 *                       type: string
 *                       example: "E11"
 *                     newGeneratedCode:
 *                       type: string
 *                       example: "C410"
 *                     targetCategory:
 *                       type: string
 *                       example: "LANCER PUMA"
 *                     lastNumber:
 *                       type: integer
 *                       example: 409
 *                     nextNumber:
 *                       type: integer
 *                       example: 410
 *       400:
 *         description: Validation error
 *       404:
 *         description: Car or category not found
 */
router.route("/moveCode").put(moveGeneratedCode);

/**
 * @swagger
 * /Category/{id}:
 *   get:
 *     summary: Get a specific category code by ID
 *     tags: [Category Code]
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
 *         description: Category code details
 *       404:
 *         description: Category code not found
 *   put:
 *     summary: Update a category code
 *     tags: [Category Code]
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
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brand:
 *                 type: string
 *               category:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category code updated successfully
 *       404:
 *         description: Category code not found
 *   delete:
 *     summary: Delete a category code (only if no cars are using it)
 *     tags: [Category Code]
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
 *         description: Category code deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Category deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     category:
 *                       type: string
 *                       example: "LANCER PUMA"
 *                     code:
 *                       type: string
 *                       example: "C"
 *       400:
 *         description: Cannot delete - cars are using this category code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Cannot delete category. There are 5 cars using this category code."
 *       404:
 *         description: Category code not found
 */
router.route("/:id").get(getCategoryCode).put(updateCategory).delete(deleteCategoryCode);

/**
 * @swagger
 * /Category/search/{searchString}:
 *   get:
 *     summary: Search category codes by brand or category name
 *     tags: [Category Code]
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
 *         description: Matching category codes
 */
router.route("/search/:searchString").get(searchInCategory);
/**
 * @swagger
 * /Category/nextCode/{Code}:
 *   get:
 *     summary: Get the last used number and the suggested next number for a category code
 *     tags: [Category Code]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: Code
 *         required: true
 *         schema:
 *           type: string
 *         example: "M-LP"
 *         description: The category code to check (e.g. "M-LP")
 *     responses:
 *       200:
 *         description: Last used number and suggested next number
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "M-LP"
 *                     lastNumber:
 *                       type: integer
 *                       example: 5
 *                     nextNumber:
 *                       type: integer
 *                       example: 6
 *                     nextGeneratedCode:
 *                       type: string
 *                       example: "M-LP6"
 *       400:
 *         description: No category found with this code
 */
router.route("/nextCode/:code").get(suggestNextCodeNumber);



export = router;
