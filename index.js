// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const { setupDatabase } = require('./database');
const { initializeSchedulers } = require('./services/schedulerService');
const authRoutes = require('./routes/auth');
const psychicRoutes = require('./routes/psychics');
const reviewRoutes = require('./routes/reviews');
const bookingRoutes = require('./routes/bookings');
const stripeRoutes = require('./routes/stripe');
const twilioRoutes = require('./routes/twilio');
const notificationRoutes = require('./routes/notifications');

const path = require('path');
const fs = require('fs');

// Load environment variables
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
console.log("Initializing database...");
setupDatabase();

// Initialize notification schedulers
console.log("Initializing notification schedulers...");
initializeSchedulers();

// Check for APNs key file
const apnsKeyPath = path.join(__dirname, 'certs', 'AuthKey.p8');

if (!fs.existsSync(apnsKeyPath)) {
  console.warn('WARNING: APNs key file not found at', apnsKeyPath);
  console.warn('iOS push notifications will not work until the key file is added.');
  console.warn('To fix this:');
  console.warn('1. Download your APNs key (.p8 file) from Apple Developer Portal');
  console.warn('2. Create a "certs" directory in your server folder');
  console.warn('3. Place the .p8 file in the certs directory as "AuthKey.p8"');
  console.warn('4. Redeploy your application');
}

// Basic security middleware
app.use(helmet());
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes setup
app.use('/api/auth', authRoutes);
app.use('/api/psychics', psychicRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/twilio', twilioRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use(errorHandler);

// Apple Pay domain association file route
app.get('/.well-known/apple-developer-merchantid-domain-association', (req, res) => {
  res.sendFile(path.join(__dirname, 'apple-developer-merchantid-domain-association'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
});