# style-profile.test.js

**Path:** `tests/unit/routes/style-profile.test.js`

## style-profile Tests

### Style Profile Routes

#### GET /api/style-profile/status

Tests:
- ✓ should require authentication
- ✓ should return no access for free user
- ✓ should return access for Creator+ user

#### GET /api/style-profile

Tests:
- ✓ should require authentication
- ✓ should deny access to free users
- ✓ should return no profile for Creator+ user without generated profile

#### POST /api/style-profile/generate

Tests:
- ✓ should require authentication
- ✓ should deny access to free users
- ✓ should require platforms parameter
- ✓ should require valid platforms array
- ✓ should successfully generate style profile
- ✓ should generate multiple language profiles

#### GET /api/style-profile (with generated profile)

Tests:
- ✓ should return generated profile data

#### GET /api/style-profile/preview/:lang

Tests:
- ✓ should require authentication
- ✓ should deny access to free users
- ✓ should return 404 for non-existent profile
- ✓ should return language profile preview

#### GET /api/style-profile/stats

Tests:
- ✓ should require authentication
- ✓ should deny access to free users
- ✓ should return profile statistics

#### DELETE /api/style-profile

Tests:
- ✓ should require authentication
- ✓ should deny access to free users
- ✓ should successfully delete existing profile
- ✓ should return 404 when deleting non-existent profile

#### Feature flag integration

Tests:
- ✓ should respect ENABLE_STYLE_PROFILE flag when disabled

#### Error handling and edge cases

Tests:
- ✓ should handle insufficient content for generation
- ✓ should handle generation with minimal content

