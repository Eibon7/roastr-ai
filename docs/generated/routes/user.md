# user.test.js

**Path:** `tests/unit/routes/user.test.js`

## user Tests

### User Routes Tests

#### GET /api/user/integrations

Tests:

- ✓ should return user integrations successfully
- ✓ should return error if user organization not found

#### POST /api/user/integrations/connect

Tests:

- ✓ should connect new platform successfully
- ✓ should update existing platform successfully
- ✓ should return error for invalid platform
- ✓ should return error for missing platform

#### POST /api/user/integrations/disconnect

Tests:

- ✓ should disconnect platform successfully
- ✓ should return error if integration not found
- ✓ should return error for missing platform

#### POST /api/user/preferences

Tests:

- ✓ should save user preferences successfully
- ✓ should return error for invalid humor tone
- ✓ should return error for invalid humor style
- ✓ should return error for invalid platforms
- ✓ should handle empty preferences with defaults

#### GET /api/user/profile

Tests:

- ✓ should return user profile successfully
- ✓ should return error if user not found

#### Authentication Middleware Integration

Tests:

- ✓ should require authentication for all user routes

#### Error Handling

Tests:

- ✓ should handle database errors gracefully
- ✓ should handle unexpected errors in preferences endpoint
