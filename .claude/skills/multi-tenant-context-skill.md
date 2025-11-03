---
name: multi-tenant-context-skill
description: Use when working with database queries, API endpoints, or workers - ensures organization_id context is preserved through entire request lifecycle, prevents data leaks between tenants
triggers:
  - "database query"
  - "SQL"
  - "organization_id"
  - "tenant"
  - "RLS"
  - "context leak"
  - "multi-tenant"
  - "isolation"
used_by:
  - back-end-dev
  - test-engineer
  - security-engineer
  - orchestrator
  - guardian
steps:
  - paso1: "Verify request has organization_id (from JWT, session, or worker context)"
  - paso2: "For ALL database queries: Add WHERE organization_id = $1"
  - paso3: "For INSERT: Include organization_id in values"
  - paso4: "For workers: Verify context passed through queue payload"
  - paso5: "Check RLS policies in database/schema.sql match code"
  - paso6: "Add test: Create 2 orgs, verify org1 can't see org2 data"
  - paso7: "Validate no context leak in error messages or logs"
output: |
  - All queries filtered by organization_id
  - Test proving tenant isolation
  - RLS policies aligned with application logic
  - Zero data leaks between tenants
---

# Multi-Tenant Context Preservation Skill

## Purpose

Ensures organization_id context is preserved throughout the entire request lifecycle in a multi-tenant application. Prevents data leaks between tenants (CRITICAL security requirement).

**Impact:** 100% prevention of tenant data leaks through systematic enforcement.

## When to Use

**Triggers:**
- Writing new database query (SELECT, INSERT, UPDATE, DELETE)
- Creating new API endpoint
- Modifying worker logic
- Testing multi-tenant features
- Security review before PR
- Guardian agent review

**Critical areas:**
- Database queries (ALL must filter by organization_id)
- Worker queue payloads
- API response serialization
- Error messages (may leak data)

## Multi-Tenant Architecture

### Context Flow

```
1. User Request
   ↓ (JWT contains organization_id)
2. Middleware extracts organization_id
   ↓ (req.user.organizationId)
3. Service Layer
   ↓ (Pass organizationId to all DB calls)
4. Database Query
   ↓ (WHERE organization_id = $1)
5. RLS Policy (Defense-in-Depth)
   ↓ (PostgreSQL enforces at DB level)
6. Response (only tenant's data)
```

### Defense-in-Depth Layers

**Layer 1: Application Code** (THIS SKILL)
- Explicit WHERE organization_id = $1 in queries
- Context passed through worker payloads
- Validation at API boundaries

**Layer 2: RLS Policies** (Database)
- PostgreSQL Row-Level Security
- Enforced even if application code fails
- See `database/schema.sql`

**Layer 3: Tests** (Verification)
- Multi-tenant isolation tests
- Prove org1 cannot see org2 data
- Run in CI/CD pipeline

## Context Preservation Rules

### Rule 1: Database Queries ALWAYS Filter by organization_id

**❌ WRONG:**
```sql
-- Missing organization_id filter - SECURITY BUG
SELECT * FROM roasts WHERE user_id = $1;
```

**✅ CORRECT:**
```sql
-- Filters by organization_id - safe
SELECT * FROM roasts
WHERE user_id = $1
  AND organization_id = $2;
```

**Example (Node.js):**
```javascript
// ❌ WRONG - Missing organization_id
async function getRoasts(userId) {
  const result = await db.query(
    'SELECT * FROM roasts WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

// ✅ CORRECT - Includes organization_id
async function getRoasts(userId, organizationId) {
  const result = await db.query(
    'SELECT * FROM roasts WHERE user_id = $1 AND organization_id = $2',
    [userId, organizationId]
  );
  return result.rows;
}
```

### Rule 2: INSERT Must Include organization_id

**❌ WRONG:**
```javascript
// Missing organization_id in INSERT
await db.query(
  'INSERT INTO roasts (user_id, text, created_at) VALUES ($1, $2, NOW())',
  [userId, text]
);
```

**✅ CORRECT:**
```javascript
// Includes organization_id in INSERT
await db.query(
  'INSERT INTO roasts (user_id, organization_id, text, created_at) VALUES ($1, $2, $3, NOW())',
  [userId, organizationId, text]
);
```

