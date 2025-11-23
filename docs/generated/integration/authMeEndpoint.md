# authMeEndpoint.test.js

**Path:** `tests/integration/authMeEndpoint.test.js`

## auth Me Endpoint Tests

### /api/auth/me Endpoint Integration Tests

#### GET /api/auth/me

Tests:

- ✓ should return user profile with valid token
- ✓ should return 401 without token
- ✓ should return 401 with invalid token
- ✓ should return 401 with malformed Authorization header
- ✓ should include all required user fields
- ✓ should include organization and integration data
