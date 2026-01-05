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

// ----------------------------------------------------------------------
// CORS CONFIGURATION
// ----------------------------------------------------------------------

// DEBUG: Lightweight request logging for OPTIONS to help diagnose preflight issues
const logCors = (req, res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[CORS-DEBUG] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'null'}`);
  next();
};

// Permissive CORS options as requested to unblock the frontend
const corsOptions = {
  origin: true, // Reflects the request origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

// 1. Apply CORS middleware globally BEFORE any routes
// This ensures headers are set on all responses if possible
app.use(cors(corsOptions));

// 2. Explicit OPTIONS handlers for critical endpoints
// These ensure that even if the global middleware somehow misses, we specifically handle these.
// We manually set headers here to be absolutely sure, as requested.
const manualCorsHeaders = (req, res) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.status(204).end();
};

app.options('/analyze', logCors, manualCorsHeaders);
app.options('/upload', logCors, manualCorsHeaders);

// 3. Global catch-all for OPTIONS to ensure no 404s on preflight
app.options('*', logCors, cors(corsOptions));

// ----------------------------------------------------------------------
// DIAGNOSTICS
// ----------------------------------------------------------------------

// Explicit GET '/_debug/cors' route
// Returns JSON with debugging info and sets Access-Control-Allow-Origin
app.get('/_debug/cors', (req, res) => {
  const origin = req.headers.origin || '*';
  // Ensure this specific route always works for CORS
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  res.json({
    message: 'CORS Diagnostics',
    corsMode: 'Permissive (Reflect Origin)',
    receivedOriginHeader: req.headers.origin || null,
    allowedOrigins: config.CORS_ALLOWED_ORIGINS, // Showing what's in config even if we are currently permissive
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------
// APP MIDDLEWARE & ROUTES
// ----------------------------------------------------------------------

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
