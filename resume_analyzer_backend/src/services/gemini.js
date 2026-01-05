'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ApiError } = require('../utils/apiError');
const { safeJsonParse, normalizeAnalysisResponse } = require('../utils/json');
const config = require('../config');

// A conservative max for text sent to LLM to prevent huge requests.
const MAX_TEXT_CHARS = 60_000;

// Safe fallback model if the configured model is not available.
// We swap logic: Default is 2.0-flash (via config), fallback is 2.5-flash (or older stable).
const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Build a prompt that strongly encourages strict JSON output.
 * @param {string} text
 * @param {string} jobRole
 * @returns {string}
 */
function buildPrompt(text, jobRole) {
  return [
    'You are an expert ATS resume reviewer.',
    'Return ONLY valid JSON (no markdown, no code fences, no extra text).',
    'The JSON schema MUST be:',
    '{',
    '  "summary": string,',
    '  "strengths": string[],',
    '  "gaps": string[],',
    '  "ats_tips": string[],',
    '  "keyword_match": { "matched": string[], "missing": string[] }',
    '}',
    '',
    `Job Role: ${jobRole}`,
    '',
    'Resume Text:',
    text,
  ].join('\n');
}

/**
 * Detect whether an upstream Gemini error is likely caused by an unsupported/unavailable model.
 * @param {any} err
 * @returns {boolean}
 */
function isUnsupportedModelError(err) {
  const status = err && (err.status || err.statusCode || err.code);
  const message = String((err && err.message) || '');
  const bodyText = String((err && err.response && err.response.data) || '');

  if (status === 404 || status === 'NOT_FOUND') return true;

  const haystack = `${message}\n${bodyText}`.toLowerCase();
  return (
    haystack.includes('model') &&
    (haystack.includes('not found') ||
      haystack.includes('unsupported') ||
      haystack.includes('not supported') ||
      haystack.includes('not available') ||
      haystack.includes('does not exist'))
  );
}

/**
 * Call Gemini using a specific model name.
 * @param {GoogleGenerativeAI} genAI
 * @param {string} modelName
 * @param {string} prompt
 * @returns {Promise<string>} raw text response
 */
async function generateWithModel(genAI, modelName, prompt) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2, // Deterministic structured output
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * PUBLIC_INTERFACE
 * Analyze resume text using Google Gemini and return strict JSON matching our schema.
 * @param {{ text: string, jobRole: string, requestId?: string }} params
 * @returns {Promise<object>}
 */
async function analyzeResumeWithGemini(params) {
  /** This is a public function. */
  const { text, jobRole, requestId } = params || {};

  if (!config.GEMINI_API_KEY) {
    throw new ApiError(500, 'Server is missing GEMINI_API_KEY configuration.');
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new ApiError(400, 'Field "text" is required and must be a non-empty string.');
  }

  if (text.length > MAX_TEXT_CHARS) {
    throw new ApiError(413, 'Resume text is too large.', { maxChars: MAX_TEXT_CHARS });
  }

  if (typeof jobRole !== 'string' || jobRole.trim().length === 0) {
    throw new ApiError(400, 'Field "jobRole" is required and must be a non-empty string.');
  }

  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  const prompt = buildPrompt(text, jobRole);

  const primaryModelName = config.GEMINI_MODEL;
  const fallbackModelName = FALLBACK_GEMINI_MODEL;

  // Log intent to call Gemini
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    level: 'info',
    msg: 'Calling Gemini API',
    requestId,
    model: primaryModelName,
    promptLength: prompt.length
  }));

  let rawText = '';
  try {
    rawText = await generateWithModel(genAI, primaryModelName, prompt);
  } catch (err) {
    const errorDetails = {
      status: err.status || err.statusCode,
      message: err.message,
    };

    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Gemini primary model failed',
      requestId,
      model: primaryModelName,
      error: errorDetails
    }));

    // If primary failed with model-related error, try fallback.
    // Also try fallback if it's a generic 500/503 from Google, as sometimes specific models have outages.
    if (primaryModelName !== fallbackModelName) {
      try {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({
          level: 'warn',
          msg: 'Retrying with fallback model',
          requestId,
          fallbackModel: fallbackModelName
        }));

        rawText = await generateWithModel(genAI, fallbackModelName, prompt);
        
        // Log success on fallback
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({
          level: 'info',
          msg: 'Fallback model succeeded',
          requestId,
          model: fallbackModelName
        }));

      } catch (fallbackErr) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({
          level: 'error',
          msg: 'Gemini fallback model also failed',
          requestId,
          model: fallbackModelName,
          error: {
            status: fallbackErr.status || fallbackErr.statusCode,
            message: fallbackErr.message
          }
        }));

        // Return a safe 502 error structure
        throw new ApiError(502, 'Resume analysis unavailable. Both primary and fallback models failed.', {
          requestId,
          primaryModel: primaryModelName,
          fallbackModel: fallbackModelName,
          reason: 'Upstream AI service error'
        });
      }
    } else {
      // No fallback possible
      throw new ApiError(502, 'Resume analysis failed.', {
        requestId,
        model: primaryModelName,
        reason: err.message || 'Upstream error'
      });
    }
  }

  const parsed = safeJsonParse(rawText);
  if (!parsed) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Gemini returned invalid JSON',
      requestId,
      snippet: rawText.slice(0, 200)
    }));

    throw new ApiError(502, 'AI returned an invalid response format.', {
      requestId,
      model: primaryModelName
    });
  }

  // Enforce strict JSON contract.
  return normalizeAnalysisResponse(parsed);
}

module.exports = { analyzeResumeWithGemini };
