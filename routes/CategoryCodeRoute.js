const express = require("express");
const router = express.Router();

const {
  createCategoryCode,
  getCategoryCode,
  getallCategoryCode,
  updateCategory,
  searchInCategory,
  getallCategoryOnly,
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
 */
router.route("/:id").get(getCategoryCode).put(updateCategory);

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

module.exports = router;
