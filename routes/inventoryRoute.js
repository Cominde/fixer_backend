const express = require("express");
const router = express.Router();

const {
  addComponent,
  getAllCom,
  UpdateComponent,
  getCom,
  searchCom,
  getAllUnits,
} = require("../services/InventoryServies");

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Spare parts inventory management
 */

/**
 * @swagger
 * /Inventort:
 *   get:
 *     summary: Get all inventory components
 *     tags: [Inventory]
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
 *         description: List of all inventory components
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
 *                       name:
 *                         type: string
 *                         example: "زيت محرك"
 *                       unit:
 *                         type: string
 *                         example: "لتر"
 *                       quantity:
 *                         type: number
 *                         example: 50
 *                       price:
 *                         type: number
 *                         example: 150
 *   post:
 *     summary: Add a new component to inventory
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, unit, quantity]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "زيت محرك"
 *               unit:
 *                 type: string
 *                 example: "لتر"
 *               quantity:
 *                 type: number
 *                 example: 50
 *               price:
 *                 type: number
 *                 example: 150
 *     responses:
 *       201:
 *         description: Component added successfully
 *       400:
 *         description: Validation error
 */
router.route("/").get(getAllCom).post(addComponent);

/**
 * @swagger
 * /Inventort/Units:
 *   get:
 *     summary: Get all available measurement units
 *     tags: [Inventory]
 *     x-category: system
 *     x-status: "new"
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of measurement units
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["لتر", "كيلو", "قطعة"]
 */
router.route("/Units/").get(getAllUnits);

/**
 * @swagger
 * /Inventort/{id}:
 *   get:
 *     summary: Get a specific inventory component by ID
 *     tags: [Inventory]
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
 *         description: Component details
 *       404:
 *         description: Component not found
 *   put:
 *     summary: Update an inventory component
 *     tags: [Inventory]
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
 *               name:
 *                 type: string
 *               unit:
 *                 type: string
 *               quantity:
 *                 type: number
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Component updated successfully
 *       404:
 *         description: Component not found
 */
router.route("/:id").get(getCom).put(UpdateComponent);

/**
 * @swagger
 * /Inventort/search/{searchString}:
 *   get:
 *     summary: Search inventory components by name
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: searchString
 *         required: true
 *         schema:
 *           type: string
 *         example: "زيت"
 *     responses:
 *       200:
 *         description: Matching inventory components
 */
router.route("/search/:searchString").get(searchCom);

module.exports = router;
