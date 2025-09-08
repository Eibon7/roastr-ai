const { PLATFORM_LIMITS } = require('../../../src/config/constants');

describe('PLATFORM_LIMITS', () => {
  test('twitter maxLength is defined', () => {
    expect(PLATFORM_LIMITS.twitter).toHaveProperty('maxLength', 280);
  });
});
