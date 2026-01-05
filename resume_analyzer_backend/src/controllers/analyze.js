'use strict';

const { ApiError } = require('../utils/apiError');
const { analyzeResumeWithGemini } = require('../services/gemini');
const config = require('../config');

const MAX_JOBROLE_CHARS = 200;

class AnalyzeController {
  async analyze(req, res) {
    const { text, jobRole } = req.body || {};

    // Generate a short request ID for correlation (if not already present)
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 9);
    // Attach to req so error handler can see it
    req.requestId = requestId;

    // Detailed entry log
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      level: 'info',
      msg: 'Analyze request received',
      requestId,
      timestamp: new Date().toISOString(),
      payloadKeys: Object.keys(req.body || {}),
      textLength: typeof text === 'string' ? text.length : 0,
      jobRoleLength: typeof jobRole === 'string' ? jobRole.length : 0,
      configuredModel: config.GEMINI_MODEL
    }));

    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new ApiError(400, 'Field "text" is required and must be a non-empty string.');
    }

    if (typeof jobRole !== 'string' || jobRole.trim().length === 0) {
      throw new ApiError(400, 'Field "jobRole" is required and must be a non-empty string.');
    }

    if (jobRole.length > MAX_JOBROLE_CHARS) {
      throw new ApiError(413, 'Field "jobRole" is too long.', { maxChars: MAX_JOBROLE_CHARS });
    }

    const analysis = await analyzeResumeWithGemini({ text, jobRole, requestId });

    // Must return strict JSON matching schema.
    return res.status(200).json(analysis);
  }
}

module.exports = new AnalyzeController();
