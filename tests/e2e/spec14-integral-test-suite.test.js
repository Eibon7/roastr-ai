/**
 * SPEC 14 - QA: Test Suite Integral (E2E + Contracts + Tiers + Idempotencia)
 * 
 * Comprehensive End-to-End test suite covering all critical flows:
 * 1. Light comments → normal publishing
 * 2. Intermediate comments → roasteable zone (auto-approve ON/OFF)
 * 3. Critical comments → Shield critical actions
 * 4. Corrective zone → strike 1 + corrective response + reincidence escalation
 * 5. Inline editor → validator → publish/block decision
 * 
 * All tests use synthetic GDPR-compliant data and run with dryRun=true in CI
 */

const request = require('supertest');
const app = require('../../src/index');
const { createSyntheticFixtures } = require('../helpers/syntheticFixtures');

// Mock external dependencies to prevent real API calls
jest.mock('../../src/services/openai');
jest.mock('../../src/services/perspective');
jest.mock('../../src/integrations/twitter/twitterService');
jest.mock('../../src/adapters/mock/TwitterShieldAdapter');

describe('SPEC 14 - Integral Test Suite (E2E)', () => {
  let fixtures;
  let testOrg;
  let testUser;
  let mockAuthToken;

  beforeAll(async () => {
    // Create synthetic test data
    fixtures = await createSyntheticFixtures();
    testOrg = fixtures.organizations.basic;
    testUser = fixtures.users.proUser;
    mockAuthToken = fixtures.auth.proUserToken;

    // Set environment for tests
    process.env.ENABLE_MOCK_MODE = 'true';
    process.env.DRY_RUN_SHIELD = 'true';
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // Cleanup test environment
    delete process.env.DRY_RUN_SHIELD;
  });

  describe('Scenario 1: Light Comment → Normal Publishing', () => {
    test('should process light comment through complete pipeline to normal publishing', async () => {
      const lightComment = fixtures.comments.light;
      
      // Step 1: Ingest comment
      const ingestResponse = await request(app)
        .post('/api/comments/ingest')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          platform: 'twitter',
          external_comment_id: lightComment.external_id,
          comment_text: lightComment.text,
          author_id: lightComment.author.id,
          author_username: lightComment.author.username,
          org_id: testOrg.id
        })
        .expect(201);

      expect(ingestResponse.body.data.status).toBe('ingested');
      
      // Step 2: Toxicity analysis should classify as light
      const analysisResponse = await request(app)
        .get(`/api/comments/${ingestResponse.body.data.id}/analysis`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(analysisResponse.body.data.toxicity_score).toBeLessThan(0.3);
      expect(analysisResponse.body.data.classification).toBe('light');
      
      // Step 3: Decision should be "publish_normal"
      const decisionResponse = await request(app)
        .get(`/api/comments/${ingestResponse.body.data.id}/decision`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(decisionResponse.body.data.decision).toBe('publish_normal');
      expect(decisionResponse.body.data.shield_action).toBeNull();
      
      // Step 4: Response should be generated and published normally
      const responseResponse = await request(app)
        .post(`/api/comments/${ingestResponse.body.data.id}/generate`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(201);

      expect(responseResponse.body.data.variants).toHaveLength(1);
      expect(responseResponse.body.data.auto_approved).toBe(true);
      expect(responseResponse.body.data.published).toBe(true);
    });
  });

  describe('Scenario 2: Intermediate Comment → Roasteable Zone', () => {
    describe('Auto-approve ON', () => {
      test('should process intermediate comment with auto-approval enabled', async () => {
        const intermediateComment = fixtures.comments.intermediate;
        
        // Configure auto-approval for this org
        await request(app)
          .patch('/api/organizations/settings')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({ auto_approve: true })
          .expect(200);

        // Step 1: Ingest comment
        const ingestResponse = await request(app)
          .post('/api/comments/ingest')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({
            platform: 'twitter',
            external_comment_id: intermediateComment.external_id,
            comment_text: intermediateComment.text,
            author_id: intermediateComment.author.id,
            author_username: intermediateComment.author.username,
            org_id: testOrg.id
          })
          .expect(201);

        // Step 2: Analysis should classify as roasteable
        const analysisResponse = await request(app)
          .get(`/api/comments/${ingestResponse.body.data.id}/analysis`)
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .expect(200);

        expect(analysisResponse.body.data.toxicity_score).toBeGreaterThan(0.3);
        expect(analysisResponse.body.data.toxicity_score).toBeLessThan(0.7);
        expect(analysisResponse.body.data.classification).toBe('roasteable');

        // Step 3: Decision should be "roast_auto"
        const decisionResponse = await request(app)
          .get(`/api/comments/${ingestResponse.body.data.id}/decision`)
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .expect(200);

        expect(decisionResponse.body.data.decision).toBe('roast_auto');

        // Step 4: Generate 2 initial variants (manual mode requirement)
        const generateResponse = await request(app)
          .post(`/api/comments/${ingestResponse.body.data.id}/generate`)
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({ generate_count: 2 })
          .expect(201);

        expect(generateResponse.body.data.variants).toHaveLength(2);
        expect(generateResponse.body.data.auto_approved).toBe(true);
        expect(generateResponse.body.data.published).toBe(true);
      });
    });

    describe('Auto-approve OFF', () => {
      test('should process intermediate comment requiring manual approval', async () => {
        const intermediateComment = fixtures.comments.intermediate;
        
        // Configure manual approval for this org
        await request(app)
          .patch('/api/organizations/settings')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({ auto_approve: false })
          .expect(200);

        // Step 1: Ingest comment
        const ingestResponse = await request(app)
          .post('/api/comments/ingest')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({
            platform: 'twitter',
            external_comment_id: `${intermediateComment.external_id}_manual`,
            comment_text: intermediateComment.text,
            author_id: intermediateComment.author.id,
            author_username: intermediateComment.author.username,
            org_id: testOrg.id
          })
          .expect(201);

        // Step 2: Decision should be "roast_manual"
        const decisionResponse = await request(app)
          .get(`/api/comments/${ingestResponse.body.data.id}/decision`)
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .expect(200);

        expect(decisionResponse.body.data.decision).toBe('roast_manual');

        // Step 3: Generate 2 variants for manual selection
        const generateResponse = await request(app)
          .post(`/api/comments/${ingestResponse.body.data.id}/generate`)
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({ generate_count: 2, mode: 'manual' })
          .expect(201);

        expect(generateResponse.body.data.variants).toHaveLength(2);
        expect(generateResponse.body.data.auto_approved).toBe(false);
        expect(generateResponse.body.data.published).toBe(false);

        // Step 4: Manual selection and generation of 1 additional variant
        const selectResponse = await request(app)
          .post(`/api/comments/${ingestResponse.body.data.id}/select-variant`)
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({ variant_index: 0 })
          .expect(200);

        // Step 5: Generate 1 additional variant after selection
        const additionalResponse = await request(app)
          .post(`/api/comments/${ingestResponse.body.data.id}/generate-additional`)
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .expect(201);

        expect(additionalResponse.body.data.variants).toHaveLength(1);

        // Step 6: Manual approval and publishing
        const approveResponse = await request(app)
          .post(`/api/comments/${ingestResponse.body.data.id}/approve`)
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({ variant_index: 0 })
          .expect(200);

        expect(approveResponse.body.data.published).toBe(true);
      });
    });
  });

  describe('Scenario 3: Critical Comment → Shield Critical Actions', () => {
    test('should trigger Shield actions for critical toxicity', async () => {
      const criticalComment = fixtures.comments.critical;
      
      // Step 1: Ingest critical comment
      const ingestResponse = await request(app)
        .post('/api/comments/ingest')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          platform: 'twitter',
          external_comment_id: criticalComment.external_id,
          comment_text: criticalComment.text,
          author_id: criticalComment.author.id,
          author_username: criticalComment.author.username,
          org_id: testOrg.id
        })
        .expect(201);

      // Step 2: Analysis should classify as critical
      const analysisResponse = await request(app)
        .get(`/api/comments/${ingestResponse.body.data.id}/analysis`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(analysisResponse.body.data.toxicity_score).toBeGreaterThan(0.85);
      expect(analysisResponse.body.data.classification).toBe('critical');

      // Step 3: Decision should trigger Shield
      const decisionResponse = await request(app)
        .get(`/api/comments/${ingestResponse.body.data.id}/decision`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(decisionResponse.body.data.decision).toBe('shield_critical');
      expect(decisionResponse.body.data.shield_action).toMatchObject({
        action: expect.stringMatching(/hide_comment|block_user|report_user/),
        priority: 1,
        reason: expect.stringContaining('critical toxicity')
      });

      // Step 4: Verify Shield action was logged (not executed in dryRun)
      const shieldLogResponse = await request(app)
        .get(`/api/shield/actions?comment_id=${ingestResponse.body.data.id}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(shieldLogResponse.body.data).toHaveLength(1);
      expect(shieldLogResponse.body.data[0]).toMatchObject({
        action_type: expect.stringMatching(/hide_comment|block_user|report_user/),
        status: 'dry_run_completed',
        author_id: criticalComment.author.id,
        reason: expect.stringContaining('critical'),
        dry_run: true
      });

      // Step 5: Verify no roast response was generated
      const responseResponse = await request(app)
        .get(`/api/comments/${ingestResponse.body.data.id}/responses`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(responseResponse.body.data.variants).toHaveLength(0);
    });
  });

  describe('Scenario 4: Corrective Zone → Strike System', () => {
    test('should handle corrective response and escalation for repeat offender', async () => {
      const correctiveComment = fixtures.comments.corrective;
      
      // Step 1: First offense - should get corrective response
      const firstIngestResponse = await request(app)
        .post('/api/comments/ingest')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          platform: 'twitter',
          external_comment_id: `${correctiveComment.external_id}_first`,
          comment_text: correctiveComment.text,
          author_id: correctiveComment.author.id,
          author_username: correctiveComment.author.username,
          org_id: testOrg.id
        })
        .expect(201);

      // Step 2: Decision should be corrective
      const firstDecisionResponse = await request(app)
        .get(`/api/comments/${firstIngestResponse.body.data.id}/decision`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(firstDecisionResponse.body.data.decision).toBe('corrective_zone');
      expect(firstDecisionResponse.body.data.strike_count).toBe(1);

      // Step 3: Generate corrective response
      const correctiveResponse = await request(app)
        .post(`/api/comments/${firstIngestResponse.body.data.id}/generate`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({ response_type: 'corrective' })
        .expect(201);

      expect(correctiveResponse.body.data.response_type).toBe('corrective');
      expect(correctiveResponse.body.data.tone).toBe('educational');

      // Step 4: Repeat offense - should escalate
      const secondIngestResponse = await request(app)
        .post('/api/comments/ingest')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          platform: 'twitter',
          external_comment_id: `${correctiveComment.external_id}_repeat`,
          comment_text: correctiveComment.text,
          author_id: correctiveComment.author.id, // Same author
          author_username: correctiveComment.author.username,
          org_id: testOrg.id
        })
        .expect(201);

      // Step 5: Decision should escalate
      const secondDecisionResponse = await request(app)
        .get(`/api/comments/${secondIngestResponse.body.data.id}/decision`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(secondDecisionResponse.body.data.decision).toBe('escalated_reincidence');
      expect(secondDecisionResponse.body.data.strike_count).toBe(2);
      expect(secondDecisionResponse.body.data.shield_action).toBeDefined();

      // Step 6: Verify escalation was logged
      const escalationLogResponse = await request(app)
        .get(`/api/users/${correctiveComment.author.id}/violations`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(escalationLogResponse.body.data).toHaveLength(2);
      expect(escalationLogResponse.body.data[1].escalated).toBe(true);
    });
  });

  describe('Scenario 5: Inline Editor → Style Validator', () => {
    test('should validate and process inline editor content', async () => {
      // Step 1: Valid content should pass validation
      const validContent = fixtures.responses.validRoast;
      
      const validateValidResponse = await request(app)
        .post('/api/editor/validate')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          content: validContent.text,
          platform: 'twitter',
          target_comment_id: fixtures.comments.intermediate.external_id
        })
        .expect(200);

      expect(validateValidResponse.body.data.valid).toBe(true);
      expect(validateValidResponse.body.data.violations).toHaveLength(0);

      // Step 2: Invalid content should be blocked
      const invalidContent = fixtures.responses.invalidRoast;
      
      const validateInvalidResponse = await request(app)
        .post('/api/editor/validate')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          content: invalidContent.text,
          platform: 'twitter',
          target_comment_id: fixtures.comments.intermediate.external_id
        })
        .expect(400);

      expect(validateInvalidResponse.body.data.valid).toBe(false);
      expect(validateInvalidResponse.body.data.violations).toContain(invalidContent.violation);

      // Step 3: Valid content should consume credits and publish
      const publishResponse = await request(app)
        .post('/api/editor/publish')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          content: validContent.text,
          platform: 'twitter',
          target_comment_id: fixtures.comments.intermediate.external_id
        })
        .expect(201);

      expect(publishResponse.body.data.published).toBe(true);
      expect(publishResponse.body.data.credits_consumed).toBeGreaterThan(0);

      // Step 4: Verify credits were deducted
      const creditsResponse = await request(app)
        .get('/api/user/credits')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(creditsResponse.body.data.credits_used).toBeGreaterThan(0);
    });
  });

  describe('Cross-Scenario Integration', () => {
    test('should maintain consistent state across multiple comment processing', async () => {
      const batchComments = [
        fixtures.comments.light,
        fixtures.comments.intermediate,
        fixtures.comments.critical
      ];

      const results = [];

      // Process all comments
      for (const comment of batchComments) {
        const ingestResponse = await request(app)
          .post('/api/comments/ingest')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({
            platform: 'twitter',
            external_comment_id: `batch_${comment.external_id}`,
            comment_text: comment.text,
            author_id: comment.author.id,
            author_username: comment.author.username,
            org_id: testOrg.id
          })
          .expect(201);

        results.push(ingestResponse.body.data);
      }

      // Verify consistent processing
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.org_id).toBe(testOrg.id);
        expect(result.status).toBe('ingested');
      });

      // Verify system state consistency
      const systemStatusResponse = await request(app)
        .get('/api/system/status')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(systemStatusResponse.body.data.comments_processed).toBeGreaterThanOrEqual(3);
      expect(systemStatusResponse.body.data.queue_status).toBe('healthy');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle service failures gracefully', async () => {
      // Simulate OpenAI service failure
      const mockOpenAI = require('../../src/services/openai');
      mockOpenAI.generateResponse.mockRejectedValueOnce(new Error('OpenAI service unavailable'));

      const comment = fixtures.comments.intermediate;
      
      const ingestResponse = await request(app)
        .post('/api/comments/ingest')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          platform: 'twitter',
          external_comment_id: `error_${comment.external_id}`,
          comment_text: comment.text,
          author_id: comment.author.id,
          author_username: comment.author.username,
          org_id: testOrg.id
        })
        .expect(201);

      // Generation should fail gracefully
      const generateResponse = await request(app)
        .post(`/api/comments/${ingestResponse.body.data.id}/generate`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(503);

      expect(generateResponse.body.error).toContain('service unavailable');
      
      // Should be queued for retry
      const retryStatusResponse = await request(app)
        .get(`/api/comments/${ingestResponse.body.data.id}/retry-status`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(retryStatusResponse.body.data.retry_count).toBeGreaterThan(0);
    });
  });

  describe('Performance and Load', () => {
    test('should handle concurrent comment processing efficiently', async () => {
      const concurrentComments = Array(10).fill(0).map((_, index) => ({
        ...fixtures.comments.light,
        external_id: `concurrent_${index}`,
        text: `Synthetic test comment ${index}`
      }));

      const startTime = Date.now();

      // Process all comments concurrently
      const promises = concurrentComments.map(comment =>
        request(app)
          .post('/api/comments/ingest')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({
            platform: 'twitter',
            external_comment_id: comment.external_id,
            comment_text: comment.text,
            author_id: comment.author.id,
            author_username: comment.author.username,
            org_id: testOrg.id
          })
      );

      const results = await Promise.all(promises);
      const processingTime = Date.now() - startTime;

      // Verify all succeeded
      results.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify reasonable performance (under 5 seconds for 10 comments)
      expect(processingTime).toBeLessThan(5000);

      console.log(`✅ Processed ${concurrentComments.length} comments in ${processingTime}ms`);
    });
  });
});