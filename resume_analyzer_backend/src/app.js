'use strict';

const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

const config = require('./config');
const { ApiError } = require('./utils/apiError');
const { requestLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Initialize express app
const app = express();

// Trust proxy (useful when deployed behind a reverse proxy)
app.set('trust proxy', true);

/**
 * CORS: Dynamic origin allow-list supporting multiple origins.
 *
 * Requirements:
 * - OPTIONS preflight for /analyze (and ALL routes) must return 204
 * - Include allowed methods: GET,POST,OPTIONS
 * - Include allowed headers: Content-Type
 * - Use dynamic allow-list from CORS_ALLOWED_ORIGINS
 *
 * NOTE: If an Origin is not allow-listed, preflight will be rejected (no CORS headers).
 *
 * IMPORTANT ORDERING:
 * - Register app.options('*', ...) BEFORE any other middleware/routes so preflight never falls through
 *   to other handlers (which can result in missing CORS headers).
 */
let corsHandler;

if (config.CORS_ALLOW_ALL) {
  // Temporary permissive mode: allow all origins, methods, and headers.
  corsHandler = cors({
    origin: true, // Reflects the request origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: true, // Allow us to manually send 204 response
  });
} else {
  corsHandler = cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) {
        return callback(null, true);
      }

      if (config.CORS_ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      // Return a 403 ApiError so the error handler sends JSON
      return callback(new ApiError(403, 'Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
    preflightContinue: true, // Allow us to manually send 204 response
    optionsSuccessStatus: 204,
  });
}

// DEBUG: Lightweight request logging for OPTIONS
// Logs method, path, and Origin to help diagnose CORS preflight issues.
const logCors = (req, res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[CORS-DEBUG] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'null'}`);
  next();
};

// Explicitly answer preflight with 204.
// Because preflightContinue is true, corsHandler sets headers and calls next().
// We then immediately send status 204 to terminate the request.
const handlePreflight = (req, res) => {
  res.sendStatus(204);
};

// Explicit handlers for critical endpoints
app.options('/analyze', logCors, corsHandler, handlePreflight);
app.options('/upload', logCors, corsHandler, handlePreflight);

// Catch-all for any other preflight requests
app.options('*', logCors, corsHandler, handlePreflight);

// Apply CORS to all other requests (GET, POST, etc.) BEFORE routes
app.use(corsHandler);

// DEBUG: Temporary diagnostics endpoint for CORS
// Returns detected Origin and active configuration.
app.get('/_debug/cors', (req, res) => {
  res.json({
    detectedOrigin: req.headers.origin || null,
    corsAllowAll: config.CORS_ALLOW_ALL,
    corsAllowedOrigins: config.CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    timestamp: new Date().toISOString(),
  });
});

// Basic request logging (method, URL, status, response time)
app.use(requestLogger);

/**
 * Swagger UI at /docs
 * We dynamically set the server URL based on the current request host/protocol.
 */
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host'); // may or may not include port
  let protocol = req.protocol; // http or https

  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');

  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
      (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${fullHost}`,
      },
    ],
  };

  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Parse JSON request body (limit prevents giant payloads)
app.use(express.json({ limit: '2mb' }));

// Mount routes
app.use('/', routes);

// Global error handler (must be after routes)
app.use(errorHandler);

module.exports = app;
