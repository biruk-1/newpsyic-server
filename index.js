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

// Load environment variables
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
console.log("Initializing database...");
setupDatabase();

// Initialize notification schedulers
console.log("Initializing notification schedulers...");
initializeSchedulers();

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