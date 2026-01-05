'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ApiError } = require('../utils/apiError');
const { safeJsonParse, normalizeAnalysisResponse } = require('../utils/json');
const config = require('../config');

// A conservative max for text sent to LLM to prevent huge requests.
const MAX_TEXT_CHARS = 60_000;

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
 * PUBLIC_INTERFACE
 * Analyze resume text using Google Gemini and return strict JSON matching our schema.
 * @param {{ text: string, jobRole: string }} params
 * @returns {Promise<object>}
 */
async function analyzeResumeWithGemini(params) {
  /** This is a public function. */
  const { text, jobRole } = params || {};

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

  // Model choice is configurable via env. Default is gemini-2.5-flash.
  // This prevents hardcoding a model that may not exist/enabled in a given project.
  const model = genAI.getGenerativeModel({
    model: config.GEMINI_MODEL,
    generationConfig: {
      // Encourage deterministic structured output.
      temperature: 0.2,
    },
  });

  const prompt = buildPrompt(text, jobRole);

  let rawText = '';
  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text();
  } catch (err) {
    throw new ApiError(502, 'Gemini request failed.', { reason: err.message });
  }

  const parsed = safeJsonParse(rawText);
  if (!parsed) {
    // We must guard against malformed responses (acceptance requirement).
    throw new ApiError(502, 'Gemini returned an invalid JSON response.', {
      example: 'Ensure model output is JSON only',
      receivedSnippet: rawText.slice(0, 500),
    });
  }

  // Enforce strict JSON contract.
  return normalizeAnalysisResponse(parsed);
}

module.exports = { analyzeResumeWithGemini };
