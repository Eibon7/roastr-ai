/**
 * Central Mock Mode Configuration
 * 
 * Controls whether the application uses real APIs or mock responses
 * Switch: ENABLE_MOCK_MODE=true/false
 */

class MockModeManager {
  constructor() {
    this.isMockMode = this.shouldUseMockMode();
    this.logMockStatus();
  }

  shouldUseMockMode() {
    // Force mock mode in test environment
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    
    // Check explicit mock mode setting
    if (process.env.ENABLE_MOCK_MODE === 'true') {
      return true;
    }
    
    // Auto-detect mock mode if critical keys are missing
    const criticalKeys = [
      'OPENAI_API_KEY',
      'SUPABASE_URL', 
      'SUPABASE_SERVICE_KEY'
    ];
    
    const missingKeys = criticalKeys.filter(key => !process.env[key] || process.env[key].startsWith('mock'));
    
    return missingKeys.length > 0;
  }

  logMockStatus() {
    if (this.isMockMode) {
      console.log('🎭 Mock Mode ENABLED - Using fake data for all external APIs');
    } else {
      console.log('🔗 Real Mode ENABLED - Using real API connections');
    }
  }

  // API Mock Generators
  generateMockSupabaseClient() {
    // Initialize global mock storage for stateful operations
    if (typeof global !== 'undefined') {
      global.mockCommentStorage = global.mockCommentStorage || [];
      global.mockJobStorage = global.mockJobStorage || [];
      global.mockOrgStorage = global.mockOrgStorage || [];
      global.mockConfigStorage = global.mockConfigStorage || [];
    }
    return {
      auth: {
        signInWithPassword: () => Promise.resolve({
          data: { user: { id: 'mock-user-123', email: 'test@example.com' } },
          error: null
        }),
        signUp: () => Promise.resolve({
          data: { user: { id: 'mock-user-123', email: 'test@example.com' } },
          error: null
        }),
        signOut: () => Promise.resolve({ error: null }),
        getUser: () => Promise.resolve({
          data: { user: { id: 'mock-user-123', email: 'test@example.com' } },
          error: null
        }),
        onAuthStateChange: (callback) => {
          callback('SIGNED_IN', { id: 'mock-user-123', email: 'test@example.com' });
          return { data: { subscription: { unsubscribe: () => {} } } };
        }
      },
      from: (table) => {
        const queries = {}; // Store query conditions
        
        const chainable = {
          select: (columns = '*') => {
            queries.select = columns;
            return chainable;
          },
          eq: (column, value) => {
            queries[column] = value;
            return chainable;
          },
          single: () => {
            if (table === 'integration_configs') {
              return Promise.resolve({
                data: {
                  id: queries.id || 'mock-config-id',
                  organization_id: queries.organization_id || 'test-org-dedup',
                  platform: queries.platform || 'twitter',
                  enabled: true,
                  config: { monitor_mentions: true }
                },
                error: null
              });
            }
            
            if (table === 'organizations') {
              return Promise.resolve({
                data: { id: 'test-org', name: 'Test Organization' },
                error: null
              });
            }
            
            if (table === 'comments') {
              // Check if comment exists in global storage
              const storage = global.mockCommentStorage || [];
              console.log('🔍 Mock: Checking for existing comment with queries:', queries);
              console.log('🔍 Mock: Current storage has', storage.length, 'comments');
              
              const existing = storage.find(comment => 
                comment.organization_id === queries.organization_id &&
                comment.platform === queries.platform &&
                comment.platform_comment_id === queries.platform_comment_id
              );
              
              console.log('🔍 Mock: Found existing comment:', !!existing);
              
              if (existing) {
                return Promise.resolve({
                  data: existing,
                  error: null
                });
              } else {
                return Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116', message: 'No rows found' }
                });
              }
            }
            
            return Promise.resolve({
              data: { id: 1, name: 'Mock Data', created_at: new Date().toISOString() },
              error: null
            });
          },
          limit: (count) => chainable,
          order: (column, options) => chainable,
          upsert: (data, options) => Promise.resolve({ data, error: null }),
          insert: (data) => {
            // Store data in global storage if it's comments
            if (table === 'comments') {
              const storage = global.mockCommentStorage || [];
              const newComment = {
                ...data,
                id: storage.length + 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              console.log('🔍 Mock: Inserting new comment:', {
                platform_comment_id: newComment.platform_comment_id,
                organization_id: newComment.organization_id,
                platform: newComment.platform
              });
              storage.push(newComment);
              global.mockCommentStorage = storage;
              console.log('🔍 Mock: Storage now has', storage.length, 'comments');
            }
            
            const chainableInsert = {
              select: (columns = '*') => ({
                single: () => {
                  const result = Array.isArray(data) ? { ...data[0], id: 1 } : { ...data, id: 1 };
                  return Promise.resolve({
                    data: result,
                    error: null
                  });
                },
                then: (resolve) => {
                  resolve({
                    data: Array.isArray(data) ? data.map((item, i) => ({ ...item, id: i + 1 })) : [{ ...data, id: 1 }],
                    error: null
                  });
                }
              }),
              single: () => {
                const result = Array.isArray(data) ? { ...data[0], id: 1 } : { ...data, id: 1 };
                return Promise.resolve({
                  data: result,
                  error: null
                });
              }
            };
            return chainableInsert;
          },
          update: (data) => ({
            eq: (column, value) => Promise.resolve({
              data: [{ id: 1, ...data, updated_at: new Date().toISOString() }],
              error: null
            })
          }),
          delete: () => ({
            eq: (column, value) => Promise.resolve({ data: null, error: null }),
            like: (column, pattern) => Promise.resolve({ data: null, error: null })
          })
        };

        // Handle direct promise resolution for some methods
        Object.assign(chainable, {
          then: (resolve) => {
            if (table === 'comments') {
              resolve({
                data: [],
                error: null
              });
            } else {
              resolve({
                data: [{ id: 1, name: 'Mock Data', created_at: new Date().toISOString() }],
                error: null
              });
            }
          }
        });

        return chainable;
      },
      
      // RPC method for database functions (required by CostControlService)
      rpc: (functionName, params = {}) => {
        if (functionName === 'can_perform_operation') {
          return Promise.resolve({
            data: { 
              allowed: true, 
              reason: 'mock_allowed',
              current_usage: 0,
              limit: 1000,
              remaining: 1000
            },
            error: null
          });
        }
        
        if (functionName === 'record_usage') {
          return Promise.resolve({
            data: { 
              usage_recorded: true, 
              current_usage: params.amount || 1,
              total_usage: (params.amount || 1) * 2 
            },
            error: null
          });
        }
        
        if (functionName === 'increment_usage') {
          return Promise.resolve({
            data: { 
              usage_incremented: true,
              new_count: (params.increment || 1) + 5,
              limit_reached: false
            },
            error: null
          });
        }
        
        // Default RPC response for unknown functions
        return Promise.resolve({
          data: { mock_rpc_result: true, function: functionName },
          error: null
        });
      }
    };
  }

  generateMockOpenAI() {
    return {
      chat: {
        completions: {
          create: async (params) => ({
            choices: [
              {
                message: {
                  content: "🎭 This is a mock roast response! In real mode, this would be a witty comeback generated by OpenAI."
                }
              }
            ],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 20,
              total_tokens: 70
            }
          })
        }
      }
    };
  }

  generateMockStripe() {
    return {
      customers: {
        create: () => Promise.resolve({ id: 'cus_mock123', email: 'test@example.com' }),
        retrieve: () => Promise.resolve({ id: 'cus_mock123', email: 'test@example.com' })
      },
      subscriptions: {
        create: () => Promise.resolve({ id: 'sub_mock123', status: 'active' }),
        retrieve: () => Promise.resolve({ id: 'sub_mock123', status: 'active' })
      },
      prices: {
        list: () => Promise.resolve({
          data: [
            { id: 'price_mock_basic', unit_amount: 999, nickname: 'Basic Plan' },
            { id: 'price_mock_pro', unit_amount: 2999, nickname: 'Pro Plan' }
          ]
        })
      },
      webhooks: {
        constructEvent: () => ({ type: 'invoice.payment_succeeded', data: { object: {} } })
      }
    };
  }

  generateMockPerspective() {
    return {
      comments: {
        analyze: () => Promise.resolve({
          data: {
            attributeScores: {
              TOXICITY: { summaryScore: { value: 0.1 } },
              SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
              IDENTITY_ATTACK: { summaryScore: { value: 0.03 } }
            }
          }
        })
      }
    };
  }

  generateMockFetch() {
    return async (url, options = {}) => {
      console.log(`🎭 Mock fetch called: ${url}`);
      
      // Mock different API responses based on URL
      if (url.includes('/api/health')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
              database: 'mock',
              queue: 'mock', 
              ai: 'mock'
            }
          })
        };
      }
      
      if (url.includes('/api/logs')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            logs: [
              { id: 1, level: 'info', message: 'Mock log entry', timestamp: new Date().toISOString() },
              { id: 2, level: 'warn', message: 'Mock warning', timestamp: new Date().toISOString() }
            ],
            total: 2
          })
        };
      }

      if (url.includes('supabase')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ mock: true, data: [] })
        };
      }

      // Default mock response
      return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ mock: true, message: 'Mock API response' }),
        text: () => Promise.resolve('Mock response text')
      };
    };
  }
}

// Singleton instance
const mockMode = new MockModeManager();

module.exports = {
  mockMode,
  MockModeManager
};