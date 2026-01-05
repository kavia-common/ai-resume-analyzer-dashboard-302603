'use strict';

const { ApiError } = require('../utils/apiError');
const { analyzeResumeWithGemini } = require('../services/gemini');

const MAX_JOBROLE_CHARS = 200;

class AnalyzeController {
  async analyze(req, res) {
    const { text, jobRole } = req.body || {};

    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new ApiError(400, 'Field "text" is required and must be a non-empty string.');
    }

    if (typeof jobRole !== 'string' || jobRole.trim().length === 0) {
      throw new ApiError(400, 'Field "jobRole" is required and must be a non-empty string.');
    }

    if (jobRole.length > MAX_JOBROLE_CHARS) {
      throw new ApiError(413, 'Field "jobRole" is too long.', { maxChars: MAX_JOBROLE_CHARS });
    }

    const analysis = await analyzeResumeWithGemini({ text, jobRole });

    // Must return strict JSON matching schema.
    return res.status(200).json(analysis);
  }
}

module.exports = new AnalyzeController();