### Rule 3: UPDATE Must Filter by organization_id

**❌ WRONG:**
```javascript
// Missing organization_id filter - can update other tenant's data!
await db.query(
  'UPDATE roasts SET status = $1 WHERE id = $2',
  [newStatus, roastId]
);
```

**✅ CORRECT:**
```javascript
// Filters by organization_id - prevents cross-tenant updates
await db.query(
  'UPDATE roasts SET status = $1 WHERE id = $2 AND organization_id = $3',
  [newStatus, roastId, organizationId]
);
```

### Rule 4: DELETE Must Filter by organization_id

**❌ WRONG:**
```javascript
// Missing organization_id filter - can delete other tenant's data!
await db.query(
  'DELETE FROM roasts WHERE id = $1',
  [roastId]
);
```

**✅ CORRECT:**
```javascript
// Filters by organization_id - prevents cross-tenant deletions
await db.query(
  'DELETE FROM roasts WHERE id = $1 AND organization_id = $2',
  [roastId, organizationId]
);
```

## Context Extraction

### From JWT Token (API Requests)

```javascript
// middleware/auth.js
async function authenticateJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Extract organization_id from JWT payload
    req.user = {
      id: decoded.userId,
      organizationId: decoded.organizationId,  // CRITICAL: Always in JWT
      email: decoded.email
    };

    // Validate organization_id present
    if (!req.user.organizationId) {
      throw new Error('INVALID_TOKEN: Missing organization_id');
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Invalid token' });
  }
}
```

### From Session (Web Requests)

```javascript
// middleware/session.js
function requireSession(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED: Session required' });
  }

  // Extract organization_id from session
  req.user = {
    id: req.session.user.id,
    organizationId: req.session.user.organizationId
  };

  // Validate organization_id present
  if (!req.user.organizationId) {
    logger.error('Session missing organization_id', { userId: req.user.id });
    return res.status(500).json({ error: 'INTERNAL_ERROR: Invalid session' });
  }

  next();
}
```

### From Worker Queue Payload

```javascript
// workers/AnalyzeToxicityWorker.js
class AnalyzeToxicityWorker extends BaseWorker {
  async process(job) {
    const { commentId, userId, organizationId } = job.data;

    // CRITICAL: Validate organizationId in payload
    if (!organizationId) {
      throw new Error('INVALID_JOB: Missing organizationId in payload');
    }

    // Pass organizationId to all service calls
    const comment = await this.fetchComment(commentId, organizationId);
    const toxicity = await this.analyzeToxicity(comment.text, organizationId);
    await this.saveResult(commentId, toxicity, organizationId);
  }

  async fetchComment(commentId, organizationId) {
    // CORRECT: Filters by organizationId
    const result = await db.query(
      'SELECT * FROM comments WHERE id = $1 AND organization_id = $2',
      [commentId, organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('COMMENT_NOT_FOUND: Comment does not exist or belongs to different tenant');
    }

    return result.rows[0];
  }
}
```

## RLS Policy Alignment

### Check RLS Policies in database/schema.sql

**Example RLS policy:**
```sql
-- database/schema.sql
CREATE POLICY roasts_tenant_isolation ON roasts
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER);

ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;
```

**Set organization_id context in transaction:**
```javascript
async function withOrganizationContext(organizationId, callback) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Set organization_id for RLS policy
    await client.query(
      'SELECT set_config($1, $2, true)',
      ['app.current_organization_id', organizationId.toString()]
    );

    const result = await callback(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Usage
const roasts = await withOrganizationContext(organizationId, async (client) => {
  const result = await client.query('SELECT * FROM roasts WHERE user_id = $1', [userId]);
  return result.rows;
});
```

### Verify RLS Policy Enforces Isolation

**Test RLS in psql:**
```sql
-- Test as org1
SET app.current_organization_id = 1;
SELECT * FROM roasts;  -- Should only see org1's roasts

-- Test as org2
SET app.current_organization_id = 2;
SELECT * FROM roasts;  -- Should only see org2's roasts

-- Test without context (should fail or return empty)
RESET app.current_organization_id;
SELECT * FROM roasts;  -- Should be blocked by RLS
```

## Multi-Tenant Isolation Tests

