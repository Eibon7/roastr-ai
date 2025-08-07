# Roastr.ai Authentication System

## Overview

This document describes the comprehensive multi-tenant authentication system implemented for Roastr.ai using Supabase.

## Features

✅ **Email/Password Authentication**
- User registration with email and password
- Secure login and logout
- JWT-based session management

✅ **Magic Link Authentication** 
- Passwordless login via email magic links
- Magic link registration for new users
- Automatic email delivery via Supabase

✅ **Password Recovery**
- Secure password reset via email
- Token-based password reset flow

✅ **Multi-Tenant Architecture**
- Row Level Security (RLS) for complete data isolation
- Automatic organization creation for new users
- User-specific integration management

✅ **Role-Based Access Control**
- Admin and regular user roles
- Protected endpoints for admin operations
- Fine-grained permissions

✅ **CLI Management Tools**
- Create, list, search, and delete users
- User statistics and health checks
- Manual user creation for admins

## API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/signup` | Register with email/password | No |
| POST | `/signup/magic-link` | Register with magic link | No |
| POST | `/login` | Login with email/password | No |
| POST | `/login/magic-link` | Login with magic link | No |
| POST | `/logout` | Logout current user | Yes |
| GET | `/me` | Get current user profile | Yes |
| PUT | `/profile` | Update user profile | Yes |
| POST | `/reset-password` | Request password reset | No |

### Admin Routes (`/api/auth/admin`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/users` | List all users | Admin |
| POST | `/admin/users` | Create user manually | Admin |
| DELETE | `/admin/users/:id` | Delete user | Admin |

### Integration Routes (`/api/integrations`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get user integrations | Yes |
| GET | `/platforms` | Get available platforms | Yes |
| POST | `/:platform` | Create/update integration | Yes |
| PUT | `/:platform` | Update integration | Yes |
| DELETE | `/:platform` | Delete integration | Yes |
| POST | `/:platform/enable` | Enable integration | Yes |
| POST | `/:platform/disable` | Disable integration | Yes |
| GET | `/metrics` | Get usage metrics | Yes |

## CLI Commands

```bash
# User management
npm run users:list              # List all users
npm run users:create            # Create new user
npm run users:delete            # Delete user
npm run users:search            # Search users
npm run users:stats             # Show user statistics
npm run users:health            # Health check

# Examples
npm run users:create -- --email user@example.com --name "John Doe" --plan pro
npm run users:list -- --limit 10 --json
npm run users:search -- --query "john"
npm run users:delete -- --user-id abc123 --confirm
```

## Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `email` (Unique, Required)
- `name` (Optional)
- `plan` (free, pro, creator_plus, custom)
- `is_admin` (Boolean)
- `created_at`, `updated_at`

### Organizations Table  
- `id` (UUID, Primary Key)
- `owner_id` (Foreign Key to users)
- `plan_id` (Matches user's plan)
- `monthly_responses_limit`
- `monthly_responses_used`

### Integration Configs Table
- `organization_id` (Foreign Key)
- `platform` (twitter, youtube, etc.)
- `enabled` (Boolean)
- `tone`, `humor_type`, `response_frequency`
- `trigger_words`, `shield_enabled`

## Row Level Security (RLS)

All tables implement RLS policies to ensure complete data isolation:

```sql
-- Users can only see their own data
CREATE POLICY user_isolation ON users FOR ALL USING (id = auth.uid());

-- Users can only access their organization's data
CREATE POLICY org_isolation ON organizations FOR ALL USING (
    owner_id = auth.uid() OR 
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);
```

## Plan Limits

| Plan | Monthly Responses | Integrations | Shield Mode |
|------|-------------------|--------------|-------------|
| Free | 100 | 2 | No |
| Pro | 1,000 | 5 | Yes |
| Creator Plus | 5,000 | Unlimited | Yes |
| Custom | Unlimited | Unlimited | Yes |

## Environment Variables

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# Optional Configuration
NODE_ENV=production
DEBUG=false
```

## Usage Examples

### Frontend Integration

```javascript
// Signup
const response = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword',
    name: 'John Doe'
  })
});

// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword'
  })
});

// Get user profile
const profileResponse = await fetch('/api/auth/me', {
  headers: { 
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### Magic Link Authentication

```javascript
// Send magic link
await fetch('/api/auth/login/magic-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// User clicks link in email and is automatically logged in
```

## Testing

The authentication system includes comprehensive tests:

- **Unit Tests**: Service layer functionality
- **Integration Tests**: End-to-end API workflows
- **Mock Database**: Isolated testing environment

```bash
npm test                        # Run all tests
npm run test:coverage           # Run with coverage
npm test -- authService.test.js # Run specific test
```

## Security Features

- **JWT Token Authentication**: Secure session management
- **Password Hashing**: Handled by Supabase Auth
- **Rate Limiting**: Built-in protection against abuse
- **CORS Protection**: Configurable cross-origin policies
- **Input Validation**: Request data sanitization
- **SQL Injection Prevention**: Parameterized queries
- **RLS Enforcement**: Database-level access control

## Monitoring and Logging

- User activities are logged for audit trails
- Authentication errors are tracked
- Usage metrics are collected per organization
- Health checks ensure system availability

## Next Steps

- [ ] OAuth integration (Google, GitHub, etc.)
- [ ] Two-factor authentication (2FA)
- [ ] Advanced user roles and permissions
- [ ] API rate limiting per plan
- [ ] Real-time user activity tracking