'use strict';

/**
 * Centralized app configuration.
 * We keep all environment variable names here so it's easy to see what needs to be configured.
 */
require('dotenv').config();

const DEFAULT_PORT = 3001;
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';
const DEFAULT_MAX_UPLOAD_MB = 10;

const PORT = Number(process.env.PORT || DEFAULT_PORT);
const CORS_ORIGIN = process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || DEFAULT_MAX_UPLOAD_MB);

// Do NOT hardcode keys. This must come from the environment (.env in local dev).
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

module.exports = {
  PORT,
  CORS_ORIGIN,
  MAX_UPLOAD_MB,
  GEMINI_API_KEY,
};
