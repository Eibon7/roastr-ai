# authWorkflow.test.js

**Path:** `tests/integration/authWorkflow.test.js`

## auth Workflow Tests

### Authentication Workflow Integration Tests

#### User Registration and Login Flow

Tests:
- ✓ should complete full user signup and login workflow
- ✓ should handle duplicate email registration
- ✓ should handle invalid credentials

#### Integration Management Flow

Tests:
- ✓ should manage user integrations
- ✓ should enforce free plan limits

#### Authentication Middleware

Tests:
- ✓ should protect authenticated endpoints
- ✓ should reject invalid tokens

#### Password Reset Flow

Tests:
- ✓ should handle password reset request
- ✓ should handle magic link requests

