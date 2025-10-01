/**
 * Central Mock Mode Configuration
 * 
 * Controls whether the application uses real APIs or mock responses
 * Switch: ENABLE_MOCK_MODE=true/false
 */

/**
 * MockModeManager handles switching between real and mock APIs
 * Automatically detects when to use mock mode based on environment
 * and missing API credentials
 */
class MockModeManager {
  constructor() {
    this.isMockMode = this.shouldUseMockMode();
    this.logMockStatus();
  }

  /**
   * Determines if the application should use mock mode
   * @returns {boolean} True if mock mode should be used
   */
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

  /**
   * Logs the current mock mode status to console
   */
  logMockStatus() {
    if (this.isMockMode) {
      console.log('🎭 Mock Mode ENABLED - Using fake data for all external APIs');
    } else {
      console.log('🔗 Real Mode ENABLED - Using real API connections');
    }
  }

  /**
   * Generates a mock Supabase client with stateful storage
   * Implements deduplication logic for comments table
   * @returns {Object} Mock Supabase client with full API compatibility
   */
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
        let currentQueries = {}; // Single queries object per table query
        
        const chainable = {
          select: (columns = '*') => {
            currentQueries.select = columns;
            return chainable;
          },
          eq: (column, value) => {
            currentQueries[column] = value;
            return chainable;
          },
          single: () => {
            // Make a copy of queries for this specific call to avoid pollution
            const queries = { ...currentQueries };
            
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
                // Return null data when no comment found (matches real Supabase behavior for .single())
                return Promise.resolve({
                  data: null,
                  error: null
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
            // Store data in global storage if it's comments with proper deduplication
            if (table === 'comments') {
              const storage = global.mockCommentStorage || [];
              
              // Check for existing comment to enforce deduplication
              const existing = storage.find(comment => 
                comment.organization_id === data.organization_id &&
                comment.platform === data.platform &&
                comment.platform_comment_id === data.platform_comment_id
              );
              
              if (existing) {
                console.log('🔍 Mock: Duplicate comment detected, not inserting:', {
                  platform_comment_id: data.platform_comment_id,
                  organization_id: data.organization_id,
                  platform: data.platform
                });
                
                // Return the existing comment instead of inserting duplicate
                const chainableInsert = {
                  select: (columns = '*') => {
                    const selectBuilder = {
                      single: () => Promise.resolve({
                        data: existing,
                        error: null
                      })
                    };
                    
                    // Return a Promise that resolves to the existing data
                    return Promise.resolve({
                      data: [existing],
                      error: null
                    }).then(result => {
                      // Attach single method for chaining
                      result.single = selectBuilder.single;
                      return result;
                    });
                  },
                  single: () => Promise.resolve({
                    data: existing,
                    error: null
                  })
                };
                return chainableInsert;
              }
              
              // Insert new comment since no duplicate found
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
              select: (columns = '*') => {
                const selectBuilder = {
                  single: () => {
                    const result = Array.isArray(data) ? { ...data[0], id: 1 } : { ...data, id: 1 };
                    return Promise.resolve({
                      data: result,
                      error: null
                    });
                  }
                };
                
                // Return a Promise that resolves to the data array
                return Promise.resolve({
                  data: Array.isArray(data) ? data.map((item, i) => ({ ...item, id: i + 1 })) : [{ ...data, id: 1 }],
                  error: null
                }).then(result => {
                  // Attach the single method to the resolved result for chaining
                  result.single = selectBuilder.single;
                  return result;
                });
              },
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

        // Convert chainable object to a proper Promise for direct awaiting
        const makePromiseCompatible = (obj) => {
          if (table === 'comments') {
            // Return filtered comments based on current queries
            const storage = global.mockCommentStorage || [];
            let filteredData = storage;
            
            // Apply filters based on current queries
            if (currentQueries.organization_id) {
              filteredData = filteredData.filter(c => c.organization_id === currentQueries.organization_id);
            }
            if (currentQueries.platform) {
              filteredData = filteredData.filter(c => c.platform === currentQueries.platform);
            }
            if (currentQueries.platform_comment_id) {
              filteredData = filteredData.filter(c => c.platform_comment_id === currentQueries.platform_comment_id);
            }
            
            return Promise.resolve({
              data: filteredData,
              error: null
            }).then(result => {
              // Attach chainable methods to the result
              Object.assign(result, obj);
              return result;
            });
          } else {
            return Promise.resolve({
              data: [{ id: 1, name: 'Mock Data', created_at: new Date().toISOString() }],
              error: null
            }).then(result => {
              // Attach chainable methods to the result
              Object.assign(result, obj);
              return result;
            });
          }
        };
        
        // Make the chainable object act like a Promise
        return Object.assign(chainable, {
          then: (onFulfilled, onRejected) => {
            return makePromiseCompatible(chainable).then(onFulfilled, onRejected);
          },
          catch: (onRejected) => {
            return makePromiseCompatible(chainable).catch(onRejected);
          }
        });
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

  /**
   * Generates a mock OpenAI client for testing
   * Provides chat completions API with consistent mock responses
   * @returns {Object} Mock OpenAI client with chat.completions.create method
   */
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

  /**
   * Generates a mock Stripe client for billing/payment testing
   * Provides customers, subscriptions, prices, and webhooks APIs
   * @returns {Object} Mock Stripe client with payment operation methods
   */
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

  /**
   * Generates a mock Perspective API client for toxicity analysis testing
   * Provides comment.analyze method with consistent low-toxicity scores
   * @returns {Object} Mock Perspective API client with analyze capabilities
   */
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

  /**
   * Generates a mock fetch function for HTTP request testing
   * Provides URL-based response routing for health checks, logs, and API calls
   * @returns {Function} Mock fetch function compatible with native fetch API
   */
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