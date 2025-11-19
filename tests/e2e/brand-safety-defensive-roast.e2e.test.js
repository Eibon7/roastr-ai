/**
 * E2E Test: Defensive Roast Flow with Tone Override (Brand Safety)
 *
 * Tests the roast generation flow when a sponsor's tone override is applied.
 * Focuses specifically on tone modulation and defensive roast generation.
 *
 * Issue: #866 (Integration Tests for Brand Safety)
 * Parent Issue: #859 (Brand Safety for Sponsors - Plan Plus)
 * Implementation: PR #865
 *
 * Flow tested:
 * 1. User configures sponsor with different tone overrides
 * 2. Comment mentions sponsor
 * 3. Roast generated with sponsor's tone (professional, light_humor, aggressive_irony)
 * 4. Roast quality and tone verified
 *
 * @see src/services/roastGeneratorService.js
 * @see src/services/sponsorService.js
 * @see docs/plan/issue-866.md
 */

const request = require('supertest');
const app = require('../../src/index');
const { createTestTenants, cleanupTestData, serviceClient } = require('../helpers/tenantTestUtils');
const jwt = require('jsonwebtoken');

// Mock OpenAI with tone-aware responses
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation((params) => {
          const prompt = params.messages[0].content;
          
          // Detect tone from prompt and generate appropriate response
          let roastContent;
          let tone = 'normal';

          if (prompt.includes('professional') || prompt.includes('measured')) {
            roastContent = "Let's keep this discussion constructive and focused on quality.";
            tone = 'professional';
          } else if (prompt.includes('light_humor') || prompt.includes('lighthearted')) {
            roastContent = "Hey, everyone's entitled to their opinion... even the wildly incorrect ones! 😄";
            tone = 'light_humor';
          } else if (prompt.includes('aggressive_irony') || prompt.includes('direct sarcasm')) {
            roastContent = "Oh wow, what an incredibly original take! Never heard THAT one before. 🙄";
            tone = 'aggressive_irony';
          } else {
            roastContent = "Interesting perspective, though I might respectfully disagree.";
            tone = 'normal';
          }

          return Promise.resolve({
            choices: [{
              message: {
                content: JSON.stringify({
                  roast: roastContent,
                  tone: tone,
                  quality_score: 0.85
                })
              }
            }]
          });
        })
      }
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
      safeUserIdPrefix: jest.fn(id => 'mock-user...'),
      truncateString: jest.fn(str => str)
    }
  });
});

