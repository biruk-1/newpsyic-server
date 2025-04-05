const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Log the full error stack
  logger.error('Error details:', {
    message: err.message,
    stack: err.stack,
    type: err.type,
    code: err.code
  });

  if (err.type === 'validation') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors
    });
  }

  if (err.type === 'auth') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: err.message
    });
  }

  // In development, send more detailed error information
  if (process.env.NODE_ENV !== 'production') {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
      stack: err.stack,
      type: err.type,
      code: err.code
    });
  }

  // In production, send a generic error message
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.'
  });
}

module.exports = { errorHandler };