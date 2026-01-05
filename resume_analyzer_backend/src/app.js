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

// Basic request logging (method, URL, status, response time)
app.use(requestLogger);

// CORS: Dynamic origin allow-list supporting multiple origins
// If the requesting origin matches the allow-list, we return it in Access-Control-Allow-Origin
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if the origin is in the allow-list
    if (config.CORS_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Reject origins not in the allow-list
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  // Ensure preflight requests are handled correctly
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

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
