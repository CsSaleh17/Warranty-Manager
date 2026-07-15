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
const verifyRequestOrigin = require('./middleware/verifyRequestOrigin');

const app = express();
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set before starting the server.');
}

app.use(helmet());
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json());
app.use(session({
  name: 'warranty.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));
app.use(verifyRequestOrigin);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/register', registrationRouter);
app.use('/api', authenticationRouter);
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoiceAnalysisRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/profile', profileRouter);

module.exports = app;
