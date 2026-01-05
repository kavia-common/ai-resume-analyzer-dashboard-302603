'use strict';

const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

const config = require('./config');
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
const corsHandler = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    if (config.CORS_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false,
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

// Explicitly answer preflight for every route FIRST (prevents fallthrough/missing headers).
app.options('*', corsHandler);

// Apply CORS BEFORE routes so it can handle preflight properly.
app.use(corsHandler);

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
