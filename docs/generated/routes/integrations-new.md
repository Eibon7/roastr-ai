# integrations-new.test.js

**Path:** `tests/unit/routes/integrations-new.test.js`

## integrations-new Tests

### New Integration Routes

#### GET /api/integrations/platforms

Tests:

- ✓ should return all supported platforms

#### GET /api/integrations/status

Tests:

- ✓ should require authentication
- ✓ should return empty status for new user

#### POST /api/integrations/connect

Tests:

- ✓ should require authentication
- ✓ should require platform parameter
- ✓ should reject unsupported platform
- ✓ should successfully connect to Twitter
- ✓ should successfully connect to multiple platforms

#### POST /api/integrations/import

Tests:

- ✓ should require authentication
- ✓ should require platform parameter
- ✓ should require platform to be connected first
- ✓ should successfully start import from connected platform
- ✓ should respect maximum import limit

#### GET /api/integrations/import/status/:platform

Tests:

- ✓ should require authentication
- ✓ should reject unsupported platform
- ✓ should return import status for connected platform

#### POST /api/integrations/disconnect

Tests:

- ✓ should require authentication
- ✓ should require platform parameter
- ✓ should fail for not connected platform
- ✓ should successfully disconnect from platform

#### Integration flow testing

Tests:

- ✓ should handle complete connect-import-disconnect flow
