'use strict';

const express = require('express');
const uploadController = require('../controllers/upload');
const { upload } = require('../middleware/upload');

const router = express.Router();

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload a resume file (PDF or DOCX) and extract plain text
 *     description: Accepts a single multipart/form-data file field named `file`. Returns extracted text and basic metadata.
 *     tags:
 *       - Resume
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Resume file (PDF or DOCX)
 *     responses:
 *       200:
 *         description: Extracted resume text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: false
 *               required:
 *                 - text
 *                 - metadata
 *               properties:
 *                 text:
 *                   type: string
 *                   example: "John Doe\\nSoftware Engineer\\n... "
 *                 metadata:
 *                   type: object
 *                   additionalProperties: false
 *                   required: [filename, size, type]
 *                   properties:
 *                     filename:
 *                       type: string
 *                       example: "resume.pdf"
 *                     size:
 *                       type: integer
 *                       example: 254321
 *                     type:
 *                       type: string
 *                       example: "application/pdf"
 *       400:
 *         description: Invalid request (missing file or invalid type)
 *       413:
 *         description: File too large
 */
router.post(
  '/upload',
  upload.single('file'),
  // Wrap async controller to forward errors to Express error handler.
  (req, res, next) => uploadController.upload(req, res).catch(next)
);

module.exports = router;
