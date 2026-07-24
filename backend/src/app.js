const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const registrationRouter = require('./routes/registration');
const authenticationRouter = require('./routes/authentication');
const productsRouter = require('./routes/products');
const invoiceAnalysisRouter = require('./routes/invoiceAnalysis');
const dashboardRouter = require('./routes/dashboard');
const profileRouter = require('./routes/profile');
const passwordResetRouter = require('./routes/passwordReset');
const { createVerifyRequestOrigin } = require('./middleware/verifyRequestOrigin');
const { getAllowedOrigins } = require('./config/origins');
const database = require('./config/database');
const MysqlSessionStore = require('./services/mysqlSessionStore');
const { loadEnvironment } = require('./config/environment');
const fs = require('fs');
const path = require('path');

function createApp(config = loadEnvironment(), dependencies = {}) {
const app = express();
const appDatabase = dependencies.database || database;
const isProduction = config.isProduction;
app.disable('x-powered-by');
if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);
app.use(helmet({
  strictTransportSecurity: isProduction ? undefined : false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'none'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  permissionsPolicy: false,
}));
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});
const allowedOrigins = config.allowedOrigins || getAllowedOrigins();
app.use(cors({ origin(origin, callback) { callback(null, !origin || allowedOrigins.has(origin)); }, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
if (config.enforceHttps) app.use((req, res, next) => (req.path === '/api/health' && config.trustProxy !== false) || req.secure ? next() : res.status(426).json({ error: 'HTTPS is required.' }));
app.use(express.json({ limit: config.jsonBodyLimit }));
app.use(session({
  name: 'warranty.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: isProduction ? new MysqlSessionStore(appDatabase) : undefined,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));
app.use(createVerifyRequestOrigin(allowedOrigins));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.get('/api/ready', async (req, res) => {
  try {
    await appDatabase.execute('SELECT 1');
    fs.mkdirSync(config.uploadDirectory, { recursive: true });
    fs.accessSync(config.uploadDirectory, fs.constants.R_OK | fs.constants.W_OK);
    return res.status(200).json({ status: 'ready' });
  } catch {
    return res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/register', registrationRouter);
app.use('/api', authenticationRouter);
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoiceAnalysisRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/profile', profileRouter);
app.use('/api', passwordResetRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

if (isProduction) {
  const assetDirectory = path.join(config.frontendBuildDirectory, 'assets');
  app.use('/assets', express.static(assetDirectory, { fallthrough: false, immutable: true, maxAge: '1y', index: false }));
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
    if (path.extname(req.path) || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(path.join(config.frontendBuildDirectory, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'Resource not found.' }));

app.use((error, req, res, next) => {
  if (error?.status === 404) return res.status(404).json({ error: 'Resource not found.' });
  if (error instanceof SyntaxError && error.status === 400 && Object.prototype.hasOwnProperty.call(error, 'body')) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Unable to process the request.' });
});
return app;
}

const app = createApp();
module.exports = app;
module.exports.createApp = createApp;
