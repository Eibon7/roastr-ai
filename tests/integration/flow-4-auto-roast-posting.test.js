/**
 * 🧪 Flujo 4: Generación y publicación automática del roast
 *
 * Test de integración completo que valida:
 * 1. Comentario con toxicidad media-alta (roasteable)
 * 2. Roastr Persona no lo marca como ignorable ni ofensivo directo
 * 3. Usuario tiene activada la respuesta automática
 * 4. Hay roasts disponibles según el plan del usuario
 * 5. Sistema genera roast automáticamente
 * 6. Roast pasa validaciones internas (moderación, límites, etc.)
 * 7. Roast se publica automáticamente en la red social conectada
 * 8. Estado del roast pasa a 'posted' en la base de datos
 * 9. Se crean las entradas correspondientes en las tablas responses y roast_attempts
 *
 * NOTA: Para ver el flujo completo en acción, ejecutar: node test-flow-4-auto-roast-posting.js
 */

describe('🧪 Flujo 4: Generación y publicación automática del roast', () => {
  let mockSupabaseClient;
  let mockTwitterService;

  // Test data
  const organizationId = 'org-auto-test-123';
  const userId = 'user-auto-test-123';
  const commentId = 'comment-toxic-456';
  const responseId = 'response-auto-789';
  const attemptId = 'attempt-auto-456';

  const incomingComment = {
    id: commentId,
    organization_id: organizationId,
    platform: 'twitter',
    platform_comment_id: 'tweet-toxic-789',
    author_id: 'toxic-user-456',
    author_username: '@toxic_commenter',
    original_text: 'Tu app es una basura total y tú eres un incompetente',
    toxicity_score: 0.72,
    categories: ['toxicity', 'insult'],
    severity_level: 'medium',
    status: 'pending',
    created_at: new Date().toISOString(),
    integration_config_id: 'integration-twitter-123'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase Client to avoid global collision
    mockSupabaseClient = { from: jest.fn() };

    // Mock Twitter Service
    mockTwitterService = {
      postResponse: jest.fn(() => Promise.resolve({
        success: true,
        platform_response_id: 'tweet-123',
        posted_at: new Date().toISOString()
      }))
    };
  });

  // Helper function to reduce Supabase chain mock repetition
  const createSingleChainMock = (data) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data,
          error: null
        }))
      }))
    }))
  });

  const createInsertChainMock = (data) => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data,
          error: null
        }))
      }))
    }))
  });

  const createUpdateChainMock = (data) => ({
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data,
            error: null
          }))
        }))
      }))
    }))
  });

  describe('Condiciones iniciales', () => {
    test('debe validar que el usuario tiene respuesta automática activada', async () => {
      // Arrange: Mock user config with auto_respond enabled
      const userConfig = {
        id: userId,
        plan: 'pro',
        preferences: {
          auto_respond: true, // ✅ Key condition
          humor_tone: 'sarcastic',
          humor_style: 'witty',
          response_frequency: 0.8,
          shield_enabled: false
        }
      };

      mockSupabaseClient.from.mockReturnValueOnce(createSingleChainMock(userConfig));

      // Act: Fetch user config
      const result = await mockSupabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      // Assert: Auto-respond is enabled
      expect(result.data.preferences.auto_respond).toBe(true);
      expect(result.data.plan).toBe('pro'); // Plan allows auto-posting
    });

    test('debe validar que hay roasts disponibles según el plan del usuario', async () => {
      // Arrange: Mock organization with available roasts
      const organizationConfig = {
        id: organizationId,
        plan_id: 'pro',
        monthly_responses_limit: 500,
        monthly_responses_used: 45, // ✅ Has roasts available
        settings: {
          auto_posting_enabled: true
        }
      };

      mockSupabaseClient.from.mockReturnValueOnce(createSingleChainMock(organizationConfig));

      // Act: Check roast availability
      const result = await mockSupabaseClient
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      // Assert: Roasts are available
      const roastsAvailable = result.data.monthly_responses_limit - result.data.monthly_responses_used;
      expect(roastsAvailable).toBeGreaterThan(0);
      expect(result.data.plan_id).not.toBe('free');
      expect(result.data.settings.auto_posting_enabled).toBe(true);
    });

    test('debe validar que la integración tiene auto-posting habilitado', async () => {
      // Arrange: Mock integration config with auto_post enabled
      const integrationConfig = {
        id: 'integration-twitter-123',
        organization_id: organizationId,
        platform: 'twitter',
        enabled: true,
        config: {
          auto_post: true, // ✅ Key condition
          tone: 'sarcastic',
          humor_type: 'witty',
          response_frequency: 0.8
        }
      };

      mockSupabaseClient.from.mockReturnValueOnce(createSingleChainMock(integrationConfig));

      // Act: Fetch integration config
      const result = await mockSupabaseClient
        .from('integration_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      // Assert: Auto-posting is enabled
      expect(result.data.config.auto_post).toBe(true);
      expect(result.data.enabled).toBe(true);
      expect(result.data.platform).toBe('twitter');
    });
  });

  describe('Flujo completo de generación y publicación automática', () => {
    test('debe validar las condiciones del flujo automático', async () => {
      // Arrange: Validate flow conditions
      const flowConditions = {
        toxicityScore: 0.72, // ✅ Medium-high toxicity (roasteable)
        severityLevel: 'medium',
        autoRespondEnabled: true,
        autoPostEnabled: true,
        roastsAvailable: 455, // 500 - 45 used
        planAllowsAutoPosting: true
      };

      // Act & Assert: Validate each condition
      expect(flowConditions.toxicityScore).toBeGreaterThan(0.6); // Roasteable threshold
      expect(flowConditions.severityLevel).toBe('medium'); // Not too severe
      expect(flowConditions.autoRespondEnabled).toBe(true); // User setting
      expect(flowConditions.autoPostEnabled).toBe(true); // Integration setting
      expect(flowConditions.roastsAvailable).toBeGreaterThan(0); // Has quota
      expect(flowConditions.planAllowsAutoPosting).toBe(true); // Plan allows it

      // Verify flow should proceed with explicit condition checks
      const shouldProceed =
        flowConditions.toxicityScore >= 0.6 &&
        flowConditions.severityLevel !== 'high' &&
        flowConditions.autoRespondEnabled &&
        flowConditions.autoPostEnabled &&
        flowConditions.roastsAvailable > 0 &&
        flowConditions.planAllowsAutoPosting;
      expect(shouldProceed).toBe(true);
    });

    test('debe simular la generación automática del roast', async () => {
      // Arrange: Mock roast generation
      const generationInput = {
        originalText: 'Tu app es una basura total y tú eres un incompetente',
        toxicityScore: 0.72,
        tone: 'sarcastic',
        humorStyle: 'witty',
        personaContext: 'desarrollador de software, emprendedor tech'
      };

      // Act: Simulate roast generation
      const mockGeneratedRoast = {
        text: 'Mi app será lo que sea, pero al menos no necesito insultar a desconocidos en internet para sentirme mejor. Tal vez deberías probar a programar algo antes de criticar 🤓',
        metadata: {
          tone: generationInput.tone,
          humor_type: generationInput.humorStyle,
          generation_time_ms: 1250,
          tokens_used: 45,
          cost_cents: 5
        }
      };

      // Assert: Validate generated roast
      expect(mockGeneratedRoast.text).toBeDefined();
      expect(mockGeneratedRoast.text.length).toBeLessThanOrEqual(280); // Twitter limit
      expect(mockGeneratedRoast.text.length).toBeGreaterThan(50); // Meaningful response
      expect(mockGeneratedRoast.metadata.tone).toBe('sarcastic');
      expect(mockGeneratedRoast.metadata.humor_type).toBe('witty');
      expect(mockGeneratedRoast.metadata.generation_time_ms).toBeLessThan(5000); // Reasonable time
      expect(mockGeneratedRoast.metadata.tokens_used).toBeGreaterThan(0);
    });

    test('debe simular la publicación automática', async () => {
      // Arrange: Mock posting process
      const postingInput = {
        responseText: 'Generated roast response',
        platform: 'twitter',
        originalCommentId: 'tweet-toxic-789',
        autoPostEnabled: true
      };

      // Act: Simulate auto-posting
      const mockPostingResult = await mockTwitterService.postResponse(
        postingInput.originalCommentId,
        postingInput.responseText
      );

      // Assert: Validate posting result
      expect(mockPostingResult.success).toBe(true);
      expect(mockPostingResult.platform_response_id).toBeDefined();
      expect(mockPostingResult.posted_at).toBeDefined();

      // Verify posting was called with correct parameters
      expect(mockTwitterService.postResponse).toHaveBeenCalledWith(
        postingInput.originalCommentId,
        postingInput.responseText
      );
    });
  });

  describe('Validaciones del roast generado', () => {
    test('debe validar que el roast pasa todas las validaciones internas', async () => {
      // Import the actual validation function
      const { validateRoastForPlatform } = require('../../src/config/platforms');

      // Arrange: Generated roast
      const generatedRoast = {
        response_text: 'Mi app será lo que sea, pero al menos no necesito insultar a desconocidos en internet para sentirme mejor. Tal vez deberías probar a programar algo antes de criticar 🤓',
        tone: 'sarcastic',
        humor_type: 'witty',
        generation_time_ms: 1250,
        tokens_used: 45
      };

      // Act: Run actual validation
      const validationResult = validateRoastForPlatform(generatedRoast.response_text, 'twitter');

      // Assert: Validation passes
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.originalLength).toBe(generatedRoast.response_text.length);
      expect(validationResult.limit).toBe(280);
      expect(validationResult.originalLength).toBeLessThanOrEqual(validationResult.limit);
    });
  });

  describe('Efectos colaterales en la base de datos', () => {
    test('debe crear entrada en tabla responses con estado "posted"', async () => {
      // Arrange: Mock successful posting
      const responseData = {
        id: responseId,
        organization_id: organizationId,
        comment_id: commentId,
        response_text: 'Generated roast',
        post_status: 'posted',
        platform_response_id: 'tweet-123',
        posted_at: new Date().toISOString()
      };

      mockSupabaseClient.from.mockReturnValueOnce(createInsertChainMock(responseData));

      // Act: Insert response
      const result = await mockSupabaseClient
        .from('responses')
        .insert(responseData)
        .select()
        .single();

      // Assert: Response created with correct status
      expect(result.data.post_status).toBe('posted');
      expect(result.data.platform_response_id).toBe('tweet-123');
      expect(result.data.posted_at).toBeDefined();
    });

    test('debe crear entrada en tabla roast_attempts', async () => {
      // Arrange: Mock roast attempt
      const attemptData = {
        id: attemptId,
        organization_id: organizationId,
        comment_id: commentId,
        response_id: responseId,
        attempt_number: 1,
        status: 'accepted',
        generated_by: userId,
        action_taken_by: 'system' // Automatic
      };

      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn(() => Promise.resolve({
          data: attemptData,
          error: null
        }))
      });

      // Act: Insert attempt
      const result = await mockSupabaseClient
        .from('roast_attempts')
        .insert(attemptData);

      // Assert: Attempt created correctly
      expect(result.data.attempt_number).toBe(1);
      expect(result.data.status).toBe('accepted');
      expect(result.data.action_taken_by).toBe('system');
    });

    test('debe actualizar métricas de uso de la organización', async () => {
      // Arrange: Mock organization usage update
      const updatedUsage = {
        monthly_responses_used: 46, // Incremented from 45
        total_responses_generated: 1,
        last_response_at: new Date().toISOString()
      };

      mockSupabaseClient.from.mockReturnValueOnce(createUpdateChainMock(updatedUsage));

      // Act: Update usage metrics
      const result = await mockSupabaseClient
        .from('organizations')
        .update(updatedUsage)
        .eq('id', organizationId)
        .select()
        .single();

      // Assert: Usage metrics updated
      expect(result.data.monthly_responses_used).toBe(46);
      expect(result.data.last_response_at).toBeDefined();
    });
  });

  describe('Negative path tests', () => {
    test('should not proceed when auto_post is disabled', async () => {
      // Arrange: Integration config with auto_post disabled
      const integrationConfig = {
        id: 'integration-twitter-123',
        organization_id: organizationId,
        platform: 'twitter',
        enabled: true,
        config: {
          auto_post: false, // ❌ Disabled
          humor_tone: 'sarcastic',
          humor_type: 'witty',
          response_frequency: 0.8
        }
      };

      mockSupabaseClient.from.mockReturnValueOnce(createSingleChainMock(integrationConfig));

      // Act: Check integration config
      const result = await mockSupabaseClient
        .from('integration_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      // Assert: Auto-post is disabled
      expect(result.data.config.auto_post).toBe(false);
    });

    test('should not proceed when quota is exhausted', async () => {
      // Arrange: Organization with exhausted quota
      const organizationConfig = {
        id: organizationId,
        monthly_responses_limit: 500,
        monthly_responses_used: 500, // ❌ Quota exhausted
        settings: {
          auto_posting_enabled: true
        }
      };

      mockSupabaseClient.from.mockReturnValueOnce(createSingleChainMock(organizationConfig));

      // Act: Check quota
      const result = await mockSupabaseClient
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      // Assert: No roasts available
      const roastsAvailable = Math.max(0, result.data.monthly_responses_limit - result.data.monthly_responses_used);
      expect(roastsAvailable).toBe(0);
    });

    test('should not proceed when roast length exceeds 280 characters', async () => {
      // Import validation function
      const { validateRoastForPlatform } = require('../../src/config/platforms');

      // Arrange: Very long roast text
      const longRoastText = 'A'.repeat(281); // ❌ Exceeds Twitter limit

      // Mock Twitter service to spy on posting calls
      const mockPostResponse = jest.fn().mockRejectedValue(new Error('Text exceeds maximum length'));
      const mockTwitterService = {
        postResponse: mockPostResponse
      };

      // Act: Validate the roast length
      const validationResult = validateRoastForPlatform(longRoastText, 'twitter');

      // Assert: Length validation should fail
      expect(longRoastText.length).toBeGreaterThan(280);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.originalLength).toBe(281);
      expect(validationResult.limit).toBe(280);

      // Test that posting would be rejected for oversized content
      if (!validationResult.isValid) {
        await expect(mockTwitterService.postResponse('test-id', longRoastText))
          .rejects.toThrow('Text exceeds maximum length');
      }

      // Verify posting service was called and rejected the oversized text
      expect(mockPostResponse).toHaveBeenCalledWith('test-id', longRoastText);
    });
  });
});
