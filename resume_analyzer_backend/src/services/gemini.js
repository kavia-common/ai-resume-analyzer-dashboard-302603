'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ApiError } = require('../utils/apiError');
const { safeJsonParse, normalizeAnalysisResponse } = require('../utils/json');
const config = require('../config');

// A conservative max for text sent to LLM to prevent huge requests.
const MAX_TEXT_CHARS = 60_000;

// Safe fallback model if the configured model is not available for the current API key/project.
const FALLBACK_GEMINI_MODEL = 'gemini-2.0-flash';

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
 * We keep this intentionally heuristic because different environments/versions shape errors differently.
 * @param {any} err
 * @returns {boolean}
 */
function isUnsupportedModelError(err) {
  const status = err && (err.status || err.statusCode || err.code);
  const message = String((err && err.message) || '');
  const bodyText = String((err && err.response && err.response.data) || '');

  // Common signals:
  // - 404 / NOT_FOUND (model doesn't exist or not enabled)
  // - message mentions model not found / unsupported / not available
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
      // Encourage deterministic structured output.
      temperature: 0.2,
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * PUBLIC_INTERFACE
 * Analyze resume text using Google Gemini and return strict JSON matching our schema.
 * @param {{ text: string, jobRole: string }} params
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
      responseBody: err.response && err.response.data
    };

    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Gemini primary model failed',
      requestId,
      model: primaryModelName,
      error: errorDetails
    }));

    // If the configured model is unavailable, retry once with a safe default.
    if (isUnsupportedModelError(err) && primaryModelName !== fallbackModelName) {
      try {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({
          level: 'warn',
          msg: 'Retrying with fallback model',
          requestId,
          fallbackModel: fallbackModelName
        }));

        rawText = await generateWithModel(genAI, fallbackModelName, prompt);
      } catch (fallbackErr) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({
          level: 'error',
          msg: 'Gemini fallback model failed',
          requestId,
          model: fallbackModelName,
          error: {
            status: fallbackErr.status || fallbackErr.statusCode,
            message: fallbackErr.message,
            responseBody: fallbackErr.response && fallbackErr.response.data
          }
        }));

        throw new ApiError(502, 'Gemini request failed for both primary and fallback models.', {
          primaryModel: primaryModelName,
          fallbackModel: fallbackModelName,
          primaryError: err && err.message ? err.message : String(err),
          fallbackError: fallbackErr && fallbackErr.message ? fallbackErr.message : String(fallbackErr),
          hint: 'Verify model availability for your API key/project. Consider listing available models via the Gemini "ListModels" API and update GEMINI_MODEL.',
        });
      }
    } else {
      // Not a model-availability issue (or fallback not applicable): fail fast.
      throw new ApiError(502, 'Gemini request failed.', {
        model: primaryModelName,
        reason: err && err.message ? err.message : String(err),
      });
    }
  }

  const parsed = safeJsonParse(rawText);
  if (!parsed) {
    // We must guard against malformed responses (acceptance requirement).
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      level: 'error',
      msg: 'Gemini returned invalid JSON',
      requestId,
      snippet: rawText.slice(0, 200)
    }));

    throw new ApiError(502, 'Gemini returned an invalid JSON response.', {
      model: primaryModelName,
      example: 'Ensure model output is JSON only',
      receivedSnippet: rawText.slice(0, 500),
    });
  }

  // Enforce strict JSON contract.
  return normalizeAnalysisResponse(parsed);
}

module.exports = { analyzeResumeWithGemini };
