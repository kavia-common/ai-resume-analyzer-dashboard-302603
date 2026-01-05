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

    // Log request details
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      level: 'info',
      msg: 'Analyze request received',
      requestId,
      timestamp: new Date().toISOString(),
      payloadSizeText: typeof text === 'string' ? text.length : 0,
      payloadSizeJobRole: typeof jobRole === 'string' ? jobRole.length : 0,
      GEMINI_MODEL: config.GEMINI_MODEL
    }));

    // Validate inputs
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new ApiError(400, 'Field "text" is required and must be a non-empty string.');
    }

    if (typeof jobRole !== 'string' || jobRole.trim().length === 0) {
      throw new ApiError(400, 'Field "jobRole" is required and must be a non-empty string.');
    }

    if (jobRole.length > MAX_JOBROLE_CHARS) {
      throw new ApiError(422, 'Field "jobRole" is too long.', { maxChars: MAX_JOBROLE_CHARS });
    }

    try {
      const analysis = await analyzeResumeWithGemini({ text, jobRole, requestId });
      
      // Log success
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({
        level: 'info',
        msg: 'Analyze request completed successfully',
        requestId,
        timestamp: new Date().toISOString()
      }));

      return res.status(200).json(analysis);

    } catch (error) {
      // If it's already an ApiError, rethrow it to be handled by the global error handler
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Map unexpected errors to a structured 502 or 500 depending on nature,
      // but primarily we try to avoid generic 500s for known upstream issues.
      // If it's a model failure that wasn't caught in service, it lands here.
      
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({
        level: 'error',
        msg: 'Unexpected error in analyze controller',
        requestId,
        error: error.message,
        // We do not leak stack trace in response, only log it here
        stack: error.stack
      }));

      // Default fallback
      throw new ApiError(502, 'An unexpected error occurred during analysis.', { 
        requestId,
        reason: error.message 
      });
    }
  }
}

module.exports = new AnalyzeController();
