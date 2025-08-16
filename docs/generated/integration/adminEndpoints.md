# adminEndpoints.test.js

**Path:** `tests/integration/adminEndpoints.test.js`

## admin Endpoints Tests

### Admin Endpoints Integration Tests

#### GET /api/auth/admin/users

Tests:
- ✓ should return users list for admin
- ✓ should deny access to regular users
- ✓ should require authentication

#### POST /api/auth/admin/users/update-plan

Tests:
- ✓ should update user plan for admin
- ✓ should validate plan value
- ✓ should require both userId and newPlan
- ✓ should deny access to regular users

#### POST /api/auth/admin/users/reset-password

Tests:
- ✓ should send password reset email for admin
- ✓ should require userId
- ✓ should deny access to regular users

