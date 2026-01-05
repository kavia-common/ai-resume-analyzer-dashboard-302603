'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ApiError } = require('../utils/apiError');
const config = require('../config');

// Initialize the Google Generative AI client singleton
// We use the configured model or default to 'gemini-2.0-flash'
let genAI = null;
let model = null;

function getModel() {
  if (model) return model;

  if (!config.GEMINI_API_KEY) {
    throw new ApiError(500, 'Server is missing GEMINI_API_KEY configuration.');
  }

  // Initialize if not already done
  genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ 
    model: config.GEMINI_MODEL || 'gemini-2.0-flash' 
  });
  
  return model;
}

/**
 * Build a prompt that strongly encourages strict JSON output.
 * @param {string} text
 * @param {string} jobRole
 * @returns {string}
 */
function buildPrompt(text, jobRole) {
  return [
    'You are an expert ATS resume reviewer.',
    'Analyze the resume below against the provided Job Role.',
    'Return ONLY valid JSON. Do not include markdown formatting, code fences (```json), or any other text.',
    'The JSON schema MUST be exactly:',
    '{',
    '  "summary": "string",',
    '  "strengths": ["string"],',
    '  "gaps": ["string"],',
    '  "ats_tips": ["string"],',
    '  "keyword_match": { "matched": ["string"], "missing": ["string"] }',
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
 * @param {{ text: string, jobRole: string, requestId?: string }} params
 * @returns {Promise<object>}
 */
async function analyzeResumeWithGemini(params) {
  /** This is a public function. */
  const { text, jobRole, requestId } = params || {};

  // Input validation is handled in the controller, but good to be safe here too
  if (!text || typeof text !== 'string') {
    throw new ApiError(400, 'Invalid text input.');
  }

  const generativeModel = getModel();
  const prompt = buildPrompt(text, jobRole);

  // Log intent (without sensitive data)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    level: 'info',
    msg: 'Calling Gemini API',
    requestId,
    model: config.GEMINI_MODEL || 'gemini-2.0-flash',
    promptLength: prompt.length
  }));

  let result;
  try {
    result = await generativeModel.generateContent([prompt]);
  } catch (err) {
    // Map upstream errors to 502
    throw new ApiError(502, 'Gemini API call failed', {
      requestId,
      reason: err.message
    });
  }

  let raw = '';
  try {
    raw = await result.response.text();
  } catch (err) {
    throw new ApiError(502, 'Failed to retrieve text from Gemini response', {
      requestId,
      reason: err.message
    });
  }

  // Default raw to empty string if undefined/null
  raw = raw || '';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Attempt to extract first JSON block using regex if direct parse fails
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        // Still failed
      }
    }

    if (!parsed) {
      throw new ApiError(502, 'Gemini returned non-JSON', {
        requestId,
        rawSnippet: raw.slice(0, 500)
      });
    }
  }

  // Validate required keys
  const requiredKeys = ['summary', 'strengths', 'gaps', 'ats_tips', 'keyword_match'];
  const missingKeys = requiredKeys.filter(key => !Object.prototype.hasOwnProperty.call(parsed, key));

  if (missingKeys.length > 0) {
    throw new ApiError(502, 'Gemini JSON missing required fields', {
      requestId,
      missingKeys,
      foundKeys: Object.keys(parsed)
    });
  }

  // Basic type check for keyword_match structure
  if (!parsed.keyword_match || typeof parsed.keyword_match !== 'object') {
     throw new ApiError(502, 'Gemini JSON missing keyword_match object', {
      requestId
    });
  }

  return parsed;
}

module.exports = { analyzeResumeWithGemini };