### Test Template 1: Basic Isolation

```javascript
// tests/integration/multi-tenant-isolation.test.js
describe('Multi-tenant isolation', () => {
  let org1, org2, user1, user2;

  beforeEach(async () => {
    // Create two separate organizations
    org1 = await createOrganization({ name: 'Org 1' });
    org2 = await createOrganization({ name: 'Org 2' });

    // Create users in each org
    user1 = await createUser({ email: 'user1@org1.com', organizationId: org1.id });
    user2 = await createUser({ email: 'user2@org2.com', organizationId: org2.id });
  });

  it('should not leak roasts between organizations', async () => {
    // Create roast for org1
    const roast1 = await createRoast({
      userId: user1.id,
      organizationId: org1.id,
      text: 'Org1 roast'
    });

    // Create roast for org2
    const roast2 = await createRoast({
      userId: user2.id,
      organizationId: org2.id,
      text: 'Org2 roast'
    });

    // Fetch roasts for org1 - should only see org1's roast
    const org1Roasts = await getRoasts(user1.id, org1.id);
    expect(org1Roasts).toHaveLength(1);
    expect(org1Roasts[0].text).toBe('Org1 roast');
    expect(org1Roasts[0].id).toBe(roast1.id);

    // Fetch roasts for org2 - should only see org2's roast
    const org2Roasts = await getRoasts(user2.id, org2.id);
    expect(org2Roasts).toHaveLength(1);
    expect(org2Roasts[0].text).toBe('Org2 roast');
    expect(org2Roasts[0].id).toBe(roast2.id);
  });

  it('should prevent cross-tenant updates', async () => {
    // Create roast for org1
    const roast1 = await createRoast({
      userId: user1.id,
      organizationId: org1.id,
      text: 'Original text'
    });

    // Attempt to update org1's roast using org2's context
    await expect(
      updateRoast(roast1.id, org2.id, { text: 'Hacked text' })
    ).rejects.toThrow('ROAST_NOT_FOUND');

    // Verify roast unchanged
    const roast = await getRoast(roast1.id, org1.id);
    expect(roast.text).toBe('Original text');
  });

  it('should prevent cross-tenant deletes', async () => {
    // Create roast for org1
    const roast1 = await createRoast({
      userId: user1.id,
      organizationId: org1.id,
      text: 'Important data'
    });

    // Attempt to delete org1's roast using org2's context
    await expect(
      deleteRoast(roast1.id, org2.id)
    ).rejects.toThrow('ROAST_NOT_FOUND');

    // Verify roast still exists
    const roast = await getRoast(roast1.id, org1.id);
    expect(roast).toBeDefined();
  });
});
```

### Test Template 2: Worker Context Isolation

```javascript
describe('Worker multi-tenant isolation', () => {
  it('should pass organizationId through worker queue', async () => {
    const org1 = await createOrganization();
    const comment = await createComment({ organizationId: org1.id, text: 'Test comment' });

    // Queue job
    const job = await queueService.add('analyze-toxicity', {
      commentId: comment.id,
      userId: comment.userId,
      organizationId: org1.id  // CRITICAL: Must include
    });

    // Process job
    await worker.process(job);

    // Verify result stored with correct organization_id
    const result = await getToxicityResult(comment.id, org1.id);
    expect(result.organizationId).toBe(org1.id);
  });

  it('should fail if worker job missing organizationId', async () => {
    const job = {
      data: {
        commentId: 123,
        userId: 456
        // Missing organizationId
      }
    };

    await expect(worker.process(job))
      .rejects.toThrow('INVALID_JOB: Missing organizationId');
  });
});
```

### Test Template 3: API Endpoint Isolation

