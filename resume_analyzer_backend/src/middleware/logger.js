'use strict';

const morgan = require('morgan');

/**
 * Request logger middleware.
 * In production you can change the format or pipe logs to a file.
 */
const requestLogger = morgan(':method :url :status :res[content-length] - :response-time ms');

module.exports = { requestLogger };
