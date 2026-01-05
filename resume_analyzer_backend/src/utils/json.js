'use strict';

/**
 * Attempt to parse JSON from a string.
 * Gemini sometimes returns JSON wrapped in code fences or with some extra explanation.
 * This helper tries to extract the first JSON object found.
 * @param {string} raw
 * @returns {any}
 */
function safeJsonParse(raw) {
  if (typeof raw !== 'string') return null;

  // Remove common Markdown code fences if present.
  const cleaned = raw
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim();

  // Fast path: raw is already JSON.
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continue
  }

  // Attempt to locate the first JSON object in the string.
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const maybeJson = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(maybeJson);
  } catch (_) {
    return null;
  }
}

/**
 * Strictly shape the analysis output so the API always returns the expected schema.
 * Missing fields are replaced with safe defaults.
 * @param {any} input
 * @returns {object}
 */
function normalizeAnalysisResponse(input) {
  const obj = input && typeof input === 'object' ? input : {};

  const summary = typeof obj.summary === 'string' ? obj.summary : '';
  const strengths = Array.isArray(obj.strengths) ? obj.strengths.filter((s) => typeof s === 'string') : [];
  const gaps = Array.isArray(obj.gaps) ? obj.gaps.filter((s) => typeof s === 'string') : [];
  const ats_tips = Array.isArray(obj.ats_tips) ? obj.ats_tips.filter((s) => typeof s === 'string') : [];

  const keyword_match = obj.keyword_match && typeof obj.keyword_match === 'object'
    ? obj.keyword_match
    : {};

  const matched = Array.isArray(keyword_match.matched)
    ? keyword_match.matched.filter((s) => typeof s === 'string')
    : [];

  const missing = Array.isArray(keyword_match.missing)
    ? keyword_match.missing.filter((s) => typeof s === 'string')
    : [];

  return {
    summary,
    strengths,
    gaps,
    ats_tips,
    keyword_match: { matched, missing },
  };
}

module.exports = {
  safeJsonParse,
  normalizeAnalysisResponse,
};
