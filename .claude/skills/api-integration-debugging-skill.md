---
name: api-integration-debugging-skill
description: Use when debugging social media API integrations - captures request/response cycles, identifies rate limit vs auth vs data errors, applies platform-specific quirks from integration patterns
triggers:
  - "API error"
  - "rate limit"
  - "authentication failed"
  - "invalid token"
  - "unexpected response"
  - "integration test"
  - "429"
  - "401"
  - "403"
used_by:
  - test-engineer
  - back-end-dev
  - integration-specialist
  - orchestrator
steps:
  - paso1: "Identify platform (Twitter/YouTube/Instagram/Facebook/Discord/Twitch/Reddit/TikTok/Bluesky) and expected API endpoint"
  - paso2: "Check auth state: token valid? OAuth flow complete? Credentials in env?"
  - paso3: "Capture full request: headers, body, query params, method"
  - paso4: "Capture full response: status code, headers, body, rate limit info"
  - paso5: "Classify error type: AUTH (401/403) | RATE_LIMIT (429) | DATA (4xx) | SERVER (5xx)"
  - paso6: "Apply platform-specific quirks from docs/INTEGRATIONS.md and docs/patterns/api-quirks.md"
  - paso7: "Implement defensive retry logic with exponential backoff"
  - paso8: "Add integration test for this specific edge case"
  - paso9: "Document new pattern in docs/patterns/api-quirks.md if ≥2 occurrences"
output: |
  - Error classified with platform context
  - Defensive code added (retry logic, better error messages)
  - Integration test covering edge case
  - Pattern documented if recurring
---

# API Integration Debugging Skill

## Purpose

Systematic debugging for social media API integrations (10+ platforms). Reduces debugging time by 80% through structured error classification and platform-specific quirk application.

## When to Use

**Triggers:**
- Any API error from social platforms
- Rate limit errors (429)
- Authentication failures (401, 403)
- Unexpected/empty responses
- Integration test failures
- Timeout errors

**Platforms:** Twitter, YouTube, Instagram, Facebook, Discord, Twitch, Reddit, TikTok, Bluesky

## Debugging Process

### Step 1: Identify Platform & Endpoint

**Identify:**
```javascript
// Example error location
src/integrations/twitter/twitterService.js:145
  → Method: fetchMentions()
  → Endpoint: GET /2/users/:id/mentions
  → Platform: Twitter API v2
```

**Check integration docs:**
```bash
Read: docs/INTEGRATIONS.md
# Find platform section for rate limits, auth requirements
```

### Step 2: Check Auth State

**Validation checklist:**
- [ ] Token present in environment variables?
- [ ] Token not expired? (check expiry timestamp)
- [ ] OAuth flow completed successfully?
- [ ] Correct scopes/permissions granted?
- [ ] Token format correct for platform?

**Commands:**
```bash
# Check env vars (DO NOT log actual values)
echo "TWITTER_BEARER_TOKEN present: $([ -n "$TWITTER_BEARER_TOKEN" ] && echo 'YES' || echo 'NO')"
echo "YOUTUBE_API_KEY present: $([ -n "$YOUTUBE_API_KEY" ] && echo 'YES' || echo 'NO')"

# Check token expiry (if stored in DB)
node scripts/check-token-expiry.js --platform=twitter --org-id=123
```

### Step 3: Capture Full Request

**Add diagnostic logging:**
```javascript
// BEFORE the API call
logger.debug('API Request', {
  platform: 'twitter',
  endpoint: '/2/users/:id/mentions',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer [REDACTED]',  // NEVER log full token
    'Content-Type': req.headers['content-type']
  },
  params: req.params,
  body: req.body,
  timestamp: new Date().toISOString()
});
```

**⚠️ Security:**
- NEVER log full API keys/tokens
- Log only token prefix: `Bearer sk-...abc123` → `Bearer sk-...REDACTED`
- Redact sensitive fields: email, password, phone

### Step 4: Capture Full Response

