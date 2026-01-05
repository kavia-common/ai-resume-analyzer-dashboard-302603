'use strict';

const { ApiError } = require('../utils/apiError');

/**
 * Express error handler that always returns strict JSON errors:
 * { status: 'error', message: string, details?: object }
 */
function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars
  const isApiError = err instanceof ApiError;

  const statusCode = isApiError ? err.statusCode : 500;
  const message = isApiError ? err.message : 'Internal Server Error';

  // Avoid leaking stack traces to clients. We keep it logged server-side.
  // eslint-disable-next-line no-console
  console.error('Error:', err);

  const payload = {
    status: 'error',
    message,
  };

  if (isApiError && err.details) {
    payload.details = err.details;
  }

  return res.status(statusCode).json(payload);
}

module.exports = { errorHandler };