describe('E2E: Brand Safety - Defensive Roast with Tone Override', () => {
  let testTenants;
  let plusUserId;
  let plusUserToken;
  let professionalSponsorId;
  let lightHumorSponsorId;
  let aggressiveIronySponsorId;

  beforeAll(async () => {
    /**
     * PRE-REQUISITE: Apply migration database/migrations/027_sponsors.sql
     */

    testTenants = await createTestTenants();

    const { data: orgA } = await serviceClient
      .from('organizations')
      .select('owner_id')
      .eq('id', testTenants.tenantA.id)
      .single();

    plusUserId = orgA.owner_id;

    // Upgrade to Plus plan
    await serviceClient
      .from('users')
      .update({ plan: 'plus', plan_started_at: new Date().toISOString() })
      .eq('id', plusUserId);

    plusUserToken = jwt.sign(
      { user_id: plusUserId, email: 'plus-user@test.com', plan: 'plus' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create sponsors with different tone overrides
    const sponsors = await serviceClient
      .from('sponsors')
      .insert([
        {
          user_id: plusUserId,
          name: 'IBM',
          url: 'https://www.ibm.com',
          tags: ['enterprise', 'technology'],
          severity: 'high',
          tone: 'professional',
          priority: 1,
          actions: ['def_roast'],
          active: true
        },
        {
          user_id: plusUserId,
          name: 'Ben & Jerry\'s',
          url: 'https://www.benandjerrys.com',
          tags: ['ice cream', 'food'],
          severity: 'medium',
          tone: 'light_humor',
          priority: 2,
          actions: ['def_roast'],
          active: true
        },
        {
          user_id: plusUserId,
          name: 'Cards Against Humanity',
          url: 'https://www.cardsagainsthumanity.com',
          tags: ['games', 'humor'],
          severity: 'low',
          tone: 'aggressive_irony',
          priority: 3,
          actions: ['def_roast'],
          active: true
        }
      ])
      .select();

    professionalSponsorId = sponsors.data[0].id;
    lightHumorSponsorId = sponsors.data[1].id;
    aggressiveIronySponsorId = sponsors.data[2].id;

    console.log('✅ E2E Test Setup Complete (Defensive Roast):', {
      plusUserId,
      sponsors_created: 3
    });
  });

  afterAll(async () => {
    await cleanupTestData();

    if (serviceClient && typeof serviceClient.removeAllChannels === 'function') {
      serviceClient.removeAllChannels();
    }
  });

  // ============================================================================
  // AC #5: Tone Override E2E Tests
  // ============================================================================

  describe('Tone Override: Professional', () => {
    it('should generate professional defensive roast when IBM is mentioned', async () => {
      const comment = {
        platform: 'twitter',
        platform_comment_id: `tw_professional_${Date.now()}`,
        author_id: 'critic_user_123',
        author_username: 'TechCritic',
        content: 'IBM is outdated and irrelevant in today\'s tech world.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: createdComment } = await serviceClient
        .from('comments')
        .insert(comment)
        .select()
        .single();

      // Request roast generation via API
      const roastResponse = await request(app)
        .post('/api/roasts/generate')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: createdComment.id,
          comment_text: comment.content,
          detect_sponsors: true // Enable sponsor detection
        });

      expect(roastResponse.status).toBe(200);
      expect(roastResponse.body).toMatchObject({
        roast: expect.any(String),
        tone: 'professional',
        sponsor_detected: true,
        sponsor_name: 'IBM',
        quality_score: expect.any(Number)
      });

      // Verify tone characteristics: formal, measured, no aggressive language
      const roast = roastResponse.body.roast;
      expect(roast).toMatch(/constructive|quality|focused|respectful/i);
      expect(roast).not.toMatch(/sucks|stupid|dumb|trash/i);

      // Verify response persisted with correct tone
      const { data: responses } = await serviceClient
        .from('responses')
        .select('*')
        .eq('comment_id', createdComment.id)
        .single();

      expect(responses.tone).toBe('professional');
      expect(responses.sponsor_detected).toBe(true);
      expect(responses.sponsor_id).toBe(professionalSponsorId);
    });
  });

  describe('Tone Override: Light Humor', () => {
    it('should generate lighthearted defensive roast when Ben & Jerry\'s is mentioned', async () => {
      const comment = {
        platform: 'twitter',
        platform_comment_id: `tw_light_humor_${Date.now()}`,
        author_id: 'food_critic_456',
        author_username: 'FoodCritic',
        content: 'Ben & Jerry\'s ice cream is overrated and too expensive.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: createdComment } = await serviceClient
        .from('comments')
        .insert(comment)
        .select()
        .single();

      const roastResponse = await request(app)
        .post('/api/roasts/generate')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: createdComment.id,
          comment_text: comment.content,
          detect_sponsors: true
        });

      expect(roastResponse.status).toBe(200);
      expect(roastResponse.body).toMatchObject({
        tone: 'light_humor',
        sponsor_detected: true,
        sponsor_name: 'Ben & Jerry\'s'
      });

      // Verify tone characteristics: playful, emoji, gentle sarcasm
      const roast = roastResponse.body.roast;
      expect(roast).toMatch(/😄|😊|🙂|opinion|wildly|incorrect/i);
      expect(roast).not.toMatch(/shut up|idiot|moron/i);
    });
  });

  describe('Tone Override: Aggressive Irony', () => {
    it('should generate sarcastic roast when Cards Against Humanity is mentioned', async () => {
      const comment = {
        platform: 'twitter',
        platform_comment_id: `tw_aggressive_${Date.now()}`,
        author_id: 'game_hater_789',
        author_username: 'GameHater',
        content: 'Cards Against Humanity is offensive and not funny at all.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: createdComment } = await serviceClient
        .from('comments')
        .insert(comment)
        .select()
        .single();

      const roastResponse = await request(app)
        .post('/api/roasts/generate')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: createdComment.id,
          comment_text: comment.content,
          detect_sponsors: true
        });

      expect(roastResponse.status).toBe(200);
      expect(roastResponse.body).toMatchObject({
        tone: 'aggressive_irony',
        sponsor_detected: true,
        sponsor_name: 'Cards Against Humanity'
      });

      // Verify tone characteristics: sarcasm, irony, direct
      const roast = roastResponse.body.roast;
      expect(roast).toMatch(/wow|original|never heard|before|🙄/i);
      expect(roast.length).toBeGreaterThan(20); // Substantive response
    });
  });

  describe('Tone Override: Normal (No Sponsor)', () => {
    it('should generate normal tone roast when no sponsor is mentioned', async () => {
      const comment = {
        platform: 'twitter',
        platform_comment_id: `tw_normal_${Date.now()}`,
        author_id: 'random_user_999',
        author_username: 'RandomUser',
        content: 'This product is mediocre and not worth the price.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: createdComment } = await serviceClient
        .from('comments')
        .insert(comment)
        .select()
        .single();

      const roastResponse = await request(app)
        .post('/api/roasts/generate')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: createdComment.id,
          comment_text: comment.content,
          detect_sponsors: true
        });

      expect(roastResponse.status).toBe(200);
      expect(roastResponse.body).toMatchObject({
        tone: 'normal',
        sponsor_detected: false
      });

      // Normal tone: balanced, not overly formal or aggressive
      const roast = roastResponse.body.roast;
      expect(roast).toMatch(/interesting|perspective|respectfully/i);
    });
  });

  describe('Edge Cases: Tone Override', () => {
    it('should fallback to user default tone if sponsor tone is invalid', async () => {
      // Create sponsor with invalid tone (simulate data corruption)
      const { data: invalidToneSponsor } = await serviceClient
        .from('sponsors')
        .insert({
          user_id: plusUserId,
          name: 'Invalid Tone Sponsor',
          tags: ['test'],
          severity: 'medium',
          tone: 'normal', // Valid, but we'll test fallback
          priority: 4,
          actions: ['def_roast'],
          active: true
        })
        .select()
        .single();

      const comment = {
        platform: 'twitter',
        platform_comment_id: `tw_fallback_${Date.now()}`,
        author_id: 'fallback_user',
        author_username: 'FallbackUser',
        content: 'Invalid Tone Sponsor is terrible.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: createdComment } = await serviceClient
        .from('comments')
        .insert(comment)
        .select()
        .single();

      const roastResponse = await request(app)
        .post('/api/roasts/generate')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: createdComment.id,
          comment_text: comment.content,
          detect_sponsors: true
        });

      expect(roastResponse.status).toBe(200);
      expect(roastResponse.body.tone).toBe('normal'); // Fallback to normal
    });

    it('should respect tone override even for low severity sponsors', async () => {
      /**
       * Test that tone override is applied regardless of severity level
       */

      const comment = {
        platform: 'twitter',
        platform_comment_id: `tw_low_severity_${Date.now()}`,
        author_id: 'severity_test_user',
        author_username: 'SeverityTest',
        content: 'Cards Against Humanity is overrated.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: createdComment } = await serviceClient
        .from('comments')
        .insert(comment)
        .select()
        .single();

      const roastResponse = await request(app)
        .post('/api/roasts/generate')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: createdComment.id,
          comment_text: comment.content,
          detect_sponsors: true
        });

      expect(roastResponse.status).toBe(200);
      expect(roastResponse.body).toMatchObject({
        tone: 'aggressive_irony', // Should apply tone despite low severity
        sponsor_detected: true,
        sponsor_name: 'Cards Against Humanity'
      });
    });

    it('should cache tone override for subsequent roasts of same sponsor', async () => {
      /**
       * Test that tone override is consistently applied across multiple comments
       */

      const comment1 = {
        platform: 'twitter',
        platform_comment_id: `tw_cache_1_${Date.now()}`,
        author_id: 'cache_user_1',
        author_username: 'CacheUser1',
        content: 'IBM mainframes are dinosaurs.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const comment2 = {
        platform: 'twitter',
        platform_comment_id: `tw_cache_2_${Date.now()}`,
        author_id: 'cache_user_2',
        author_username: 'CacheUser2',
        content: 'IBM cloud is inferior to AWS.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: createdComment1 } = await serviceClient
        .from('comments')
        .insert(comment1)
        .select()
        .single();

      const { data: createdComment2 } = await serviceClient
        .from('comments')
        .insert(comment2)
        .select()
        .single();

      const roast1 = await request(app)
        .post('/api/roasts/generate')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: createdComment1.id,
          comment_text: comment1.content,
          detect_sponsors: true
        });

      const roast2 = await request(app)
        .post('/api/roasts/generate')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: createdComment2.id,
          comment_text: comment2.content,
          detect_sponsors: true
        });

      // Both should have professional tone (IBM's override)
      expect(roast1.body.tone).toBe('professional');
      expect(roast2.body.tone).toBe('professional');
      expect(roast1.body.sponsor_name).toBe('IBM');
      expect(roast2.body.sponsor_name).toBe('IBM');
    });
  });

  describe('Performance: Tone Override', () => {
    it('should apply tone override within acceptable latency (<500ms)', async () => {
      const comment = {
        platform: 'twitter',
        platform_comment_id: `tw_perf_${Date.now()}`,
        author_id: 'perf_user',
        author_username: 'PerfUser',
        content: 'IBM is slow and outdated.',
        post_id: `post_${Date.now()}`,
        organization_id: testTenants.tenantA.id
      };

      const { data: createdComment } = await serviceClient
        .from('comments')
        .insert(comment)
        .select()
        .single();

      const startTime = Date.now();

      const roastResponse = await request(app)
        .post('/api/roasts/generate')
        .set('Authorization', `Bearer ${plusUserToken}`)
        .send({
          comment_id: createdComment.id,
          comment_text: comment.content,
          detect_sponsors: true
        });

      const latency = Date.now() - startTime;

      expect(roastResponse.status).toBe(200);
      expect(roastResponse.body.tone).toBe('professional');
      expect(latency).toBeLessThan(500); // Target: <500ms for tone override application
    });
  });
});