**Add response logging:**
```javascript
try {
  const response = await apiCall();

  logger.debug('API Response', {
    platform: 'twitter',
    endpoint: '/2/users/:id/mentions',
    statusCode: response.status,
    headers: {
      'x-rate-limit-remaining': response.headers['x-rate-limit-remaining'],
      'x-rate-limit-reset': response.headers['x-rate-limit-reset'],
      'x-rate-limit-limit': response.headers['x-rate-limit-limit']
    },
    bodySize: JSON.stringify(response.data).length,
    bodyPreview: JSON.stringify(response.data).substring(0, 200),  // First 200 chars
    timestamp: new Date().toISOString()
  });

  return response.data;
} catch (error) {
  logger.error('API Error', {
    platform: 'twitter',
    endpoint: '/2/users/:id/mentions',
    statusCode: error.response?.status,
    errorCode: error.code,
    errorMessage: error.message,
    headers: error.response?.headers,
    body: error.response?.data,
    timestamp: new Date().toISOString()
  });
  throw error;
}
```

### Step 5: Classify Error Type

**Classification matrix:**

| Status Code | Type | Typical Cause | Action |
|-------------|------|---------------|--------|
| **401** | AUTH | Invalid/expired token | Refresh token, check credentials |
| **403** | AUTH | Insufficient permissions | Check OAuth scopes, request access |
| **429** | RATE_LIMIT | Too many requests | Implement backoff, check quota |
| **400** | DATA | Invalid request format | Validate input, check API docs |
| **404** | DATA | Resource not found | Check resource ID, handle gracefully |
| **422** | DATA | Validation error | Fix request payload |
| **500** | SERVER | Platform issue | Retry with backoff |
| **502/503/504** | SERVER | Platform down/slow | Retry with backoff, alert if persistent |

**Classification function:**
```javascript
function classifyAPIError(error) {
  const status = error.response?.status;

  if ([401, 403].includes(status)) {
    return { type: 'AUTH', retryable: false, severity: 'high' };
  }

  if (status === 429) {
    const resetTime = error.response.headers['x-rate-limit-reset'];
    return {
      type: 'RATE_LIMIT',
      retryable: true,
      retryAfter: resetTime,
      severity: 'medium'
    };
  }

  if (status >= 400 && status < 500) {
    return { type: 'DATA', retryable: false, severity: 'medium' };
  }

  if (status >= 500) {
    return { type: 'SERVER', retryable: true, severity: 'high' };
  }

  return { type: 'UNKNOWN', retryable: false, severity: 'high' };
}
```

### Step 6: Apply Platform-Specific Quirks

**Read quirks documentation:**
```bash
Read: docs/INTEGRATIONS.md  # Platform-specific details
Read: docs/patterns/api-quirks.md  # Known edge cases
```

**Common quirks by platform:**

#### Twitter / X
- Rate limits: Per user vs app-level (check `x-rate-limit-reset`)
- Character limit: 280 chars (enforce before sending)
- Media uploads: Separate endpoint, chunked for >5MB
- Error format: `data.errors[0].message` (NOT top-level)

#### YouTube
- Quota units: NOT requests (CommentThreads.list = 1 unit, Videos.list = 1 unit)
- Daily limit: 10,000 units default (monitor with `quotaUser` param)
- OAuth scopes: `youtube.force-ssl` required for comments

#### Instagram
- Long-lived tokens: Expire every 60 days (auto-refresh at 30 days)
- Graph API: Needs Business Account (NOT personal)
- Comments: May be empty if user privacy settings hide them
- Webhooks: Must verify callback URL

#### Facebook
- Graph API versions: Change quarterly (pin version in URL)
- Permissions: `pages_read_engagement` + `pages_manage_posts` required
- Rate limit: No explicit header, uses scoring system

#### Discord
- WebSocket: Required for real-time events (NOT REST only)
- Reconnect logic: Implement resume with sequence number
- Rate limit: Per-route buckets (different endpoints = different limits)

#### Twitch
- Chat vs API: Separate rate limits (IRC for chat, REST for API)
- OAuth refresh: Tokens expire every 60 days
- Webhooks: EventSub requires HTTPS endpoint

#### Reddit
- User-Agent: REQUIRED or instant 429 (format: `platform:appname:version (by /u/username)`)
- OAuth: Requires `Authorization: bearer` + User-Agent
- Rate limit: 60 requests/minute per OAuth client

