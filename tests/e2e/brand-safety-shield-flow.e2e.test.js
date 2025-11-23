/**
 * E2E Test: Full Shield Flow with Brand Safety (Sponsors)
 *
 * Tests the complete flow from comment detection → sponsor mention detection
 * → Shield moderation → automated actions → roast generation with tone override
 *
 * Issue: #866 (Integration Tests for Brand Safety)
 * Parent Issue: #859 (Brand Safety for Sponsors - Plan Plus)
 * Implementation: PR #865
 *
 * Flow tested:
 * 1. User with Plus plan configures a sponsor (Nike)
 * 2. Toxic comment mentions the sponsor ("Nike sucks")
 * 3. Shield detects toxicity + sponsor mention
 * 4. Automatic moderation actions triggered (hide_comment, def_roast)
 * 5. Roast generated with sponsor's tone override (professional)
 * 6. Comment hidden and response posted
 *
 * @see src/services/sponsorService.js
 * @see src/services/shieldService.js
 * @see src/services/roastGeneratorService.js
 * @see docs/plan/issue-866.md
 */

const request = require('supertest');
const app = require('../../src/index');
const { createTestTenants, cleanupTestData, serviceClient } = require('../helpers/tenantTestUtils');
const jwt = require('jsonwebtoken');

// Mock external services to avoid costs
// Make mock reflect toxic vs non-toxic scenarios based on input text
const analyzeToxicity = jest.fn((text) => {
  const isToxic = /sucks|garbage|terrible|trash/i.test(text || '');
  return Promise.resolve({
    scores: {
      TOXICITY: isToxic ? 0.85 : 0.1,
      SEVERE_TOXICITY: isToxic ? 0.75 : 0.05,
      INSULT: isToxic ? 0.8 : 0.05
    }
  });
});

jest.mock('../../src/integrations/perspectiveClient', () => ({
  analyzeToxicity
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  roast: "Let's keep the conversation constructive and respectful.",
                  tone: 'professional',
                  quality_score: 0.85
                })
              }
            }
          ]
        })
      }
    },
    responses: {
      create: jest.fn().mockResolvedValue({
        // Mock Responses API for roast generation (per PR #864)
        output_text: JSON.stringify({
          roast: "Let's keep the conversation constructive and respectful.",
          tone: 'professional',
          quality_score: 0.85
        })
      })
    }
  }));
});

jest.mock('../../src/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  return Object.assign(mockLogger, {
    logger: mockLogger,
    SafeUtils: {
      safeUserIdPrefix: jest.fn((id) => 'mock-user...'),
      truncateString: jest.fn((str) => str)
    }
  });
});

