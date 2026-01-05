'use strict';

/**
 * Centralized app configuration.
 * We keep all environment variable names here so it's easy to see what needs to be configured.
 */
require('dotenv').config();

const DEFAULT_PORT = 3001;
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';
const DEFAULT_MAX_UPLOAD_MB = 10;

// Gemini model default (configurable via env)
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

const PORT = Number(process.env.PORT || DEFAULT_PORT);

// Support comma-separated list of allowed origins for CORS
// Defaults to localhost:3000 and auto-detects preview domain if available
const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [
      DEFAULT_CORS_ORIGIN,
      // Backend preview domain (existing)
      'https://vscode-internal-36100-beta.beta01.cloud.kavia.ai:3000',
      // Frontend origin that must be allowed for CORS (requested)
      'https://vscode-internal-21009-beta.beta01.cloud.kavia.ai:3000',
    ];

// Legacy support for single CORS_ORIGIN (deprecated but still works)
const CORS_ORIGIN = process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN;

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || DEFAULT_MAX_UPLOAD_MB);

// Do NOT hardcode keys. This must come from the environment (.env in local dev).
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Gemini model name (kept configurable to allow quick roll-forward/roll-back)
const GEMINI_MODEL = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

// Temporary flag to enable permissive CORS for troubleshooting (unblocks preflight)
const CORS_ALLOW_ALL = process.env.CORS_ALLOW_ALL === 'true';

module.exports = {
  PORT,
  CORS_ORIGIN, // deprecated, kept for backwards compatibility
  CORS_ALLOWED_ORIGINS,
  MAX_UPLOAD_MB,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  CORS_ALLOW_ALL,
};
