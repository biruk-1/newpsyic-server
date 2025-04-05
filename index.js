require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const { setupDatabase } = require('./database');
const { initializeFirebase } = require('./services/notificationService');
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
console.log("Stripe Secret Key:", process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
console.log("Initializing database...");
setupDatabase();

// Initialize Firebase Admin SDK for notifications
console.log("Initializing Firebase Admin SDK...");
initializeFirebase();

// Initialize notification schedulers
console.log("Initializing notification schedulers...");
initializeSchedulers();

// Basic security middleware
console.log("Setting up basic security middleware...");
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting
console.log("Setting up rate limiting...");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes setup with debugging logs
console.log("Setting up routes...");

console.log("Setting up authRoutes...");
app.use('/api/auth', authRoutes);

console.log("Setting up psychicRoutes...");
app.use('/api/psychics', psychicRoutes);

console.log("Setting up reviewRoutes...");
app.use('/api/reviews', reviewRoutes);

console.log("Setting up bookingRoutes...");
app.use('/api/bookings', bookingRoutes);

console.log("Setting up stripeRoutes...");
app.use('/api/stripe', stripeRoutes);

console.log("Setting up twilioRoutes...");
app.use('/api/twilio', twilioRoutes);

console.log("Setting up notificationRoutes...");
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use(errorHandler);

app.get('/.well-known/apple-developer-merchantid-domain-association', (req, res) => {
  res.sendFile(path.join(__dirname, 'apple-developer-merchantid-domain-association'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
});