describe('E2E: Brand Safety - Full Shield Flow', () => {
  let testTenants;
  let plusUserId;
  let plusUserToken;
  let sponsorId;
  let commentId;

  beforeAll(async () => {
    /**
     * PRE-REQUISITE: Apply migration supabase/migrations/20251119000001_sponsors_brand_safety.sql
     * (see tests/integration/sponsor-service-integration.test.js for instructions)
     */

    // Create test tenants
    testTenants = await createTestTenants();

    // Get Plus user (upgrade tenant A to Plus plan)
    const { data: orgA } = await serviceClient
      .from('organizations')
      .select('owner_id')
      .eq('id', testTenants.tenantA.id)
      .single();

    plusUserId = orgA.owner_id;

    // Upgrade user to Plus plan
    await serviceClient
      .from('users')
      .update({ plan: 'plus', plan_started_at: new Date().toISOString() })
      .eq('id', plusUserId);

    // Generate JWT token for Plus user
    plusUserToken = jwt.sign(
      { user_id: plusUserId, email: 'plus-user@test.com', plan: 'plus' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create a test sponsor (Nike) via service client
    const { data: sponsor } = await serviceClient
      .from('sponsors')
      .insert({
        user_id: plusUserId,
        name: 'Nike',
        url: 'https://www.nike.com',
        tags: ['sportswear', 'sneakers', 'athletics'],
        severity: 'high',
        tone: 'professional',
        priority: 1,
        actions: ['hide_comment', 'def_roast'],
        active: true
      })
      .select()
      .single();

    sponsorId = sponsor.id;
  });

  afterAll(async () => {
    await cleanupTestData();

    if (serviceClient && typeof serviceClient.removeAllChannels === 'function') {
      serviceClient.removeAllChannels();
    }
  });

  // ============================================================================
  // AC #4: E2E Shield Flow with Brand Safety
  // ============================================================================

  describe('Full Shield Flow: Toxic Comment + Sponsor Mention', () => {
    it('should detect sponsor mention, trigger Shield, hide comment, and generate professional roast', async () => {
      /**
       * FLOW:
       * 1. Create a comment mentioning sponsor ("Nike sucks")
       * 2. Analyze comment with Shield (detect toxicity + sponsor)
       * 3. Trigger moderation actions (hide_comment, def_roast)
       * 4. Generate roast with tone override (professional)
       * 5. Post defensive roast as reply
       * 6. Verify comment hidden, response posted, tone = professional
       */

      // STEP 1: Create a toxic comment mentioning Nike
      const toxicComment = {
        platform: 'twitter',
        platform_comment_id: `tw_${Date.now()}`,
        author_id: 'toxic_user_123',
        author_username: 'ToxicTroll',
        content: 'Nike sucks! Their products are garbage and overpriced trash.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: comment } = await serviceClient
        .from('comments')
        .insert(toxicComment)
        .select()
        .single();

      commentId = comment.id;
      expect(comment).toBeDefined();

      // STEP 2: Run Shield analysis via API
      const shieldResponse = await request(app)
        .post('/api/shield/analyze')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: commentId,
          comment_text: toxicComment.content
        });

      expect(shieldResponse.status).toBe(200);
      expect(shieldResponse.body).toMatchObject({
        comment_id: commentId,
        toxicity_detected: true,
        sponsor_detected: true,
        sponsor_name: 'Nike',
        actions_taken: expect.arrayContaining(['hide_comment', 'def_roast']),
        tone_override: 'professional'
      });

      // STEP 3: Verify comment was hidden
      const { data: hiddenComment } = await serviceClient
        .from('comments')
        .select('hidden, hidden_reason')
        .eq('id', commentId)
        .single();

      expect(hiddenComment.hidden).toBe(true);
      expect(hiddenComment.hidden_reason).toMatch(/sponsor protection|brand safety/i);

      // STEP 4: Verify roast was generated with professional tone
      const { data: responses } = await serviceClient
        .from('responses')
        .select('*')
        .eq('comment_id', commentId)
        .order('created_at', { ascending: false })
        .limit(1);

      expect(responses).toHaveLength(1);
      const response = responses[0];

      expect(response.roast_content).toBeDefined();
      expect(response.roast_content).toMatch(/constructive|respectful|professional/i);
      expect(response.tone).toBe('professional');
      expect(response.quality_score).toBeGreaterThanOrEqual(0.7);

      // STEP 5: Verify Shield decision was logged
      const { data: shieldDecisions } = await serviceClient
        .from('shield_decisions')
        .select('*')
        .eq('comment_id', commentId)
        .single();

      expect(shieldDecisions).toMatchObject({
        comment_id: commentId,
        toxicity_score: expect.any(Number),
        sponsor_detected: true,
        sponsor_id: sponsorId,
        actions_taken: expect.arrayContaining(['hide_comment', 'def_roast']),
        tone_override: 'professional'
      });
    });

    it('should NOT trigger Shield for non-toxic comment mentioning sponsor', async () => {
      /**
       * Test that positive/neutral mentions of sponsors do NOT trigger moderation
       */

      const positiveComment = {
        platform: 'twitter',
        platform_comment_id: `tw_positive_${Date.now()}`,
        author_id: 'fan_user_456',
        author_username: 'NikeFan',
        content: 'I love Nike shoes! Best quality and comfort.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: comment } = await serviceClient
        .from('comments')
        .insert(positiveComment)
        .select()
        .single();

      // Run Shield analysis
      const shieldResponse = await request(app)
        .post('/api/shield/analyze')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: comment.id,
          comment_text: positiveComment.content
        });

      expect(shieldResponse.status).toBe(200);
      expect(shieldResponse.body).toMatchObject({
        comment_id: comment.id,
        toxicity_detected: false,
        sponsor_detected: true, // Sponsor mentioned but not toxic
        sponsor_name: 'Nike',
        actions_taken: [] // No actions because not toxic
      });

      // Verify comment NOT hidden
      const { data: visibleComment } = await serviceClient
        .from('comments')
        .select('hidden')
        .eq('id', comment.id)
        .single();

      expect(visibleComment.hidden).toBe(false);
    });

    it('should enforce Plan Plus requirement for sponsor API access', async () => {
      /**
       * Test that Free/Starter users cannot access sponsor endpoints
       */

      // Create a Free user token
      const freeUserToken = jwt.sign(
        { user_id: plusUserId, email: 'free-user@test.com', plan: 'free' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/sponsors')
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: expect.stringMatching(/upgrade|plus|plan/i),
        required_plan: 'plus',
        feature: 'brand_safety'
      });
    });

    it('should handle multiple sponsor conflicts with priority resolution', async () => {
      /**
       * Test that when multiple sponsors are mentioned, highest priority wins
       */

      // Create second sponsor with lower priority
      await serviceClient.from('sponsors').insert({
        user_id: plusUserId,
        name: 'Adidas',
        url: 'https://www.adidas.com',
        tags: ['sportswear', 'athletics'],
        severity: 'medium',
        tone: 'light_humor',
        priority: 2, // Lower priority than Nike (priority 1)
        actions: ['def_roast'],
        active: true
      });

      const multiSponsorComment = {
        platform: 'twitter',
        platform_comment_id: `tw_multi_${Date.now()}`,
        author_id: 'multi_user_789',
        author_username: 'SportsHater',
        content: 'Both Nike and Adidas make terrible products!',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: comment } = await serviceClient
        .from('comments')
        .insert(multiSponsorComment)
        .select()
        .single();

      const shieldResponse = await request(app)
        .post('/api/shield/analyze')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: comment.id,
          comment_text: multiSponsorComment.content
        });

      expect(shieldResponse.status).toBe(200);
      expect(shieldResponse.body).toMatchObject({
        sponsor_detected: true,
        sponsor_name: 'Nike', // Highest priority (1) should win
        tone_override: 'professional', // Nike's tone, not Adidas's light_humor
        actions_taken: expect.arrayContaining(['hide_comment', 'def_roast']) // Nike's actions
      });
    });

    it('should skip inactive sponsors in detection', async () => {
      /**
       * Test that deactivated sponsors are ignored
       */

      // Deactivate Nike sponsor
      await serviceClient.from('sponsors').update({ active: false }).eq('id', sponsorId);

      const inactiveTestComment = {
        platform: 'twitter',
        platform_comment_id: `tw_inactive_${Date.now()}`,
        author_id: 'inactive_test_user',
        author_username: 'TestUser',
        content: 'Nike products are overpriced',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: comment } = await serviceClient
        .from('comments')
        .insert(inactiveTestComment)
        .select()
        .single();

      const shieldResponse = await request(app)
        .post('/api/shield/analyze')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: comment.id,
          comment_text: inactiveTestComment.content
        });

      expect(shieldResponse.status).toBe(200);
      expect(shieldResponse.body).toMatchObject({
        sponsor_detected: false, // Nike is inactive, should not be detected
        actions_taken: [] // No sponsor-based actions
      });

      // Reactivate Nike for subsequent tests
      await serviceClient.from('sponsors').update({ active: true }).eq('id', sponsorId);
    });
  });
});
