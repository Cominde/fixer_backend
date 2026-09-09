const express = require("express");
const router = express.Router();

const {
  cleanBrands,
  cleanCategories,
  getAllBrands,
  getAllCategory,
} = require("../services/clean_car_data");

/**
 * @swagger
 * tags:
 *   name: Car Data Cleanup
 *   description: Clean and normalize car brands and categories in the database
 */

/**
 * @swagger
 * /ClearCarData/brands:
 *   get:
 *     summary: Get all car brands from the database
 *     tags: [Car Data Cleanup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all car brands
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["MITSUBISHI", "BMW", "TOYOTA", "mitsubishi"]
 *   put:
 *     summary: Clean and normalize all car brand names in the database
 *     tags: [Car Data Cleanup]
 *     security:
 *       - bearerAuth: []
 *     description: Normalizes brand names by converting to uppercase and removing duplicates
 *     responses:
 *       200:
 *         description: Brands cleaned and normalized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Brands cleaned successfully"
 *                 fixed:
 *                   type: number
 *                   example: 15
 */
router.route("/brands").get(getAllBrands).put(cleanBrands);

/**
 * @swagger
 * /ClearCarData/categories:
 *   get:
 *     summary: Get all car categories from the database
 *     tags: [Car Data Cleanup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all car categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["LANCER PUMA", "lancer puma", "PAJERO"]
 *   put:
 *     summary: Clean and normalize all car category names in the database
 *     tags: [Car Data Cleanup]
 *     security:
 *       - bearerAuth: []
 *     description: Normalizes category names by converting to uppercase and removing duplicates
 *     responses:
 *       200:
 *         description: Categories cleaned and normalized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Categories cleaned successfully"
 *                 fixed:
 *                   type: number
 *                   example: 22
 */
router.route("/categories").get(getAllCategory).put(cleanCategories);

export = router;
