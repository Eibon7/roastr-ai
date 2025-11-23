/**
 * Shared mock factory for roast validation tests
 * Issue #754 - CodeRabbit Review: Extract duplicated mock setup
 *
 * This factory creates consistent mock configurations used across
 * multiple roast validation test files to follow DRY principles.
 */

/**
 * Creates shared mock instance for StyleValidator
 * @returns {Object} Mock validator instance with common methods
 */
function createMockValidatorInstance() {
  return {
    validate: jest.fn(),
    validateTone: jest.fn(),
    validateComment: jest.fn(),
    getToneCategory: jest.fn(),
    getCharacterLimits: jest.fn().mockReturnValue({ twitter: 280, default: 2000 }),
    normalizePlatform: jest.fn((p) => p || 'twitter')
  };
}

/**
 * Creates mock configuration for validation constants
 * @returns {Object} Mock validation constants configuration
 */
function createValidationConstantsMock() {
  return {
    VALIDATION_CONSTANTS: {
      MAX_COMMENT_LENGTH: 2000,
      MIN_COMMENT_LENGTH: 1,
      VALID_LANGUAGES: ['es', 'en'],
      VALID_PLATFORMS: ['twitter', 'instagram', 'facebook'],
      VALID_STYLES: {
        es: ['flanders', 'balanceado', 'canalla'],
        en: ['light', 'balanced', 'savage']
      },
      MIN_INTENSITY: 1,
      MAX_INTENSITY: 5,
      DEFAULTS: {
        STYLE: 'balanceado'
      }
    },
    isValidStyle: jest.fn(() => true),
    isValidLanguage: jest.fn(() => true),
    isValidPlatform: jest.fn(() => true),
    normalizeLanguage: jest.fn((lang) => lang || 'es'),
    normalizeStyle: jest.fn((style) => style || 'balanceado'),
    normalizePlatform: jest.fn((platform) => platform || 'twitter'),
    getValidStylesForLanguage: jest.fn(() => ['flanders', 'balanceado', 'canalla'])
  };
}

/**
 * Creates mock configuration for logger
 * @returns {Object} Mock logger with standard methods
 */
function createLoggerMock() {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }))
    }
  };
}

/**
 * Creates mock authentication middleware
 * @returns {Function} Mock authenticate token function
 */
function createMockAuthenticateToken() {
  return jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', orgId: 'test-org-id' };
    next();
  });
}

/**
 * Creates mock rate limiter middleware
 * @returns {Function} Mock rate limit function
 */
function createMockRoastRateLimit() {
  return jest.fn((req, res, next) => next());
}

/**
 * Main factory function - creates all mocks needed for roast validation tests
 * @param {Object} overrides - Optional overrides for specific mocks
 * @returns {Object} Complete mock configuration
 */
function createRoastValidationMocks(overrides = {}) {
  const mockValidatorInstance = createMockValidatorInstance();
  const mockAuthenticateToken = createMockAuthenticateToken();
  const mockRoastRateLimit = createMockRoastRateLimit();

  return {
    mockValidatorInstance,
    mockAuthenticateToken,
    mockRoastRateLimit,
    validationConstantsMock: createValidationConstantsMock(),
    loggerMock: createLoggerMock(),

    // Export individual creators for flexibility
    createMockValidatorInstance,
    createValidationConstantsMock,
    createLoggerMock,
    createMockAuthenticateToken,
    createMockRoastRateLimit,

    // Allow overrides
    ...overrides
  };
}

module.exports = {
  createRoastValidationMocks,
  createMockValidatorInstance,
  createValidationConstantsMock,
  createLoggerMock,
  createMockAuthenticateToken,
  createMockRoastRateLimit
};
