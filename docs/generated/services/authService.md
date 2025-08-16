# authService.test.js

**Path:** `tests/unit/services/authService.test.js`

## auth Service Tests

### AuthService

#### signUp

Tests:
- ✓ should create a new user successfully
- ✓ should handle authentication errors
- ✓ should cleanup auth user if profile creation fails

#### signIn

Tests:
- ✓ should sign in user successfully
- ✓ should handle invalid credentials

#### listUsers

Tests:
- ✓ should list users successfully
- ✓ should handle database errors

#### createUserManually

Tests:
- ✓ should create user manually with provided password
- ✓ should create user manually with temporary password

#### deleteUser

Tests:
- ✓ should delete user successfully
- ✓ should handle auth deletion errors