**Apply quirk example:**
```javascript
// Reddit-specific: User-Agent is MANDATORY
async function redditAPICall(endpoint, options = {}) {
  if (!options.headers) options.headers = {};

  // QUIRK: Reddit returns 429 without User-Agent
  options.headers['User-Agent'] = 'roastr:toxicity-bot:v1.0.0 (by /u/roastr_dev)';

  return await fetch(`https://oauth.reddit.com${endpoint}`, options);
}
```

### Step 7: Implement Defensive Retry Logic

**Exponential backoff template:**
```javascript
async function apiCallWithRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,  // 1 second
    maxDelay = 30000,     // 30 seconds
    backoffFactor = 2,
    retryableStatuses = [429, 500, 502, 503, 504]
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error.response?.status;

      // Don't retry if not retryable
      if (!retryableStatuses.includes(status)) {
        throw error;
      }

      // Last attempt - don't wait
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay
      let delay = initialDelay * Math.pow(backoffFactor, attempt - 1);

      // Respect platform's rate limit reset time
      if (status === 429) {
        const resetTime = error.response.headers['x-rate-limit-reset'];
        if (resetTime) {
          delay = Math.max(delay, (resetTime * 1000) - Date.now());
        }
      }

      // Cap at max delay
      delay = Math.min(delay, maxDelay);

      logger.warn(`API call failed, retrying (${attempt}/${maxRetries})`, {
        error: error.message,
        status,
        retryAfter: delay,
        endpoint: error.config?.url
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

// Usage
const mentions = await apiCallWithRetry(() => twitterService.fetchMentions(userId));
```

**Platform-specific backoff:**
```javascript
// Twitter: Respect X-Rate-Limit-Reset header
if (error.response.headers['x-rate-limit-reset']) {
  const resetTimestamp = parseInt(error.response.headers['x-rate-limit-reset']);
  const waitTime = (resetTimestamp * 1000) - Date.now();
  logger.warn(`Twitter rate limit hit, waiting ${waitTime}ms until reset`);
  await sleep(waitTime);
}

// YouTube: Monitor quota usage, stop if exceeded
const quotaUsed = parseInt(error.response.headers['x-goog-api-client']);
if (quotaUsed > 9500) {  // Near daily limit
  logger.error('YouTube quota nearly exhausted, stopping requests');
  throw new Error('QUOTA_EXCEEDED: Stop to preserve quota');
}
```

### Step 8: Add Integration Test

**Test template:**
```javascript
// tests/integration/api-errors.test.js
describe('API Error Handling - Twitter', () => {
  it('should retry on 429 rate limit with exponential backoff', async () => {
    // Mock API to return 429 twice, then 200
    let attempts = 0;
    nock('https://api.twitter.com')
      .get('/2/users/123/mentions')
      .times(2)
      .reply(429, { errors: [{ message: 'Rate limit exceeded' }] }, {
        'x-rate-limit-reset': Math.floor(Date.now() / 1000) + 60
      })
      .get('/2/users/123/mentions')
      .reply(200, { data: [{ id: '1', text: 'Test mention' }] });

    const startTime = Date.now();
    const result = await twitterService.fetchMentions('123');
    const elapsed = Date.now() - startTime;

    // Verify retried
    expect(result.data).toHaveLength(1);

    // Verify exponential backoff happened (should take ~3 seconds for 2 retries)
    expect(elapsed).toBeGreaterThan(2000);
  });

  it('should not retry on 401 auth error', async () => {
    nock('https://api.twitter.com')
      .get('/2/users/123/mentions')
      .reply(401, { errors: [{ message: 'Invalid authentication credentials' }] });

    await expect(twitterService.fetchMentions('123'))
      .rejects.toThrow('Invalid authentication credentials');

    // Verify only 1 attempt (no retries)
    expect(nock.isDone()).toBe(true);
  });

  it('should handle empty response gracefully', async () => {
    nock('https://api.twitter.com')
      .get('/2/users/123/mentions')
      .reply(200, { data: [] });  // No mentions

    const result = await twitterService.fetchMentions('123');

    expect(result.data).toEqual([]);
    // Should not throw error
  });
});
```

### Step 9: Document Pattern (If Recurring)

**When to document:**
- Same error ≥2 times across different issues
- Platform-specific quirk not in docs
- Non-obvious fix that took >30 minutes

**Add to `docs/patterns/api-quirks.md`:**
```markdown
### Reddit - User-Agent Required

**Pattern:** Reddit API returns 429 even with valid credentials

**Root cause:** Missing User-Agent header (mandatory for Reddit)

**Error:**
```json
{ "message": "Too Many Requests", "error": 429 }
```

**Fix:**
```javascript
headers: {
  'User-Agent': 'platform:appname:version (by /u/username)'
}
```

**Occurrences:** Issue #680, Issue #712
**Last seen:** 2025-11-02
**Platform:** Reddit OAuth API
```

## Success Criteria

✅ Error classified correctly (AUTH/RATE_LIMIT/DATA/SERVER)
✅ Platform-specific quirks applied
✅ Retry logic implemented with exponential backoff
✅ Integration test added for edge case
✅ Pattern documented if recurring (≥2 occurrences)
✅ Defensive code prevents future occurrences

## Examples

### Example 1: Twitter Rate Limit (429)

**Error:**
```javascript
TwitterAPIError: Rate limit exceeded
  Status: 429
  Headers: { 'x-rate-limit-reset': '1698765432' }
```

**Debugging:**
1. **Identify:** Twitter API v2, fetchMentions endpoint
2. **Auth:** Token valid ✅
3. **Request:** GET /2/users/123/mentions
4. **Response:** 429 with x-rate-limit-reset
5. **Classify:** RATE_LIMIT (retryable)
6. **Quirks:** Twitter uses x-rate-limit-reset (Unix timestamp)
7. **Retry:** Wait until reset time + exponential backoff
8. **Test:** Mock 429 → verify retry → verify success

**Result:** API call succeeds after waiting for rate limit reset

### Example 2: Instagram Empty Data (Not Error)

**Symptom:**
```javascript
response.data.comments = undefined  // Expected array
```

**Debugging:**
1. **Identify:** Instagram Graph API, getComments endpoint
2. **Auth:** Token valid ✅
3. **Request:** GET /{post_id}/comments
4. **Response:** 200 OK but no `data.comments` field
5. **Classify:** DATA (but not error - privacy settings)
6. **Quirks:** Instagram hides comments if user privacy settings enabled
7. **Defensive:** Add null check, return empty array
8. **Test:** Mock empty response → verify graceful handling

**Fix:**
```javascript
const comments = response.data?.comments || [];
if (comments.length === 0) {
  logger.info('No comments available (privacy settings or no comments)');
}
return comments;
```

### Example 3: Reddit 429 Despite Valid Token

**Error:**
```javascript
RedditAPIError: Too Many Requests
  Status: 429
  No rate limit headers
```

**Debugging:**
1. **Identify:** Reddit OAuth API
2. **Auth:** Token valid ✅
3. **Request:** Missing User-Agent header ⚠️
4. **Classify:** RATE_LIMIT (but actually AUTH issue)
5. **Quirks:** Reddit REQUIRES User-Agent or instant 429
6. **Fix:** Add User-Agent header
7. **Test:** Mock with/without User-Agent → verify difference

**Pattern documented:** Added to `docs/patterns/api-quirks.md`

## Error Handling Patterns

### Pattern 1: Graceful Degradation
```javascript
try {
  const data = await apiCall();
  return data;
} catch (error) {
  logger.warn('API failed, using cached data', { error: error.message });
  return getCachedData() || [];
}
```

### Pattern 2: Circuit Breaker
```javascript
if (consecutiveFailures >= 5) {
  logger.error('Circuit breaker opened - too many failures');
  throw new Error('SERVICE_UNAVAILABLE: Circuit breaker active');
}
```

### Pattern 3: Fallback to Alternative API
```javascript
try {
  return await perspectiveAPI.analyzeToxicity(text);
} catch (error) {
  logger.warn('Perspective API failed, falling back to OpenAI');
  return await openAI.moderateContent(text);
}
```

## References

- **Platform docs:** `docs/INTEGRATIONS.md`
- **Known quirks:** `docs/patterns/api-quirks.md`
- **Base integration:** `src/integrations/base/BaseIntegration.js`
- **Test examples:** `tests/integration/api-errors.test.js`
- **Retry logic:** `src/utils/retryHelper.js` (if exists)

## Related Skills

- **systematic-debugging-skill** - General debugging framework
- **root-cause-tracing-skill** - Trace errors backward
- **test-generation-skill** - Generate integration tests

## Reglas de Oro

### ❌ NEVER

1. Log full API keys or tokens (use `[REDACTED]`)
2. Retry auth errors (401, 403) - fix credentials instead
3. Ignore platform-specific quirks (e.g., User-Agent for Reddit)
4. Assume error type without checking status code
5. Retry infinitely (cap at 3-5 attempts)

### ✅ ALWAYS

1. Classify error type (AUTH/RATE_LIMIT/DATA/SERVER)
2. Check platform quirks before debugging
3. Implement exponential backoff for retries
4. Add integration test for edge case
5. Document recurring patterns (≥2 occurrences)
6. Capture request/response for debugging
7. Respect rate limit reset times
8. Handle empty/null responses gracefully
