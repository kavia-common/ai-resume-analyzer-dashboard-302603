'use strict';

const express = require('express');
const analyzeController = require('../controllers/analyze');

const router = express.Router();

/**
 * @swagger
 * /analyze:
 *   post:
 *     summary: Analyze resume text for a job role using Google Gemini
 *     description: Provide extracted/pasted resume text and a job role. Returns a strict JSON analysis schema.
 *     tags:
 *       - Resume
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required:
 *               - text
 *               - jobRole
 *             properties:
 *               text:
 *                 type: string
 *                 description: Plain text of the resume
 *                 example: "John Doe\\nSoftware Engineer\\nExperience: ... "
 *               jobRole:
 *                 type: string
 *                 description: Target job role (used for keyword matching and ATS feedback)
 *                 example: "Frontend Developer"
 *     responses:
 *       200:
 *         description: Resume analysis result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: false
 *               required: [summary, strengths, gaps, ats_tips, keyword_match]
 *               properties:
 *                 summary:
 *                   type: string
 *                   example: "Strong frontend background with React and TypeScript..."
 *                 strengths:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["React experience", "Clear bullet points"]
 *                 gaps:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Missing quantified impact", "Limited testing details"]
 *                 ats_tips:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Use standard section headings", "Add relevant keywords from the job description"]
 *                 keyword_match:
 *                   type: object
 *                   additionalProperties: false
 *                   required: [matched, missing]
 *                   properties:
 *                     matched:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["React", "CSS", "JavaScript"]
 *                     missing:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["TypeScript", "Jest", "Accessibility"]
 *       400:
 *         description: Validation error
 *       413:
 *         description: Payload too large
 *       502:
 *         description: Gemini returned invalid response or upstream error
 */
router.post('/analyze', (req, res, next) => analyzeController.analyze(req, res).catch(next));

module.exports = router;
