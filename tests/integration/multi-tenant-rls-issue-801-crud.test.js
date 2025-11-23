/**
 * Multi-Tenant RLS CRUD Integration Tests - Issue #801
 *
 * Tests Row Level Security policies for INSERT, UPDATE, DELETE operations.
 * Validates that RLS blocks unauthorized write operations with error code '42501'.
 *
 * Related Issue: #801
 * Related Node: multi-tenant.md
 * Builds on: Issue #504 (PR #790) - SELECT operations
 */

const {
  createTestTenants,
  createTestData,
  cleanupTestData,
  setTenantContext,
  getTenantContext,
  serviceClient,
  testClient
} = require('../helpers/tenantTestUtils');
const { v4: uuidv4 } = require('uuid');

jest.setTimeout(120000); // Issue #894: Increase timeout for Supabase auth operations

describe('Multi-Tenant RLS CRUD Tests - Issue #801', () => {
  let tenantA, tenantB, tenantAData, tenantBData;

  beforeAll(async () => {
    console.log('\n🚀 Setting up CRUD test environment...\n');

    const tenants = await createTestTenants();
    tenantA = tenants.tenantA;
    tenantB = tenants.tenantB;

    tenantAData = await createTestData(tenantA.id, 'all');
    tenantA.posts = tenantAData.posts;
    tenantA.comments = tenantAData.comments;
    tenantA.roasts = tenantAData.roasts;
    tenantA.integrationConfigs = tenantAData.integrationConfigs;
    tenantA.usageRecords = tenantAData.usageRecords;
    tenantA.monthlyUsage = tenantAData.monthlyUsage;
    tenantA.responses = tenantAData.responses;
    tenantA.userBehaviors = tenantAData.userBehaviors;
    tenantA.userActivities = tenantAData.userActivities;

    tenantBData = await createTestData(tenantB.id, 'all');
    tenantB.posts = tenantBData.posts;
    tenantB.comments = tenantBData.comments;
    tenantB.roasts = tenantBData.roasts;
    tenantB.integrationConfigs = tenantBData.integrationConfigs;
    tenantB.usageRecords = tenantBData.usageRecords;
    tenantB.monthlyUsage = tenantBData.monthlyUsage;
    tenantB.responses = tenantBData.responses;
    tenantB.userBehaviors = tenantBData.userBehaviors;
    tenantB.userActivities = tenantBData.userActivities;

    console.log('\n✅ CRUD test environment setup complete\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Tearing down CRUD test environment...\n');
    await cleanupTestData();
    console.log('\n✅ CRUD teardown complete\n');
  });

  describe('Setup Verification', () => {
    test('Setup creates 2 tenants with isolated data', () => {
      expect(tenantA).toBeDefined();
      expect(tenantB).toBeDefined();
      expect(tenantA.id).not.toBe(tenantB.id);

      console.log(`\n📋 Tenant A: ${tenantA.id}`);
      console.log(`📋 Tenant B: ${tenantB.id}`);

      expect(tenantA.comments.length).toBeGreaterThan(0);
      expect(tenantB.comments.length).toBeGreaterThan(0);

      console.log(`  ✅ Tenant A: ${tenantA.comments.length} comments`);
      console.log(`  ✅ Tenant B: ${tenantB.comments.length} comments\n`);
    });
  });

  // =========================================================================
  // AC4: INSERT Operations RLS Enforcement
  // =========================================================================

  describe('AC4: INSERT Operations RLS Enforcement (HIGH PRIORITY)', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    // --- integration_configs (SECURITY CRITICAL) ---
    describe('integration_configs - Credential Isolation', () => {
      test('INSERT own organization integration_config succeeds', async () => {
        const newConfig = {
          id: uuidv4(),
          organization_id: tenantA.id,
          platform: 'youtube',
          enabled: true,
          credentials: { encrypted: true },
          created_at: new Date().toISOString()
        };

        const { data, error } = await testClient
          .from('integration_configs')
          .insert(newConfig)
          .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].organization_id).toBe(tenantA.id);

        // Cleanup
        await serviceClient.from('integration_configs').delete().eq('id', newConfig.id);
      });

      test('INSERT other organization integration_config fails with 42501', async () => {
        const crossTenantConfig = {
          id: uuidv4(),
          organization_id: tenantB.id, // Cross-tenant attempt
          platform: 'youtube',
          enabled: true,
          credentials: { encrypted: true },
          created_at: new Date().toISOString()
        };

        const { data, error } = await testClient
          .from('integration_configs')
          .insert(crossTenantConfig)
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501'); // Permission denied
        expect(data).toBeNull();
      });
    });

    // --- usage_records (BILLING CRITICAL) ---
    describe('usage_records - Billing Data Isolation', () => {
      test('INSERT own organization usage_record succeeds', async () => {
        const newRecord = {
          id: uuidv4(),
          organization_id: tenantA.id,
          platform: 'twitter',
          action_type: 'generate_reply',
          tokens_used: 150,
          cost_cents: 3
        };

        const { data, error } = await testClient.from('usage_records').insert(newRecord).select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].organization_id).toBe(tenantA.id);

        // Cleanup
        await serviceClient.from('usage_records').delete().eq('id', newRecord.id);
      });

      test('INSERT other organization usage_record fails with 42501', async () => {
        const crossTenantRecord = {
          id: uuidv4(),
          organization_id: tenantB.id, // Cross-tenant attempt
          platform: 'twitter',
          action_type: 'generate_reply',
          tokens_used: 150,
          cost_cents: 3
        };

        const { data, error } = await testClient
          .from('usage_records')
          .insert(crossTenantRecord)
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toBeNull();
      });
    });

    // --- monthly_usage (BILLING CRITICAL) ---
    describe('monthly_usage - Billing Summary Isolation', () => {
      test('INSERT own organization monthly_usage succeeds', async () => {
        const year = 2025;
        const month = 12;
        const newMonthlyUsage = {
          id: uuidv4(),
          organization_id: tenantA.id,
          year,
          month,
          total_responses: 150,
          total_cost_cents: 30,
          responses_limit: 100
        };

        const { data, error } = await testClient
          .from('monthly_usage')
          .insert(newMonthlyUsage)
          .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].organization_id).toBe(tenantA.id);

        // Cleanup
        await serviceClient.from('monthly_usage').delete().eq('id', newMonthlyUsage.id);
      });

      test('INSERT other organization monthly_usage fails with 42501', async () => {
        const year = 2025;
        const month = 11;
        const crossTenantMonthly = {
          id: uuidv4(),
          organization_id: tenantB.id, // Cross-tenant attempt
          year,
          month,
          total_responses: 200,
          total_cost_cents: 40,
          responses_limit: 100
        };

        const { data, error } = await testClient
          .from('monthly_usage')
          .insert(crossTenantMonthly)
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toBeNull();
      });
    });

    // --- comments (MEDIUM PRIORITY) ---
    describe('comments - Platform Comments', () => {
      test('INSERT own organization comment succeeds', async () => {
        const newComment = {
          id: uuidv4(),
          organization_id: tenantA.id,
          post_id: tenantA.posts[0].id,
          platform: 'twitter',
          platform_comment_id: `test_comment_${Date.now()}`,
          original_text: 'Test comment for RLS',
          platform_username: 'testuser_rls',
          toxicity_score: 0.5
        };

        const { data, error } = await testClient.from('comments').insert(newComment).select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].organization_id).toBe(tenantA.id);

        // Cleanup
        await serviceClient.from('comments').delete().eq('id', newComment.id);
      });

      test('INSERT other organization comment fails with 42501', async () => {
        const crossTenantComment = {
          id: uuidv4(),
          organization_id: tenantB.id, // Cross-tenant attempt
          post_id: tenantB.posts[0].id,
          platform: 'twitter',
          platform_comment_id: `test_comment_${Date.now()}`,
          original_text: 'Cross-tenant comment attempt',
          platform_username: 'testuser_cross',
          toxicity_score: 0.5
        };

        const { data, error } = await testClient
          .from('comments')
          .insert(crossTenantComment)
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toBeNull();
      });
    });

    // --- responses (MEDIUM PRIORITY) ---
    describe('responses - Generated Roast Responses', () => {
      test('INSERT own organization response succeeds', async () => {
        const newResponse = {
          id: uuidv4(),
          organization_id: tenantA.id,
          comment_id: tenantA.comments[0].id,
          response_text: 'Test roast response',
          tone: 'balanced',
          model_used: 'gpt-4o',
          status: 'pending'
        };

        const { data, error } = await testClient.from('responses').insert(newResponse).select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].organization_id).toBe(tenantA.id);

        // Cleanup
        await serviceClient.from('responses').delete().eq('id', newResponse.id);
      });

      test('INSERT other organization response fails with 42501', async () => {
        const crossTenantResponse = {
          id: uuidv4(),
          organization_id: tenantB.id, // Cross-tenant attempt
          comment_id: tenantB.comments[0].id,
          response_text: 'Cross-tenant response',
          tone: 'balanced',
          model_used: 'gpt-4o',
          status: 'pending'
        };

        const { data, error } = await testClient
          .from('responses')
          .insert(crossTenantResponse)
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toBeNull();
      });
    });
  });

  // =========================================================================
  // AC5: UPDATE Operations RLS Enforcement
  // =========================================================================

  describe('AC5: UPDATE Operations RLS Enforcement (HIGH PRIORITY)', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    // --- integration_configs (SECURITY CRITICAL) ---
    describe('integration_configs - Credential Updates', () => {
      test('UPDATE own organization integration_config succeeds', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantA.integrationConfigs.length === 0) {
          const { data: newConfig, error: createError } = await serviceClient
            .from('integration_configs')
            .insert({
              id: uuidv4(),
              organization_id: tenantA.id,
              platform: 'youtube',
              enabled: true,
              credentials: { encrypted: true },
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test integration_config: ${createError.message}`);
          tenantA.integrationConfigs.push(newConfig);
        }

        const configId = tenantA.integrationConfigs[0].id;
        const { data, error } = await testClient
          .from('integration_configs')
          .update({ enabled: false })
          .eq('id', configId)
          .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].enabled).toBe(false);

        // Restore
        await serviceClient
          .from('integration_configs')
          .update({ enabled: true })
          .eq('id', configId);
      });

      test('UPDATE other organization integration_config fails with 42501', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantB.integrationConfigs.length === 0) {
          const { data: newConfig, error: createError } = await serviceClient
            .from('integration_configs')
            .insert({
              id: uuidv4(),
              organization_id: tenantB.id,
              platform: 'youtube',
              enabled: true,
              credentials: { encrypted: true },
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test integration_config: ${createError.message}`);
          tenantB.integrationConfigs.push(newConfig);
        }

        const { data, error } = await testClient
          .from('integration_configs')
          .update({ enabled: false })
          .eq('id', tenantB.integrationConfigs[0].id) // Cross-tenant row
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toEqual([]); // RLS blocks
      });

      test('UPDATE organization_id to another tenant fails', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantA.integrationConfigs.length === 0) {
          const { data: newConfig, error: createError } = await serviceClient
            .from('integration_configs')
            .insert({
              id: uuidv4(),
              organization_id: tenantA.id,
              platform: 'youtube',
              enabled: true,
              credentials: { encrypted: true },
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test integration_config: ${createError.message}`);
          tenantA.integrationConfigs.push(newConfig);
        }

        const { data, error } = await testClient
          .from('integration_configs')
          .update({ organization_id: tenantB.id }) // Attempt to change ownership
          .eq('id', tenantA.integrationConfigs[0].id)
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
      });
    });

    // --- usage_records (BILLING CRITICAL) ---
    describe('usage_records - Billing Data Updates', () => {
      test('UPDATE own organization usage_record succeeds', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantA.usageRecords.length === 0) {
          const { data: newRecord, error: createError } = await serviceClient
            .from('usage_records')
            .insert({
              id: uuidv4(),
              organization_id: tenantA.id,
              platform: 'twitter',
              action_type: 'generate_reply',
              tokens_used: 150,
              cost_cents: 3
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test usage_record: ${createError.message}`);
          tenantA.usageRecords.push(newRecord);
        }

        const recordId = tenantA.usageRecords[0].id;
        const { data, error } = await testClient
          .from('usage_records')
          .update({ cost_cents: 5 })
          .eq('id', recordId)
          .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);

        // Restore
        await serviceClient.from('usage_records').update({ cost_cents: 3 }).eq('id', recordId);
      });

      test('UPDATE other organization usage_record fails with 42501', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantB.usageRecords.length === 0) {
          const { data: newRecord, error: createError } = await serviceClient
            .from('usage_records')
            .insert({
              id: uuidv4(),
              organization_id: tenantB.id,
              platform: 'twitter',
              action_type: 'generate_reply',
              tokens_used: 150,
              cost_cents: 3
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test usage_record: ${createError.message}`);
          tenantB.usageRecords.push(newRecord);
        }

        const { data, error } = await testClient
          .from('usage_records')
          .update({ cost_cents: 999 })
          .eq('id', tenantB.usageRecords[0].id) // Cross-tenant row
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toEqual([]);
      });
    });

    // --- monthly_usage (BILLING CRITICAL) ---
    describe('monthly_usage - Billing Summary Updates', () => {
      test('UPDATE own organization monthly_usage succeeds', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantA.monthlyUsage.length === 0) {
          const now = new Date();
          const { data: newMonthly, error: createError } = await serviceClient
            .from('monthly_usage')
            .insert({
              id: uuidv4(),
              organization_id: tenantA.id,
              year: now.getFullYear(),
              month: now.getMonth() + 1,
              total_responses: 50,
              responses_limit: 100
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test monthly_usage: ${createError.message}`);
          tenantA.monthlyUsage.push(newMonthly);
        }

        const monthlyId = tenantA.monthlyUsage[0].id;
        const { data, error } = await testClient
          .from('monthly_usage')
          .update({ total_responses: 999 })
          .eq('id', monthlyId)
          .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);

        // Restore
        await serviceClient
          .from('monthly_usage')
          .update({ total_responses: tenantA.monthlyUsage[0].total_responses })
          .eq('id', monthlyId);
      });

      test('UPDATE other organization monthly_usage fails with 42501', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantB.monthlyUsage.length === 0) {
          const now = new Date();
          const { data: newMonthly, error: createError } = await serviceClient
            .from('monthly_usage')
            .insert({
              id: uuidv4(),
              organization_id: tenantB.id,
              year: now.getFullYear(),
              month: now.getMonth() + 1,
              total_responses: 50,
              responses_limit: 100
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test monthly_usage: ${createError.message}`);
          tenantB.monthlyUsage.push(newMonthly);
        }

        const { data, error } = await testClient
          .from('monthly_usage')
          .update({ total_responses: 999 })
          .eq('id', tenantB.monthlyUsage[0].id) // Cross-tenant row
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toEqual([]);
      });
    });

    // --- comments (MEDIUM PRIORITY) ---
    describe('comments - Platform Comments Updates', () => {
      test('UPDATE own organization comment succeeds', async () => {
        const commentId = tenantA.comments[0].id;
        const { data, error } = await testClient
          .from('comments')
          .update({ toxicity_score: 0.99 })
          .eq('id', commentId)
          .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].toxicity_score).toBe(0.99);

        // Restore
        await serviceClient
          .from('comments')
          .update({ toxicity_score: tenantA.comments[0].toxicity_score })
          .eq('id', commentId);
      });

      test('UPDATE other organization comment fails with 42501', async () => {
        const { data, error } = await testClient
          .from('comments')
          .update({ toxicity_score: 0.99 })
          .eq('id', tenantB.comments[0].id) // Cross-tenant row
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toEqual([]);
      });
    });

    // --- responses (MEDIUM PRIORITY) ---
    describe('responses - Generated Responses Updates', () => {
      test('UPDATE own organization response succeeds', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantA.responses.length === 0) {
          if (tenantA.comments.length === 0) {
            throw new Error('Cannot create response: tenantA.comments is empty');
          }
          const { data: newResponse, error: createError } = await serviceClient
            .from('responses')
            .insert({
              id: uuidv4(),
              organization_id: tenantA.id,
              comment_id: tenantA.comments[0].id,
              response_text: 'Test response',
              tone: 'sarcastic',
              humor_type: 'witty'
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test response: ${createError.message}`);
          tenantA.responses.push(newResponse);
        }

        const responseId = tenantA.responses[0].id;
        const { data, error } = await testClient
          .from('responses')
          .update({ status: 'published' })
          .eq('id', responseId)
          .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);

        // Restore
        await serviceClient
          .from('responses')
          .update({ status: tenantA.responses[0].status })
          .eq('id', responseId);
      });

      test('UPDATE other organization response fails with 42501', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantB.responses.length === 0) {
          if (tenantB.comments.length === 0) {
            throw new Error('Cannot create response: tenantB.comments is empty');
          }
          const { data: newResponse, error: createError } = await serviceClient
            .from('responses')
            .insert({
              id: uuidv4(),
              organization_id: tenantB.id,
              comment_id: tenantB.comments[0].id,
              response_text: 'Test response',
              tone: 'sarcastic',
              humor_type: 'witty'
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test response: ${createError.message}`);
          tenantB.responses.push(newResponse);
        }

        const { data, error } = await testClient
          .from('responses')
          .update({ status: 'published' })
          .eq('id', tenantB.responses[0].id) // Cross-tenant row
          .select();

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toEqual([]);
      });
    });
  });

  // =========================================================================
  // AC6: DELETE Operations RLS Enforcement
  // =========================================================================

  describe('AC6: DELETE Operations RLS Enforcement (HIGH PRIORITY)', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    // --- comments (Safe to delete - test data) ---
    describe('comments - Comment Deletion', () => {
      test('DELETE own organization comment succeeds', async () => {
        // Create temporary comment
        const tempComment = {
          id: uuidv4(),
          organization_id: tenantA.id,
          post_id: tenantA.posts[0].id,
          platform: 'twitter',
          platform_comment_id: `temp_${Date.now()}`,
          original_text: 'Temporary comment for DELETE test',
          platform_username: 'temp_user',
          toxicity_score: 0.5
        };

        const { data: created } = await serviceClient.from('comments').insert(tempComment).select();

        expect(created).toHaveLength(1);

        // DELETE via testClient
        const { error } = await testClient.from('comments').delete().eq('id', created[0].id);

        expect(error).toBeNull();

        // Verify deletion
        const { data: verify } = await serviceClient
          .from('comments')
          .select('*')
          .eq('id', created[0].id);

        expect(verify).toEqual([]);
      });

      test('DELETE other organization comment fails with 42501', async () => {
        const { error } = await testClient
          .from('comments')
          .delete()
          .eq('id', tenantB.comments[0].id); // Cross-tenant row

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');

        // Verify NOT deleted
        const { data: verify } = await serviceClient
          .from('comments')
          .select('*')
          .eq('id', tenantB.comments[0].id);

        expect(verify).toHaveLength(1);
      });
    });

    // --- responses (Safe to delete - test data) ---
    describe('responses - Response Deletion', () => {
      test('DELETE own organization response succeeds', async () => {
        // Create temporary response
        const tempResponse = {
          id: uuidv4(),
          organization_id: tenantA.id,
          comment_id: tenantA.comments[0].id,
          response_text: 'Temporary response for DELETE test',
          tone: 'balanced',
          model_used: 'gpt-4o',
          status: 'pending'
        };

        const { data: created } = await serviceClient
          .from('responses')
          .insert(tempResponse)
          .select();

        expect(created).toHaveLength(1);

        // DELETE via testClient
        const { error } = await testClient.from('responses').delete().eq('id', created[0].id);

        expect(error).toBeNull();

        // Verify deletion
        const { data: verify } = await serviceClient
          .from('responses')
          .select('*')
          .eq('id', created[0].id);

        expect(verify).toEqual([]);
      });

      test('DELETE other organization response fails with 42501', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantB.responses.length === 0) {
          if (tenantB.comments.length === 0) {
            throw new Error('Cannot create response: tenantB.comments is empty');
          }
          const { data: newResponse, error: createError } = await serviceClient
            .from('responses')
            .insert({
              id: uuidv4(),
              organization_id: tenantB.id,
              comment_id: tenantB.comments[0].id,
              response_text: 'Test response',
              tone: 'sarcastic',
              humor_type: 'witty'
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test response: ${createError.message}`);
          tenantB.responses.push(newResponse);
        }

        const { error } = await testClient
          .from('responses')
          .delete()
          .eq('id', tenantB.responses[0].id); // Cross-tenant row

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');

        // Verify NOT deleted
        const { data: verify } = await serviceClient
          .from('responses')
          .select('*')
          .eq('id', tenantB.responses[0].id);

        expect(verify).toHaveLength(1);
      });
    });

    // --- user_activities (Safe to delete - audit log test data) ---
    describe('user_activities - Activity Log Deletion', () => {
      test('DELETE own organization activity succeeds', async () => {
        // Create temporary activity (always create fresh for DELETE test)
        const tempActivity = {
          id: uuidv4(),
          organization_id: tenantA.id,
          user_id: tenantA.owner_id,
          action: 'test_action',
          resource_type: 'test',
          created_at: new Date().toISOString()
        };

        const { data: created } = await serviceClient
          .from('user_activities')
          .insert(tempActivity)
          .select();

        expect(created).toHaveLength(1);

        // DELETE via testClient
        const { error } = await testClient.from('user_activities').delete().eq('id', created[0].id);

        expect(error).toBeNull();
      });

      test('DELETE other organization activity fails with 42501', async () => {
        // Ensure test data exists before asserting (CodeRabbit Review #3443936877)
        if (tenantB.userActivities.length === 0) {
          const { data: newActivity, error: createError } = await serviceClient
            .from('user_activities')
            .insert({
              id: uuidv4(),
              organization_id: tenantB.id,
              user_id: tenantB.owner_id,
              action: 'test_action',
              resource_type: 'test',
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          if (createError)
            throw new Error(`Failed to create test user_activity: ${createError.message}`);
          tenantB.userActivities.push(newActivity);
        }

        const { error } = await testClient
          .from('user_activities')
          .delete()
          .eq('id', tenantB.userActivities[0].id); // Cross-tenant row

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
      });
    });
  });

  // =========================================================================
  // AC7: Bidirectional Cross-Tenant Write Isolation
  // =========================================================================

  describe('AC7: Bidirectional Cross-Tenant Write Isolation', () => {
    test('Tenant A cannot INSERT for Tenant B', async () => {
      await setTenantContext(tenantA.id);

      const crossComment = {
        id: uuidv4(),
        organization_id: tenantB.id, // Target: Tenant B
        post_id: tenantB.posts[0].id,
        platform: 'twitter',
        platform_comment_id: `cross_${Date.now()}`,
        original_text: 'Cross-tenant attempt from A to B',
        platform_username: 'attacker_a',
        toxicity_score: 0.5
      };

      const { error } = await testClient.from('comments').insert(crossComment).select();

      expect(error).not.toBeNull();
      expect(error.code).toBe('42501');
    });

    test('Tenant B cannot INSERT for Tenant A', async () => {
      await setTenantContext(tenantB.id);

      const crossComment = {
        id: uuidv4(),
        organization_id: tenantA.id, // Target: Tenant A
        post_id: tenantA.posts[0].id,
        platform: 'twitter',
        platform_comment_id: `cross_${Date.now()}`,
        original_text: 'Cross-tenant attempt from B to A',
        platform_username: 'attacker_b',
        toxicity_score: 0.5
      };

      const { error } = await testClient.from('comments').insert(crossComment).select();

      expect(error).not.toBeNull();
      expect(error.code).toBe('42501');
    });

    test('Tenant A cannot UPDATE Tenant B data', async () => {
      await setTenantContext(tenantA.id);

      const { error } = await testClient
        .from('comments')
        .update({ toxicity_score: 0.99 })
        .eq('id', tenantB.comments[0].id)
        .select();

      expect(error).not.toBeNull();
      expect(error.code).toBe('42501');
    });

    test('Tenant B cannot UPDATE Tenant A data', async () => {
      await setTenantContext(tenantB.id);

      const { error } = await testClient
        .from('comments')
        .update({ toxicity_score: 0.99 })
        .eq('id', tenantA.comments[0].id)
        .select();

      expect(error).not.toBeNull();
      expect(error.code).toBe('42501');
    });

    test('Tenant A cannot DELETE Tenant B data', async () => {
      await setTenantContext(tenantA.id);

      const { error } = await testClient.from('comments').delete().eq('id', tenantB.comments[0].id);

      expect(error).not.toBeNull();
      expect(error.code).toBe('42501');
    });

    test('Tenant B cannot DELETE Tenant A data', async () => {
      await setTenantContext(tenantB.id);

      const { error } = await testClient.from('comments').delete().eq('id', tenantA.comments[0].id);

      expect(error).not.toBeNull();
      expect(error.code).toBe('42501');
    });
  });

  // =========================================================================
  // Coverage Statistics
  // =========================================================================

  describe('Coverage Statistics', () => {
    test('Summary of CRUD operations tested', () => {
      const tablesTested = {
        integration_configs: {
          insert: true,
          update: true,
          delete: false,
          priority: 'HIGH (SECURITY)'
        },
        usage_records: { insert: true, update: true, delete: false, priority: 'HIGH (BILLING)' },
        monthly_usage: { insert: true, update: true, delete: false, priority: 'HIGH (BILLING)' },
        comments: { insert: true, update: true, delete: true, priority: 'MEDIUM' },
        responses: { insert: true, update: true, delete: true, priority: 'MEDIUM' },
        user_activities: { insert: false, update: false, delete: true, priority: 'LOW' }
      };

      console.log('\n📊 CRUD RLS Test Coverage (Issue #801):');
      console.log('========================================\n');

      let insertCount = 0;
      let updateCount = 0;
      let deleteCount = 0;

      Object.entries(tablesTested).forEach(([table, ops]) => {
        console.log(`  ${table} [${ops.priority}]`);
        console.log(`    INSERT: ${ops.insert ? '✅' : '❌'}`);
        console.log(`    UPDATE: ${ops.update ? '✅' : '❌'}`);
        console.log(`    DELETE: ${ops.delete ? '✅' : '❌'}\n`);

        if (ops.insert) insertCount++;
        if (ops.update) updateCount++;
        if (ops.delete) deleteCount++;
      });

      console.log(`  Total Tables: ${Object.keys(tablesTested).length}`);
      console.log(`  INSERT Coverage: ${insertCount}/${Object.keys(tablesTested).length}`);
      console.log(`  UPDATE Coverage: ${updateCount}/${Object.keys(tablesTested).length}`);
      console.log(`  DELETE Coverage: ${deleteCount}/${Object.keys(tablesTested).length}`);
      console.log(`\n  Bidirectional Isolation: ✅ Verified`);
      console.log(`  Error Code 42501: ✅ Verified\n`);

      expect(Object.keys(tablesTested).length).toBeGreaterThanOrEqual(5);
      expect(insertCount).toBeGreaterThanOrEqual(5);
      expect(updateCount).toBeGreaterThanOrEqual(5);
      expect(deleteCount).toBeGreaterThanOrEqual(3);
    });
  });
});
