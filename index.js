const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler'); // Destructuring works with the updated export
const { setupDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const psychicRoutes = require('./routes/psychics');
const reviewRoutes = require('./routes/reviews');
const bookingRoutes = require('./routes/bookings');
// Load environment variables
require('dotenv').config();
console.log("Stripe Secret Key:", process.env.STRIPE_SECRET_KEY);

const stripeRoutes = require('./routes/stripe');

const app = express();
const port = process.env.PORT || 3000;

// Initialize database
console.log("Initializing database...");
setupDatabase();

// Basic security middleware
console.log("Setting up basic security middleware...");
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:19006', 'http://localhost:8081', 'http://localhost:19000', 'exp://localhost:19000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// Error handling
console.log("Setting up error handler...");
console.log("errorHandler loaded:", errorHandler); // Debug log to verify
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});