/**
 * Persona Service
 *
 * Manages user persona configuration with encrypted storage and semantic embeddings.
 * Implements three-component persona system:
 * 1. Lo que me define (identity/personality)
 * 2. Lo que no tolero (intolerance/boundaries)
 * 3. Lo que me da igual (tolerance/false positive reduction)
 *
 * Features:
 * - AES-256-GCM encryption for sensitive data
 * - OpenAI text-embedding-3-small for semantic matching
 * - Plan-based feature gating (Free/Starter/Pro/Plus)
 * - GDPR compliance (deletion, audit trail)
 *
 * @see docs/nodes/persona.md for architecture
 * @see docs/plan/issue-595.md for implementation plan
 */

const { createClient } = require('@supabase/supabase-js');
const { encryptField, decryptField } = require('../utils/encryption');
const EmbeddingsService = require('./embeddingsService');
const { logger } = require('../utils/logger'); // Issue #618 - destructure logger from module
const { mockMode } = require('../config/mockMode');

// Plan-based access control configuration
const PLAN_ACCESS = {
  free: [], // No persona access
  basic: [], // Alias for free
  starter: ['lo_que_me_define', 'lo_que_no_tolero'], // 2 fields
  pro: ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual'], // All 3 fields
  plus: ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual'], // All 3 fields
  creator_plus: ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual'], // All 3 fields
  enterprise: ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual'] // All 3 fields
};

// Character limits (plaintext)
const CHARACTER_LIMITS = {
  lo_que_me_define: 300,
  lo_que_no_tolero: 300,
  lo_que_me_da_igual: 300
};

class PersonaService {
  constructor() {
    this.initializeSupabase();
    this.embeddingsService = new EmbeddingsService();
    this.embeddingsService.logger = logger; // Inject logger

    logger.info('PersonaService initialized', {
      planAccessConfigured: Object.keys(PLAN_ACCESS).length,
      characterLimits: CHARACTER_LIMITS
    });
  }

  /**
   * Initialize Supabase client
   * @private
   */
  initializeSupabase() {
    if (mockMode.isMockMode) {
      this.supabase = mockMode.generateMockSupabaseClient();
      logger.info('PersonaService: Mock Supabase client initialized');
    } else {
      // Use SERVICE_KEY for admin operations (per cost-control.md pattern)
      if (!process.env.SUPABASE_URL) {
        throw new Error('SUPABASE_URL is required for PersonaService');
      }
      if (!process.env.SUPABASE_SERVICE_KEY) {
        throw new Error(
          'SUPABASE_SERVICE_KEY is required for PersonaService. ' +
            'This service requires admin privileges for persona management across users.'
        );
      }

      this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

      logger.info('PersonaService: Supabase client initialized with SERVICE_KEY');
    }
  }

