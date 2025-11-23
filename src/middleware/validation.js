/**
 * Validation Middleware
 * Handles request validation using express-validator
 */

const { validationResult } = require('express-validator');

/**
 * Middleware to validate request and return errors if validation fails
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }

  next();
};

module.exports = {
  validateRequest
};
