# plan.test.js

**Path:** `tests/unit/routes/plan.test.js`

## plan Tests

### Plan Routes

#### GET /api/plan/available

Tests:
- ✓ should return all available plans

#### GET /api/plan/current

Tests:
- ✓ should require authentication
- ✓ should return free plan for new user

#### POST /api/plan/select

Tests:
- ✓ should require authentication
- ✓ should require valid plan
- ✓ should successfully select Creator+ plan
- ✓ should successfully select Pro plan

#### GET /api/plan/features

Tests:
- ✓ should return feature comparison

