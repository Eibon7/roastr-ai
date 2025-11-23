# oauth-mock.test.js

**Path:** `tests/integration/oauth-mock.test.js`

## oauth-mock Tests

### OAuth Mock Integration Tests

#### Platform Support

Tests:

- ✓ should return all supported platforms
- ✓ should have correct platform configurations

#### Connection Status

Tests:

- ✓ should return empty connections initially
- ✓ should require authentication

#### OAuth Connect Flow

Tests:

- ✓ should initiate connection successfully
- ✓ should reject unsupported platform
- ✓ should require authentication for connect
- ✓ should sanitize platform parameter

#### OAuth Callback Flow

Tests:

- ✓ should handle successful callback
- ✓ should handle callback with error
- ✓ should reject callback without required parameters
- ✓ should reject callback with invalid state
- ✓ should reject expired state

#### Complete OAuth Flow

##### ${platform} OAuth flow

Tests:

- ✓ should complete full connect -> callback -> status cycle

#### Token Management

Tests:

- ✓ should refresh tokens successfully
- ✓ should disconnect successfully
- ✓ should handle refresh for non-existent connection
- ✓ should handle disconnect for non-existent connection

#### Mock Reset Functionality

Tests:

- ✓ should reset specific platform connection
- ✓ should reset all connections
- ✓ should only be available in mock mode

#### Error Handling & Edge Cases

Tests:

- ✓ should handle malformed state parameter
- ✓ should handle platform mismatch in state
- ✓ should handle already connected platform
- ✓ should validate platform parameter format

#### User Info Validation

Tests:

- ✓ should provide valid user info for all platforms
