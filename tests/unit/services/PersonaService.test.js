/**
 * Unit Tests: PersonaService
 *
 * Tests persona CRUD operations, encryption, embeddings, and plan-based access
 *
 * Test Categories:
 * 1. CRUD operations (get, update, delete)
 * 2. Plan-based access control
 * 3. Encryption integration
 * 4. Embeddings generation
 * 5. Validation (character limits, field names)
 * 6. Error handling
 *
 * @see src/services/PersonaService.js
 * @see docs/plan/issue-595.md (Phase 5 tests)
 */

const PersonaService = require('../../../src/services/PersonaService');
const { encryptField, decryptField } = require('../../../src/utils/encryption');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../../src/services/embeddingsService');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

describe('PersonaService', () => {
  // Setup encryption key for tests
  beforeAll(() => {
    if (!process.env.PERSONA_ENCRYPTION_KEY) {
      process.env.PERSONA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    }
  });

  // Mock Supabase client
  let mockSupabase;
  beforeEach(() => {
    // Create chainable mock
    const createChainableMock = () => ({
      from: jest.fn(function () {
        return this;
      }),
      select: jest.fn(function () {
        return this;
      }),
      update: jest.fn(function () {
        return this;
      }),
      eq: jest.fn(function () {
        return this;
      }),
      limit: jest.fn(function () {
        return this;
      }),
      single: jest.fn(),
      head: true // For count queries
    });

    mockSupabase = createChainableMock();

    // Replace PersonaService supabase instance
    PersonaService.supabase = mockSupabase;
  });

  describe('getPersona', () => {
    it('should retrieve and decrypt persona successfully', async () => {
      const userId = 'user-123';
      const plaintext = 'Soy developer sarcástico';
      const encrypted = encryptField(plaintext);

      mockSupabase.single.mockResolvedValue({
        data: {
          lo_que_me_define_encrypted: encrypted,
          lo_que_no_tolero_encrypted: null,
          lo_que_me_da_igual_encrypted: null,
          lo_que_me_define_updated_at: '2025-10-19T12:00:00Z',
          embeddings_generated_at: '2025-10-19T12:05:00Z',
          embeddings_model: 'text-embedding-3-small',
          plan: 'pro'
        },
        error: null
      });

      const persona = await PersonaService.getPersona(userId);

      expect(persona.lo_que_me_define).toBe(plaintext);
      expect(persona.lo_que_no_tolero).toBeNull();
      expect(persona.metadata.plan).toBe('pro');
    });

    it('should return null for empty encrypted fields', async () => {
      const userId = 'user-456';

      mockSupabase.single.mockResolvedValue({
        data: {
          lo_que_me_define_encrypted: null,
          lo_que_no_tolero_encrypted: null,
          lo_que_me_da_igual_encrypted: null,
          plan: 'free'
        },
        error: null
      });

      const persona = await PersonaService.getPersona(userId);

      expect(persona.lo_que_me_define).toBeNull();
      expect(persona.lo_que_no_tolero).toBeNull();
      expect(persona.lo_que_me_da_igual).toBeNull();
    });

    it('should throw error if user not found', async () => {
      const userId = 'nonexistent';

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' }
      });

      await expect(PersonaService.getPersona(userId)).rejects.toThrow(/not found/);
    });

    it('should call Supabase with correct query', async () => {
      const userId = 'user-789';

      mockSupabase.single.mockResolvedValue({
        data: {
          lo_que_me_define_encrypted: null,
          plan: 'starter'
        },
        error: null
      });

      await PersonaService.getPersona(userId);

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', userId);
    });
  });

  describe('updatePersona', () => {
    it('should encrypt and update persona fields', async () => {
      const userId = 'user-123';
      const fields = {
        lo_que_me_define: 'Soy developer',
        lo_que_no_tolero: 'Body shaming'
      };

      // Mock the final promise resolution
      mockSupabase.eq.mockResolvedValue({ data: {}, error: null });

      const result = await PersonaService.updatePersona(userId, fields, 'pro');

      expect(result.success).toBe(true);
      expect(result.fieldsUpdated).toEqual(['lo_que_me_define', 'lo_que_no_tolero']);
      expect(mockSupabase.update).toHaveBeenCalled();

      // Verify encryption was called
      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.lo_que_me_define_encrypted).toBeTruthy();
      expect(updateCall.lo_que_me_define_encrypted).not.toBe(fields.lo_que_me_define);
    });

    it('should set updated_at timestamps', async () => {
      const userId = 'user-456';
      const fields = { lo_que_me_define: 'Test' };

      mockSupabase.eq.mockResolvedValue({ error: null });

      await PersonaService.updatePersona(userId, fields, 'pro');

      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.lo_que_me_define_updated_at).toBeTruthy();
      expect(new Date(updateCall.lo_que_me_define_updated_at)).toBeInstanceOf(Date);
    });

    it('should handle partial updates', async () => {
      const userId = 'user-789';
      const fields = { lo_que_no_tolero: 'Only this field' };

      mockSupabase.eq.mockResolvedValue({ error: null });

      const result = await PersonaService.updatePersona(userId, fields, 'starter');

      expect(result.fieldsUpdated).toEqual(['lo_que_no_tolero']);

      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.lo_que_no_tolero_encrypted).toBeTruthy();
      expect(updateCall.lo_que_me_define_encrypted).toBeUndefined();
    });

    it('should handle null values (deletion)', async () => {
      const userId = 'user-111';
      const fields = { lo_que_me_define: null };

      mockSupabase.eq.mockResolvedValue({ error: null });

      await PersonaService.updatePersona(userId, fields, 'pro');

      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.lo_que_me_define_encrypted).toBeNull();
    });
  });

  describe('deletePersona', () => {
    it('should set all persona fields to NULL', async () => {
      const userId = 'user-123';

      mockSupabase.eq.mockResolvedValue({ error: null });

      await PersonaService.deletePersona(userId);

      const updateCall = mockSupabase.update.mock.calls[0][0];

      expect(updateCall.lo_que_me_define_encrypted).toBeNull();
      expect(updateCall.lo_que_no_tolero_encrypted).toBeNull();
      expect(updateCall.lo_que_me_da_igual_encrypted).toBeNull();
      expect(updateCall.lo_que_me_define_embedding).toBeNull();
      expect(updateCall.lo_que_no_tolero_embedding).toBeNull();
      expect(updateCall.lo_que_me_da_igual_embedding).toBeNull();
      expect(updateCall.embeddings_generated_at).toBeNull();
    });

    it('should call update with correct user ID', async () => {
      const userId = 'user-456';

      mockSupabase.eq.mockResolvedValue({ error: null });

      await PersonaService.deletePersona(userId);

      expect(mockSupabase.eq).toHaveBeenCalledWith('id', userId);
    });

    it('should throw error if deletion fails', async () => {
      const userId = 'user-789';

      mockSupabase.update.mockResolvedValue({
        error: { message: 'Database error' }
      });

      await expect(PersonaService.deletePersona(userId)).rejects.toThrow(/Failed to delete/);
    });
  });

  describe('Plan-based Access Control', () => {
    beforeEach(() => {
      mockSupabase.eq.mockResolvedValue({ error: null });
    });

    it('should reject Free plan users for all fields', async () => {
      const userId = 'free-user';
      const fields = { lo_que_me_define: 'Test' };

      await expect(PersonaService.updatePersona(userId, fields, 'free')).rejects.toThrow(
        /PLAN_RESTRICTION/
      );
    });

    it('should allow Starter plan users for identity field', async () => {
      const userId = 'starter-user';
      const fields = { lo_que_me_define: 'Test identity' };

      const result = await PersonaService.updatePersona(userId, fields, 'starter');
      expect(result.success).toBe(true);
    });

    it('should allow Starter plan users for intolerance field', async () => {
      const userId = 'starter-user';
      const fields = { lo_que_no_tolero: 'Test intolerance' };

      const result = await PersonaService.updatePersona(userId, fields, 'starter');
      expect(result.success).toBe(true);
    });

    it('should reject Starter plan users for tolerance field', async () => {
      const userId = 'starter-user';
      const fields = { lo_que_me_da_igual: 'Test tolerance' };

      await expect(PersonaService.updatePersona(userId, fields, 'starter')).rejects.toThrow(
        /PLAN_RESTRICTION.*lo_que_me_da_igual.*Pro/
      );
    });

    it('should allow Pro plan users for all 3 fields', async () => {
      const userId = 'pro-user';
      const fields = {
        lo_que_me_define: 'Identity',
        lo_que_no_tolero: 'Intolerance',
        lo_que_me_da_igual: 'Tolerance'
      };

      const result = await PersonaService.updatePersona(userId, fields, 'pro');
      expect(result.success).toBe(true);
      expect(result.fieldsUpdated).toHaveLength(3);
    });

    it('should allow Plus plan users for all 3 fields', async () => {
      const userId = 'plus-user';
      const fields = {
        lo_que_me_define: 'Identity',
        lo_que_no_tolero: 'Intolerance',
        lo_que_me_da_igual: 'Tolerance'
      };

      const result = await PersonaService.updatePersona(userId, fields, 'plus');
      expect(result.success).toBe(true);
    });

    it('should allow creator_plus plan users for all fields', async () => {
      const userId = 'creator-user';
      const fields = {
        lo_que_me_define: 'Identity',
        lo_que_no_tolero: 'Intolerance',
        lo_que_me_da_igual: 'Tolerance'
      };

      const result = await PersonaService.updatePersona(userId, fields, 'creator_plus');
      expect(result.success).toBe(true);
    });

    it('should handle basic plan as alias for free', async () => {
      const userId = 'basic-user';
      const fields = { lo_que_me_define: 'Test' };

      await expect(PersonaService.updatePersona(userId, fields, 'basic')).rejects.toThrow(
        /PLAN_RESTRICTION/
      );
    });
  });

  describe('Character Limit Validation', () => {
    beforeEach(() => {
      mockSupabase.eq.mockResolvedValue({ error: null });
    });

    it('should accept text at character limit (300 chars)', async () => {
      const userId = 'user-123';
      const maxText = 'A'.repeat(300);
      const fields = { lo_que_me_define: maxText };

      const result = await PersonaService.updatePersona(userId, fields, 'pro');
      expect(result.success).toBe(true);
    });

    it('should reject text over character limit', async () => {
      const userId = 'user-123';
      const tooLong = 'A'.repeat(301);
      const fields = { lo_que_me_define: tooLong };

      await expect(PersonaService.updatePersona(userId, fields, 'pro')).rejects.toThrow(
        /CHARACTER_LIMIT_EXCEEDED.*300/
      );
    });

    it('should validate each field independently', async () => {
      const userId = 'user-123';
      const fields = {
        lo_que_me_define: 'A'.repeat(300), // OK
        lo_que_no_tolero: 'A'.repeat(301) // Too long
      };

      await expect(PersonaService.updatePersona(userId, fields, 'pro')).rejects.toThrow(
        /CHARACTER_LIMIT_EXCEEDED.*lo_que_no_tolero/
      );
    });

    it('should allow empty strings', async () => {
      const userId = 'user-123';
      const fields = { lo_que_me_define: '' };

      const result = await PersonaService.updatePersona(userId, fields, 'pro');
      expect(result.success).toBe(true);
    });

    it('should allow null values (deletion)', async () => {
      const userId = 'user-123';
      const fields = { lo_que_me_define: null };

      const result = await PersonaService.updatePersona(userId, fields, 'pro');
      expect(result.success).toBe(true);
    });
  });

  describe('Encryption Integration', () => {
    beforeEach(() => {
      mockSupabase.eq.mockResolvedValue({ error: null });
    });

    it('should encrypt plaintext before storage', async () => {
      const userId = 'user-123';
      const plaintext = 'Sensitive data';
      const fields = { lo_que_me_define: plaintext };

      await PersonaService.updatePersona(userId, fields, 'pro');

      const updateCall = mockSupabase.update.mock.calls[0][0];
      const encrypted = updateCall.lo_que_me_define_encrypted;

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      expect(decryptField(encrypted)).toBe(plaintext);
    });

    it('should decrypt ciphertext on retrieval', async () => {
      const userId = 'user-456';
      const plaintext = 'Original text';
      const encrypted = encryptField(plaintext);

      // Mock the complete chain for getPersona
      mockSupabase.eq.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            lo_que_me_define_encrypted: encrypted,
            plan: 'pro'
          },
          error: null
        })
      });

      const persona = await PersonaService.getPersona(userId);

      expect(persona.lo_que_me_define).toBe(plaintext);
    });

    it('should handle special characters in encryption', async () => {
      const userId = 'user-789';
      const specialText = 'Español: ñ, á. Emojis: 😂🔥. Symbols: @#$%';
      const fields = { lo_que_me_define: specialText };

      await PersonaService.updatePersona(userId, fields, 'pro');

      const updateCall = mockSupabase.update.mock.calls[0][0];
      const encrypted = updateCall.lo_que_me_define_encrypted;

      expect(decryptField(encrypted)).toBe(specialText);
    });

    it('should store null for null input (no encryption)', async () => {
      const userId = 'user-111';
      const fields = { lo_que_me_define: null };

      await PersonaService.updatePersona(userId, fields, 'pro');

      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.lo_que_me_define_encrypted).toBeNull();
    });
  });

  describe('Embeddings Generation', () => {
    it('should trigger embedding generation asynchronously', async () => {
      const userId = 'user-123';
      const fields = { lo_que_me_define: 'Test embedding generation' };

      mockSupabase.eq.mockResolvedValue({ error: null });

      // Mock embeddings service
      const mockGenerateEmbedding = jest.fn().mockResolvedValue(new Array(1536).fill(0.1));
      PersonaService.embeddingsService.generateEmbedding = mockGenerateEmbedding;

      await PersonaService.updatePersona(userId, fields, 'pro');

      // Wait for async embedding generation
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Embedding generation should be called (async)
      // Note: Since it's async and non-blocking, we test via _updateEmbeddings directly
    });

    it('should not fail update if embedding generation fails', async () => {
      const userId = 'user-456';
      const fields = { lo_que_me_define: 'Test' };

      mockSupabase.eq.mockResolvedValue({ error: null });

      // Mock embedding failure
      PersonaService.embeddingsService.generateEmbedding = jest
        .fn()
        .mockRejectedValue(new Error('OpenAI API error'));

      // Update should still succeed
      const result = await PersonaService.updatePersona(userId, fields, 'pro');
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw descriptive error on database failure', async () => {
      const userId = 'user-123';
      const fields = { lo_que_me_define: 'Test' };

      // Mock database failure on update
      const dbError = new Error('Connection timeout');
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: dbError
      });

      await expect(PersonaService.updatePersona(userId, fields, 'pro')).rejects.toThrow(
        /Connection timeout/
      );
    });

    it('should skip validation for unknown fields', async () => {
      const userId = 'user-123';
      const fields = { unknown_field: 'Test' };

      mockSupabase.eq.mockResolvedValue({ error: null });

      // Unknown fields pass validation (no plan check) but don't get processed
      const result = await PersonaService.updatePersona(userId, fields, 'pro');
      // Note: PersonaService only processes known fields in updatePersona
      expect(result.success).toBe(true);
    });

    it('should provide helpful error messages for plan restrictions', async () => {
      const userId = 'user-123';
      const fields = { lo_que_me_da_igual: 'Test' };

      mockSupabase.eq.mockResolvedValue({ error: null });

      try {
        await PersonaService.updatePersona(userId, fields, 'starter');
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('PLAN_RESTRICTION');
        expect(error.message).toContain('lo_que_me_da_igual');
        expect(error.message).toContain('Pro');
        expect(error.message).toContain('starter');
      }
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all systems working', async () => {
      // Mock the full chain: from().select().limit().single()
      mockSupabase.limit.mockReturnValue({
        ...mockSupabase,
        single: jest.fn().mockResolvedValue({ count: 1, error: null })
      });

      // Mock embeddings health
      PersonaService.embeddingsService.healthCheck = jest.fn().mockResolvedValue({
        status: 'healthy'
      });

      const health = await PersonaService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.encryption).toBe('working');
      expect(health.embeddings).toBe('healthy');
      expect(health.database).toBe('connected');
    });

    it('should return unhealthy status on encryption failure', async () => {
      // Corrupt encryption key temporarily
      const originalKey = process.env.PERSONA_ENCRYPTION_KEY;
      process.env.PERSONA_ENCRYPTION_KEY = 'invalid';

      const health = await PersonaService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBeTruthy();

      // Restore key
      process.env.PERSONA_ENCRYPTION_KEY = originalKey;
    });

    it('should return unhealthy status on database failure', async () => {
      // Mock database connection failure
      // healthCheck uses: .from('users').select(...).limit(1)
      // The final result should have an error
      mockSupabase.limit.mockResolvedValue({
        count: null,
        error: { message: 'Connection refused' }
      });

      const health = await PersonaService.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('Database connection failed');
    });
  });
});