```javascript
describe('API endpoint multi-tenant isolation', () => {
  it('should only return current tenant data in /api/roasts', async () => {
    const org1 = await createOrganization();
    const org2 = await createOrganization();

    const user1 = await createUser({ organizationId: org1.id });
    const user2 = await createUser({ organizationId: org2.id });

    // Create roasts for both orgs
    await createRoast({ userId: user1.id, organizationId: org1.id, text: 'Org1' });
    await createRoast({ userId: user2.id, organizationId: org2.id, text: 'Org2' });

    // Request as org1
    const token1 = generateJWT({ userId: user1.id, organizationId: org1.id });
    const response1 = await request(app)
      .get('/api/roasts')
      .set('Authorization', `Bearer ${token1}`);

    expect(response1.status).toBe(200);
    expect(response1.body.roasts).toHaveLength(1);
    expect(response1.body.roasts[0].text).toBe('Org1');

    // Request as org2
    const token2 = generateJWT({ userId: user2.id, organizationId: org2.id });
    const response2 = await request(app)
      .get('/api/roasts')
      .set('Authorization', `Bearer ${token2}`);

    expect(response2.status).toBe(200);
    expect(response2.body.roasts).toHaveLength(1);
    expect(response2.body.roasts[0].text).toBe('Org2');
  });
});
```

## Error Message Leaks

### ❌ WRONG: Error Reveals Cross-Tenant Data

```javascript
try {
  const roast = await getRoast(roastId, organizationId);
} catch (error) {
  // BAD: Reveals that roast exists in different org
  throw new Error(`Roast ${roastId} not found in organization ${organizationId}, found in org ${roast.actual_org_id}`);
}
```

### ✅ CORRECT: Generic Error Message

```javascript
try {
  const roast = await getRoast(roastId, organizationId);

  if (!roast) {
    // GOOD: Generic message, no leak
    throw new Error('ROAST_NOT_FOUND: Roast does not exist');
  }
} catch (error) {
  // Log details internally (NOT returned to client)
  logger.warn('Roast access attempt', {
    roastId,
    requestedOrgId: organizationId,
    actualOrgId: roast?.organizationId,
    userId: req.user.id
  });

  // Return generic error to client
  throw new Error('ROAST_NOT_FOUND');
}
```

## Pre-Commit Validation

### Add Git Hook to Detect Missing organization_id

```bash
# .git/hooks/pre-commit
#!/bin/bash

# Check for SQL queries without organization_id filter
echo "🔍 Checking for queries missing organization_id filter..."

# Patterns to detect
PATTERNS=(
  "SELECT.*FROM.*WHERE.*user_id.*[^organization_id]"
  "UPDATE.*SET.*WHERE.*[^organization_id]"
  "DELETE.*FROM.*WHERE.*[^organization_id]"
)

VIOLATIONS=0

for pattern in "${PATTERNS[@]}"; do
  if git diff --cached --name-only | xargs grep -E "$pattern" 2>/dev/null; then
    echo "❌ Found query without organization_id filter!"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "⚠️  BLOCKED: Queries must filter by organization_id in multi-tenant system"
  echo "See: .claude/skills/multi-tenant-context-skill.md"
  exit 1
fi

echo "✅ Multi-tenant context validation passed"
exit 0
```

## Success Criteria

✅ Request has organization_id extracted from JWT/session/payload
✅ ALL database queries filter by organization_id
✅ INSERT includes organization_id
✅ UPDATE/DELETE filter by organization_id
✅ Workers pass organization_id through queue payload
✅ RLS policies aligned with application code
✅ Multi-tenant isolation tests pass
✅ Error messages don't leak cross-tenant data
✅ Pre-commit hook validates queries

## References

- **Database schema:** `database/schema.sql` - RLS policies
- **Architecture:** `docs/nodes/database-layer.md` - Multi-tenant design
- **Auth middleware:** `src/middleware/auth.js`
- **Test examples:** `tests/integration/multi-tenant-isolation.test.js`

## Related Skills

- **security-audit-skill** - Comprehensive security audit
- **systematic-debugging-skill** - Debug tenant isolation issues
- **test-generation-skill** - Generate isolation tests

## Reglas de Oro

### ❌ NEVER

1. Write query without organization_id filter (except for org management tables)
2. Trust client to provide organization_id (extract from JWT)
3. Skip multi-tenant isolation tests
4. Return cross-tenant data in error messages
5. Log sensitive data that could leak between tenants

### ✅ ALWAYS

1. Extract organization_id from JWT/session (never from client params)
2. Filter ALL queries by organization_id
3. Include organization_id in INSERT statements
4. Pass organization_id through worker queue payloads
5. Verify RLS policies match application logic
6. Test with multiple orgs to prove isolation
7. Use generic error messages (prevent leaks)
8. Run pre-commit validation hook
