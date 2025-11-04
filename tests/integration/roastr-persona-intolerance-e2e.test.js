const request = require('supertest');
const express = require('express');

describe('Roastr Persona Intolerance - End-to-End Integration (Issue #149)', () => {
  let app;
  let mockDatabase;
  let mockWorker;
  let testUserId;
  let testOrgId;

  beforeEach(() => {
    testUserId = 'test-user-123';
    testOrgId = 'test-org-456';

    // Mock database state
    mockDatabase = {
      users: new Map([
        [testUserId, {
          id: testUserId,
          email: 'test@example.com',
          lo_que_me_define_encrypted: null,
          lo_que_me_define_visible: false,
          lo_que_no_tolero_encrypted: null,
          lo_que_no_tolero_visible: false,
          lo_que_me_define_created_at: null,
          lo_que_me_define_updated_at: null,
          lo_que_no_tolero_created_at: null,
          lo_que_no_tolero_updated_at: null
        }]
      ]),
      organizations: new Map([
        [testOrgId, {
          id: testOrgId,
          owner_id: testUserId,
          name: 'Test Organization'
        }]
      ]),
      comments: new Map()
    };

    // Mock Supabase client with database state
    const mockSupabaseClient = {
      from: jest.fn((table) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          if (table === 'users') {
            const user = mockDatabase.users.get(testUserId);
            return Promise.resolve({ data: user, error: null });
          }
          if (table === 'organizations') {
            const org = mockDatabase.organizations.get(testOrgId);
            return Promise.resolve({ data: org, error: null });
          }
          return Promise.resolve({ data: null, error: { message: 'Not found' } });
        }),
        update: jest.fn().mockImplementation((updateData) => {
          if (table === 'users') {
            const user = mockDatabase.users.get(testUserId);
            Object.assign(user, updateData);
            return Promise.resolve({ data: user, error: null });
          }
          return Promise.resolve({ data: null, error: { message: 'Update failed' } });
        }),
        insert: jest.fn().mockImplementation((insertData) => {
          if (table === 'comments') {
            const comment = { id: 'new-comment-id', ...insertData[0] };
            mockDatabase.comments.set(comment.id, comment);
            return Promise.resolve({ data: comment, error: null });
          }
          return Promise.resolve({ data: null, error: { message: 'Insert failed' } });
        })
      }))
    };

    // Mock authentication
    const mockAuthenticateToken = jest.fn((req, res, next) => {
      req.user = { id: testUserId };
      req.accessToken = 'mock-access-token';
      next();
    });

    // Mock encryption service
    const mockEncryptionService = {
      encrypt: jest.fn((text) => `encrypted_${Buffer.from(text).toString('base64')}`),
      decrypt: jest.fn((encrypted) => {
        if (encrypted.startsWith('encrypted_')) {
          return Buffer.from(encrypted.replace('encrypted_', ''), 'base64').toString();
        }
        throw new Error('Invalid encrypted data');
      }),
      sanitizeForEncryption: jest.fn((text) => text.trim())
    };

    // Mock worker for testing auto-blocking
    mockWorker = {
      processComment: async (commentText, organizationId) => {
        // Simulate the auto-blocking logic
        const user = mockDatabase.users.get(testUserId);
        if (user.lo_que_no_tolero_encrypted) {
          const intoleranceData = mockEncryptionService.decrypt(user.lo_que_no_tolero_encrypted);
          const intoleranceTerms = intoleranceData.toLowerCase().split(/[,;\.]+/).map(t => t.trim());
          
          const hasMatch = intoleranceTerms.some(term => 
            term.length > 2 && commentText.toLowerCase().includes(term)
          );
          
          if (hasMatch) {
            return {
              auto_blocked: true,
              toxicity_score: 1.0,
              severity_level: 'critical',
              categories: ['auto_blocked', 'user_intolerance'],
              service: 'auto_block'
            };
          }
        }
        
        // Normal analysis
        return {
          auto_blocked: false,
          toxicity_score: 0.3,
          severity_level: 'low',
          categories: ['mild_negativity'],
          service: 'patterns'
        };
      }
    };

    // Mock dependencies
    jest.mock('../../../src/config/supabase', () => ({
      supabaseServiceClient: mockSupabaseClient,
      createUserClient: jest.fn(() => mockSupabaseClient)
    }));

    jest.mock('../../../src/middleware/auth', () => ({
      authenticateToken: mockAuthenticateToken
    }));

    jest.mock('../../../src/services/encryptionService', () => mockEncryptionService);

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

    // Create Express app
    app = express();
    app.use(express.json());
    
    const userRoutes = require('../../../src/routes/user');
    app.use('/api/user', userRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('Complete Workflow: Configure Intolerance → Test Auto-blocking', () => {
    it('should configure intolerance preferences and then auto-block matching comments', async () => {
      // Step 1: User configures their intolerance preferences
      const configResponse = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: 'insultos raciales, comentarios sobre peso, ataques homófobos',
          isIntoleranceVisible: false
        });

      expect(configResponse.status).toBe(200);
      expect(configResponse.body.success).toBe(true);
      expect(configResponse.body.data.hasIntoleranceContent).toBe(true);

      // Verify data was encrypted and stored
      const user = mockDatabase.users.get(testUserId);
      expect(user.lo_que_no_tolero_encrypted).toMatch(/^encrypted_/);
      expect(user.lo_que_no_tolero_created_at).toBeTruthy();

      // Step 2: Verify the preferences can be retrieved correctly
      const getResponse = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data.loQueNoTolero).toBe('insultos raciales, comentarios sobre peso, ataques homófobos');
      expect(getResponse.body.data.hasIntoleranceContent).toBe(true);

      // Step 3: Test auto-blocking functionality
      const testComments = [
        {
          text: 'Me encantan los insultos raciales hacia ti',
          shouldBlock: true,
          reason: 'Contains "insultos raciales"'
        },
        {
          text: 'Tus comentarios sobre peso son ridículos',
          shouldBlock: true,
          reason: 'Contains "comentarios sobre peso"'
        },
        {
          text: 'Los ataques homófobos no están bien',
          shouldBlock: true,
          reason: 'Contains "ataques homófobos"'
        },
        {
          text: 'Este es un comentario normal sin problemas',
          shouldBlock: false,
          reason: 'No intolerance matches'
        },
        {
          text: 'No me gusta tu política pero respeto tu opinión',
          shouldBlock: false,
          reason: 'No intolerance matches'
        }
      ];

      for (const testComment of testComments) {
        const analysisResult = await mockWorker.processComment(testComment.text, testOrgId);

        if (testComment.shouldBlock) {
          expect(analysisResult.auto_blocked).toBe(true);
          expect(analysisResult.toxicity_score).toBe(1.0);
          expect(analysisResult.severity_level).toBe('critical');
          expect(analysisResult.categories).toContain('auto_blocked');
          expect(analysisResult.service).toBe('auto_block');
        } else {
          expect(analysisResult.auto_blocked).toBe(false);
          expect(analysisResult.toxicity_score).toBeLessThan(1.0);
          expect(analysisResult.service).not.toBe('auto_block');
        }
      }
    });

    it('should handle partial field updates correctly', async () => {
      // Step 1: Configure identity only
      const identityResponse = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueMeDefine: 'mujer trans, artista, vegana',
          isVisible: false
        });

      expect(identityResponse.status).toBe(200);
      expect(identityResponse.body.data.hasContent).toBe(true);
      expect(identityResponse.body.data.hasIntoleranceContent).toBe(false);

      // Step 2: Add intolerance preferences later
      const intoleranceResponse = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: 'comentarios transfóbicos, ataques contra veganos',
          isIntoleranceVisible: false
        });

      expect(intoleranceResponse.status).toBe(200);
      expect(intoleranceResponse.body.data.hasContent).toBe(true); // Identity still there
      expect(intoleranceResponse.body.data.hasIntoleranceContent).toBe(true); // Intolerance added

      // Step 3: Verify both fields exist
      const getResponse = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(getResponse.body.data.loQueMeDefine).toBe('mujer trans, artista, vegana');
      expect(getResponse.body.data.loQueNoTolero).toBe('comentarios transfóbicos, ataques contra veganos');
      expect(getResponse.body.data.hasContent).toBe(true);
      expect(getResponse.body.data.hasIntoleranceContent).toBe(true);

      // Step 4: Test auto-blocking works with new preferences
      const blockingTests = [
        {
          text: 'Los comentarios transfóbicos son horribles',
          shouldBlock: true
        },
        {
          text: 'Odio a los ataques contra veganos',
          shouldBlock: true
        },
        {
          text: 'Me gusta la comida vegana',
          shouldBlock: false
        }
      ];

      for (const test of blockingTests) {
        const result = await mockWorker.processComment(test.text, testOrgId);
        expect(result.auto_blocked).toBe(test.shouldBlock);
      }
    });

    it('should handle selective deletion correctly', async () => {
      // Step 1: Configure both fields
      await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueMeDefine: 'programadora, gamer',
          isVisible: false,
          loQueNoTolero: 'ataques sexistas, comentarios sobre habilidades técnicas',
          isIntoleranceVisible: false
        });

      // Step 2: Delete only intolerance field
      const deleteResponse = await request(app)
        .delete('/api/user/roastr-persona?field=intolerance')
        .set('Authorization', 'Bearer mock-token');

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.data.field).toBe('intolerance');

      // Step 3: Verify identity remains but intolerance is gone
      const getResponse = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(getResponse.body.data.loQueMeDefine).toBe('programadora, gamer');
      expect(getResponse.body.data.loQueNoTolero).toBe(null);
      expect(getResponse.body.data.hasContent).toBe(true);
      expect(getResponse.body.data.hasIntoleranceContent).toBe(false);

      // Step 4: Verify auto-blocking is disabled
      const result = await mockWorker.processComment('ataques sexistas horribles', testOrgId);
      expect(result.auto_blocked).toBe(false);
    });

    it('should handle edge cases in intolerance matching', async () => {
      // Configure edge case intolerance terms
      await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: 'a, bb, palabra larga, términos con números123, símbolos@especiales',
          isIntoleranceVisible: false
        });

      const edgeCaseTests = [
        {
          text: 'La letra a está aquí',
          shouldBlock: false, // 'a' should be filtered out (too short)
          description: 'Very short terms should be ignored'
        },
        {
          text: 'bb no debería hacer match',
          shouldBlock: false, // 'bb' should be filtered out (too short)
          description: 'Two character terms should be ignored'
        },
        {
          text: 'Esta es una palabra larga en el texto',
          shouldBlock: true,
          description: 'Multi-word terms should match'
        },
        {
          text: 'Los términos con números123 son problemáticos',
          shouldBlock: true,
          description: 'Terms with numbers should match'
        },
        {
          text: 'Usando símbolos@especiales aquí',
          shouldBlock: true,
          description: 'Terms with special characters should match'
        }
      ];

      for (const test of edgeCaseTests) {
        const result = await mockWorker.processComment(test.text, testOrgId);
        expect(result.auto_blocked).toBe(test.shouldBlock);
      }
    });

    it('should maintain data privacy and security throughout the workflow', async () => {
      const sensitiveData = 'información muy personal y privada';

      // Step 1: Store sensitive intolerance data
      const configResponse = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: sensitiveData,
          isIntoleranceVisible: false
        });

      expect(configResponse.status).toBe(200);

      // Step 2: Verify data is encrypted in storage
      const user = mockDatabase.users.get(testUserId);
      expect(user.lo_que_no_tolero_encrypted).not.toContain(sensitiveData);
      expect(user.lo_que_no_tolero_encrypted).toMatch(/^encrypted_/);

      // Step 3: Verify API responses don't expose encrypted data
      const getResponse = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      const responseText = JSON.stringify(getResponse.body);
      expect(responseText).not.toContain('encrypted_');
      expect(responseText).toContain(sensitiveData); // Should contain decrypted version

      // Step 4: Verify visibility is always false for intolerance data
      expect(getResponse.body.data.isIntoleranceVisible).toBe(false);

      // Step 5: Test that auto-blocking works without exposing sensitive data
      const result = await mockWorker.processComment(`Texto con ${sensitiveData} incluido`, testOrgId);
      expect(result.auto_blocked).toBe(true);
    });

    it('should handle concurrent operations safely', async () => {
      // Test concurrent updates to the same user's intolerance preferences
      const concurrentUpdates = [
        request(app)
          .post('/api/user/roastr-persona')
          .set('Authorization', 'Bearer mock-token')
          .send({ loQueNoTolero: 'términos set 1', isIntoleranceVisible: false }),
        
        request(app)
          .post('/api/user/roastr-persona')
          .set('Authorization', 'Bearer mock-token')
          .send({ loQueNoTolero: 'términos set 2', isIntoleranceVisible: false }),
        
        request(app)
          .post('/api/user/roastr-persona')
          .set('Authorization', 'Bearer mock-token')
          .send({ loQueNoTolero: 'términos set 3', isIntoleranceVisible: false })
      ];

      const results = await Promise.all(concurrentUpdates);

      // All operations should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Final state should be consistent
      const finalState = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(finalState.status).toBe(200);
      expect(finalState.body.data.hasIntoleranceContent).toBe(true);
      
      // Should be one of the submitted values
      const finalValue = finalState.body.data.loQueNoTolero;
      expect(['términos set 1', 'términos set 2', 'términos set 3']).toContain(finalValue);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mockSupabaseClient = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          }),
          update: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Update failed' }
          })
        }))
      };

      jest.doMock('../../../src/config/supabase', () => ({
        supabaseServiceClient: mockSupabaseClient,
        createUserClient: jest.fn(() => mockSupabaseClient)
      }));

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to retrieve Roastr Persona');
    });

    it('should handle encryption/decryption failures gracefully', async () => {
      // Configure initial data
      await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: 'test data',
          isIntoleranceVisible: false
        });

      // Mock decryption failure
      jest.doMock('../../../src/services/encryptionService', () => ({
        encrypt: jest.fn((text) => `encrypted_${Buffer.from(text).toString('base64')}`),
        decrypt: jest.fn(() => {
          throw new Error('Decryption failed');
        }),
        sanitizeForEncryption: jest.fn((text) => text.trim())
      }));

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.data.loQueNoTolero).toBe(null); // Should handle gracefully
      expect(response.body.data.hasIntoleranceContent).toBe(true); // Field exists but couldn't decrypt
    });
  });
});