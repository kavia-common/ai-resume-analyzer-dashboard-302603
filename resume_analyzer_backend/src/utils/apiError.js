'use strict';

class ApiError extends Error {
  /**
   * Create a typed API error with HTTP status and optional details.
   * @param {number} statusCode
   * @param {string} message
   * @param {object=} details
   */
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

module.exports = { ApiError };
