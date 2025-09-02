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
    // Get only first error for each field and strip sensitive data
    const safeErrors = errors.array({ onlyFirstError: true }).map(error => ({
      param: error.param || error.path,
      msg: error.msg
      // Explicitly exclude: value, nestedErrors, location, etc.
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: safeErrors
    });
  }

  next();
};

module.exports = {
  validateRequest
};