  /**
   * Get user's persona (decrypted)
   *
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Decrypted persona fields + metadata
   *
   * @example
   * const persona = await PersonaService.getPersona(userId);
   * // Returns: { lo_que_me_define: "text", lo_que_no_tolero: "text", ... }
   */
  async getPersona(userId) {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select(
          `
          lo_que_me_define_encrypted,
          lo_que_no_tolero_encrypted,
          lo_que_me_da_igual_encrypted,
          lo_que_me_define_updated_at,
          lo_que_no_tolero_updated_at,
          lo_que_me_da_igual_updated_at,
          embeddings_generated_at,
          embeddings_model,
          plan
        `
        )
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // User not found
          throw new Error(`User ${userId} not found`);
        }
        throw error;
      }

      // Decrypt fields
      const persona = {
        lo_que_me_define: decryptField(user.lo_que_me_define_encrypted),
        lo_que_no_tolero: decryptField(user.lo_que_no_tolero_encrypted),
        lo_que_me_da_igual: decryptField(user.lo_que_me_da_igual_encrypted),
        metadata: {
          lo_que_me_define_updated_at: user.lo_que_me_define_updated_at,
          lo_que_no_tolero_updated_at: user.lo_que_no_tolero_updated_at,
          lo_que_me_da_igual_updated_at: user.lo_que_me_da_igual_updated_at,
          embeddings_generated_at: user.embeddings_generated_at,
          embeddings_model: user.embeddings_model,
          plan: user.plan
        }
      };

      logger.info('Persona retrieved', {
        userId,
        hasIdentity: !!persona.lo_que_me_define,
        hasIntolerance: !!persona.lo_que_no_tolero,
        hasTolerance: !!persona.lo_que_me_da_igual
      });

      return persona;
    } catch (error) {
      logger.error('Failed to get persona', { userId, error: error.message });
      throw new Error(`Failed to get persona: ${error.message}`);
    }
  }

  /**
   * Update user's persona (encrypt + generate embeddings)
   *
   * @param {string} userId - User UUID
   * @param {Object} fields - Persona fields to update
   * @param {string} userPlan - User's subscription plan
   * @returns {Promise<Object>} Success status
   *
   * @throws {Error} PLAN_RESTRICTION if plan doesn't allow field
   * @throws {Error} CHARACTER_LIMIT_EXCEEDED if field too long
   *
   * @example
   * await PersonaService.updatePersona(userId, {
   *   lo_que_me_define: "Soy developer sarcástico"
   * }, 'pro');
   */
  async updatePersona(userId, fields, userPlan) {
    try {
      // Known persona fields
      const knownFields = ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual'];

      // Validate plan access for each KNOWN field
      for (const fieldName of Object.keys(fields)) {
        if (!fields[fieldName]) continue; // Skip null/empty fields
        if (!knownFields.includes(fieldName)) continue; // Skip unknown fields

        this._validatePlanAccess(userPlan, fieldName);
        this._validateCharacterLimit(fieldName, fields[fieldName]);
      }

      // Encrypt fields
      const updates = {};
      const now = new Date().toISOString();

      if (fields.lo_que_me_define !== undefined) {
        updates.lo_que_me_define_encrypted = encryptField(fields.lo_que_me_define);
        updates.lo_que_me_define_updated_at = now;
      }

      if (fields.lo_que_no_tolero !== undefined) {
        updates.lo_que_no_tolero_encrypted = encryptField(fields.lo_que_no_tolero);
        updates.lo_que_no_tolero_updated_at = now;
      }

      if (fields.lo_que_me_da_igual !== undefined) {
        updates.lo_que_me_da_igual_encrypted = encryptField(fields.lo_que_me_da_igual);
        updates.lo_que_me_da_igual_updated_at = now;
      }

      // Save encrypted fields to database
      const { error: updateError } = await this.supabase
        .from('users')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      logger.info('Persona updated (encrypted)', {
        userId,
        fieldsUpdated: Object.keys(updates),
        plan: userPlan
      });

      // Generate embeddings asynchronously (non-blocking)
      this._updateEmbeddings(userId, fields).catch((error) => {
        logger.error('Embedding generation failed (non-blocking)', {
          userId,
          error: error.message
        });
      });

      return { success: true, fieldsUpdated: Object.keys(fields) };
    } catch (error) {
      logger.error('Failed to update persona', {
        userId,
        fields: Object.keys(fields),
        error: error.message
      });
      throw error; // Re-throw for API to handle
    }
  }

  /**
   * Delete user's persona (GDPR compliance)
   *
   * Sets all persona fields to NULL (soft delete).
   * Embeddings are also removed.
   *
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   *
   * @example
   * await PersonaService.deletePersona(userId);
   */
  async deletePersona(userId) {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          lo_que_me_define_encrypted: null,
          lo_que_me_define_embedding: null,
          lo_que_me_define_updated_at: null,
          lo_que_no_tolero_encrypted: null,
          lo_que_no_tolero_embedding: null,
          lo_que_no_tolero_updated_at: null,
          lo_que_me_da_igual_encrypted: null,
          lo_que_me_da_igual_embedding: null,
          lo_que_me_da_igual_updated_at: null,
          embeddings_generated_at: null,
          embeddings_model: null,
          embeddings_version: null
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      logger.info('Persona deleted', { userId });
    } catch (error) {
      logger.error('Failed to delete persona', { userId, error: error.message });
      throw new Error(`Failed to delete persona: ${error.message}`);
    }
  }

  /**
   * Validate plan-based access to persona field
   * @private
   *
   * @throws {Error} PLAN_RESTRICTION if plan doesn't allow field
   */
  _validatePlanAccess(userPlan, fieldName) {
    const allowedFields = PLAN_ACCESS[userPlan] || [];

    if (!allowedFields.includes(fieldName)) {
      const requiredPlan = this._getRequiredPlan(fieldName);
      throw new Error(
        `PLAN_RESTRICTION: "${fieldName}" requires ${requiredPlan} plan or higher. Current plan: ${userPlan}`
      );
    }
  }

  /**
   * Validate character limit for field
   * @private
   *
   * @throws {Error} CHARACTER_LIMIT_EXCEEDED if too long
   */
  _validateCharacterLimit(fieldName, value) {
    if (!value) return; // Null/empty OK

    const limit = CHARACTER_LIMITS[fieldName];
    if (value.length > limit) {
      throw new Error(
        `CHARACTER_LIMIT_EXCEEDED: "${fieldName}" exceeds ${limit} character limit (${value.length} characters provided)`
      );
    }
  }

  /**
   * Get required plan for field
   * @private
   */
  _getRequiredPlan(fieldName) {
    if (fieldName === 'lo_que_me_da_igual') {
      return 'Pro'; // Field 3 requires Pro+
    }
    return 'Starter'; // Fields 1-2 require Starter+
  }

  /**
   * Update embeddings for persona fields
   * @private
   *
   * Generates embeddings using OpenAI text-embedding-3-small
   * and stores them in database for semantic matching.
   *
   * @param {string} userId - User UUID
   * @param {Object} fields - Persona fields with text
   */
  async _updateEmbeddings(userId, fields) {
    try {
      const embeddings = {};

      // Generate embedding for each field
      if (fields.lo_que_me_define) {
        try {
          embeddings.lo_que_me_define_embedding = await this.embeddingsService.generateEmbedding(
            fields.lo_que_me_define
          );
        } catch (error) {
          logger.error('Failed to generate embedding for lo_que_me_define', {
            userId,
            error: error.message
          });
        }
      }

      if (fields.lo_que_no_tolero) {
        try {
          embeddings.lo_que_no_tolero_embedding = await this.embeddingsService.generateEmbedding(
            fields.lo_que_no_tolero
          );
        } catch (error) {
          logger.error('Failed to generate embedding for lo_que_no_tolero', {
            userId,
            error: error.message
          });
        }
      }

      if (fields.lo_que_me_da_igual) {
        try {
          embeddings.lo_que_me_da_igual_embedding = await this.embeddingsService.generateEmbedding(
            fields.lo_que_me_da_igual
          );
        } catch (error) {
          logger.error('Failed to generate embedding for lo_que_me_da_igual', {
            userId,
            error: error.message
          });
        }
      }

      // Update embeddings in database if any were generated
      if (Object.keys(embeddings).length > 0) {
        embeddings.embeddings_generated_at = new Date().toISOString();
        embeddings.embeddings_model = 'text-embedding-3-small';
        embeddings.embeddings_version = 1;

        const { error: updateError } = await this.supabase
          .from('users')
          .update(embeddings)
          .eq('id', userId);

        if (updateError) {
          throw updateError;
        }

        logger.info('Embeddings generated and stored', {
          userId,
          embeddingsGenerated: Object.keys(embeddings).filter((k) => k.includes('embedding')).length
        });
      }
    } catch (error) {
      logger.error('Failed to update embeddings', {
        userId,
        error: error.message
      });
      // Don't throw - embeddings are non-critical
    }
  }

  /**
   * Health check for PersonaService
   *
   * @returns {Promise<Object>} Service health status
   */
  async healthCheck() {
    try {
      // Test encryption
      const testText = 'Health check test';
      const encrypted = encryptField(testText);
      const decrypted = decryptField(encrypted);

      if (decrypted !== testText) {
        throw new Error('Encryption round-trip failed');
      }

      // Test embeddings service
      const embeddingsHealth = await this.embeddingsService.healthCheck();

      // Test database connection
      const { count, error: dbError } = await this.supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      if (dbError) {
        throw new Error(`Database connection failed: ${dbError.message}`);
      }

      return {
        status: 'healthy',
        encryption: 'working',
        embeddings: embeddingsHealth.status,
        database: 'connected',
        planAccessRules: Object.keys(PLAN_ACCESS).length,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
module.exports = new PersonaService();
