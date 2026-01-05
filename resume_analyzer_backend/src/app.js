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
// 1) CORS SETUP & CONFIGURATION
// ----------------------------------------------------------------------

const allowAll = config.CORS_ALLOW_ALL;
const allowedOrigins = config.CORS_ALLOWED_ORIGINS;

const corsOptions = {
  origin: allowAll
    ? true
    : function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  optionsSuccessStatus: 204,
};

// ----------------------------------------------------------------------
// 3) ULTRA-TOP-LEVEL HANDLERS (BEFORE everything else)
// ----------------------------------------------------------------------

// Health check
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Diagnostics endpoint
app.get('/_debug/cors', (req, res) => {
  const origin = req.headers.origin || null;
  const allowAllEnv = !!process.env.CORS_ALLOW_ALL && process.env.CORS_ALLOW_ALL.toString().toLowerCase() === 'true';
  const allowList = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return res.status(200).json({
    detectedOrigin: origin,
    allowAll: allowAllEnv,
    allowList
  });
});

// Manual OPTIONS handlers to ensure preflight succeeds
app.options('/analyze', (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
  return res.sendStatus(204);
});

app.options('/upload', (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
  return res.sendStatus(204);
});

app.options('*', (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
  return res.sendStatus(204);
});

// ----------------------------------------------------------------------
// 4) GLOBAL MIDDLEWARE
// ----------------------------------------------------------------------

// Apply cors middleware globally AFTER the explicit top-level handlers but BEFORE routes
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// ----------------------------------------------------------------------
// 5) APP MIDDLEWARE & ROUTES
// ----------------------------------------------------------------------

// Basic request logging
app.use(requestLogger);

// Swagger UI at /docs
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

// Mount routes
app.use('/', routes);

// Global error handler (must be after routes)
app.use(errorHandler);

module.exports = app;
