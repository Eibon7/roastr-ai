# GitHub Secrets Documentation

This document outlines all the secrets that need to be configured in the GitHub repository settings for the CI/CD workflows to function properly.

## Required Secrets

### 🔐 Core GitHub Integration
- **`CLAUDE_CODE_OAUTH_TOKEN`**: OAuth token for Claude Code integration
- **`APP_ID`**: GitHub App ID for custom app integration
- **`APP_PRIVATE_KEY`**: Private key for GitHub App authentication
- **`ANTHROPIC_API_KEY`**: API key for Anthropic Claude services

### 💳 Stripe Integration (Development & Production)

#### Test Environment
- **`STRIPE_TEST_SECRET_KEY`**: Stripe test secret key (starts with `sk_test_`)
  - Used in: `stripe-validation.yml` for test environment validation
  - Required for: Price validation, webhook testing, billing tests

#### Production Environment  
- **`STRIPE_LIVE_SECRET_KEY`**: Stripe live secret key (starts with `sk_live_`)
  - Used in: `stripe-validation.yml` for production environment validation
  - Required for: Production price validation, live billing operations
  - **⚠️ CRITICAL**: Only configure if production billing is active

### 🧪 Integration Testing (Optional)

#### Staging Backend Testing
- **`STAGING_API_BASE_URL`**: Base URL for staging API
  - Example: `https://api-staging.roastr.ai`
- **`STAGING_SUPABASE_URL`**: Staging Supabase project URL
- **`STAGING_SUPABASE_ANON_KEY`**: Staging Supabase anonymous key
- **`STAGING_SUPABASE_SERVICE_ROLE_KEY`**: Staging Supabase service role key
- **`STAGING_TEST_USER_EMAIL`**: Test user email for staging integration tests
- **`STAGING_TEST_USER_PASSWORD`**: Test user password for staging integration tests

## Security Considerations

### 🛡️ Secret Management Best Practices

1. **Environment Separation**: 
   - Use different secrets for test/staging/production environments
   - Never use production secrets in CI/CD workflows for non-production branches

2. **Key Rotation**:
   - Rotate API keys regularly (quarterly recommended)
   - Update secrets in GitHub immediately after rotation

3. **Access Control**:
   - Limit repository access to essential team members only
   - Use environment protection rules for production deployments

4. **Monitoring**:
   - Monitor secret usage through GitHub Actions logs
   - Set up alerts for failed authentication attempts

### 🚨 Critical Security Issues Found

During the security audit, we identified several security findings:

#### 1. Mock Values in CI/CD Workflows (SAFE)
In `.github/workflows/ci.yml`:
```yaml
STRIPE_SECRET_KEY: "sk_test_mock123456789"
STRIPE_WEBHOOK_SECRET: "whsec_mock123456789" 
PERSPECTIVE_API_KEY: "mock-perspective-key-AIzaSy123456789"
YOUTUBE_API_KEY: "AIzaSyMockYouTubeKey123456789"
INSTAGRAM_ACCESS_TOKEN: "IGQVJYMockInstagramToken123456789"
FACEBOOK_ACCESS_TOKEN: "EAAMockFacebookToken123456789"
```
**Status**: ✅ **VERIFIED SAFE** - These are clearly labeled mock values for testing purposes.

#### 2. Real Credentials in Local Environment File (CRITICAL)
**Location**: `roastr-bot/.env` (local file, not tracked by git)

**Found**: 
- Real OpenAI API key (sk-proj-...)
- Real Twitter API credentials (Bearer token, App keys, Access tokens)
- Custom API key

**Status**: 🔴 **CRITICAL BUT CONTAINED** 
- File is NOT tracked by git (not in remote repository)
- Updated .gitignore to explicitly exclude roastr-bot/.env files
- Created roastr-bot/.env.example as template

**Immediate Actions Required**:
1. ⚠️ **Rotate the exposed OpenAI API key immediately**
2. ⚠️ **Rotate Twitter API credentials if bot was used in production** 
3. ✅ Update roastr-bot/.env with new credentials locally
4. ✅ Never commit the real .env file (now protected by .gitignore)

## How to Configure Secrets

### Via GitHub Web Interface:
1. Go to `Settings` > `Secrets and variables` > `Actions`
2. Click `New repository secret`
3. Enter the secret name exactly as listed above
4. Paste the secret value
5. Click `Add secret`

### Via GitHub CLI:
```bash
# Set a secret using GitHub CLI
gh secret set SECRET_NAME --body "secret_value"

# Example for Stripe test key
gh secret set STRIPE_TEST_SECRET_KEY --body "sk_test_your_actual_key_here"
```

## Validation Status

| Secret | Required For | Status | Notes |
|--------|-------------|---------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude integration | ✅ Required | Always needed |
| `STRIPE_TEST_SECRET_KEY` | Development billing | ⚠️ Optional | Gracefully degrades if missing |
| `STRIPE_LIVE_SECRET_KEY` | Production billing | 🔴 Production Only | Only set when going live |
| `STAGING_*` secrets | Integration tests | ⚠️ Optional | Falls back to fixtures |

## Troubleshooting

### Missing Secrets
Workflows are designed to gracefully handle missing secrets:
- Stripe validation skips if keys are missing
- Integration tests fall back to fixtures
- Clear warnings are displayed in workflow logs

### Invalid Secrets
If secrets are invalid:
1. Check the secret format matches the expected pattern
2. Verify the key is active in the respective service
3. Confirm the key has the necessary permissions

### Secret Not Found Errors
1. Verify the secret name matches exactly (case-sensitive)
2. Ensure the secret is set at the repository level, not organization level
3. Check branch protection rules aren't blocking secret access

---

**Last Updated**: 2025-09-25  
**Next Review**: 2025-12-25