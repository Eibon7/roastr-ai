/**
 * Unit tests for Perspective service
 * Tests the real Perspective API implementation with mocked HTTP calls
 */

const PerspectiveService = require('../../../src/services/perspective');
const axios = require('axios');

jest.mock('axios');

describe('Perspective Service Tests', () => {
  let perspectiveService;

  beforeEach(() => {
    perspectiveService = new PerspectiveService('test-api-key');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with API key', () => {
      const service = new PerspectiveService('test-perspective-key');
      expect(service.apiKey).toBe('test-perspective-key');
    });

    it('should handle undefined API key', () => {
      const service = new PerspectiveService();
      expect(service.apiKey).toBeUndefined();
    });

    it('should use environment variable if no key provided', () => {
      const originalKey = process.env.PERSPECTIVE_API_KEY;
      process.env.PERSPECTIVE_API_KEY = 'env-test-key';

      const service = new PerspectiveService();
      expect(service.apiKey).toBe('env-test-key');

      process.env.PERSPECTIVE_API_KEY = originalKey;
    });

    it('should handle special characters in API key', () => {
      const specialKey = 'AIzaSyC-special_chars.123-ABC_def';
      const service = new PerspectiveService(specialKey);
      expect(service.apiKey).toBe(specialKey);
    });

    it('should initialize with correct defaults', () => {
      const service = new PerspectiveService('test-key');
      expect(service.maxRetries).toBe(3);
      expect(service.retryDelay).toBe(1000);
      expect(service.rateLimitDelay).toBe(1000);
    });
  });

  describe('analyzeToxicity method', () => {
    it('should throw error if no API key configured', async () => {
      const serviceWithoutKey = new PerspectiveService();
      serviceWithoutKey.apiKey = null;

      await expect(serviceWithoutKey.analyzeToxicity('test text')).rejects.toThrow(
        'Perspective API key not configured'
      );
    });

    it('should throw error for invalid text input', async () => {
      await expect(perspectiveService.analyzeToxicity(null)).rejects.toThrow(
        'Invalid text input for toxicity analysis'
      );

      await expect(perspectiveService.analyzeToxicity(123)).rejects.toThrow(
        'Invalid text input for toxicity analysis'
      );
    });

    it('should successfully analyze text with valid response', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.85 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.6 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.2 } },
            INSULT: { summaryScore: { value: 0.7 } },
            PROFANITY: { summaryScore: { value: 0.4 } },
            THREAT: { summaryScore: { value: 0.1 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await perspectiveService.analyzeToxicity('test toxic comment');

      expect(result).toHaveProperty('toxicityScore', 0.85);
      expect(result).toHaveProperty('severity', 'high');
      expect(result.categories).toContain('insult');
      expect(result.scores.toxicity).toBe(0.85);
    });

    it('should truncate text longer than 3000 characters', async () => {
      const longText = 'a'.repeat(4000);
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.1 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.0 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await perspectiveService.analyzeToxicity(longText);

      // Verify the request was made with truncated text
      const requestBody = axios.post.mock.calls[0][1];
      expect(requestBody.comment.text.length).toBe(3000);
      expect(result).toHaveProperty('toxicityScore');
    });

    it('should handle text with special characters', async () => {
      const specialText = 'Text with émojis 🔥 and símböls!@#$%^&*()';
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.3 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.1 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.2 } },
            PROFANITY: { summaryScore: { value: 0.1 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await perspectiveService.analyzeToxicity(specialText);
      expect(result).toHaveProperty('toxicityScore', 0.3);
    });
  });

  describe('Severity level calculation', () => {
    it('should return "critical" for severe toxicity >= 0.95', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.9 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.95 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);
      const result = await perspectiveService.analyzeToxicity('critical content');
      expect(result.severity).toBe('critical');
    });

    it('should return "high" for toxicity >= 0.85', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.85 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.5 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);
      const result = await perspectiveService.analyzeToxicity('high toxicity');
      expect(result.severity).toBe('high');
    });

    it('should return "medium" for toxicity >= 0.6', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.6 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.3 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);
      const result = await perspectiveService.analyzeToxicity('medium toxicity');
      expect(result.severity).toBe('medium');
    });

    it('should return "low" for toxicity >= 0.4', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.4 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.1 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);
      const result = await perspectiveService.analyzeToxicity('low toxicity');
      expect(result.severity).toBe('low');
    });

    it('should return "clean" for toxicity < 0.4', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.1 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.0 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);
      const result = await perspectiveService.analyzeToxicity('clean text');
      expect(result.severity).toBe('clean');
    });
  });

  describe('Category detection', () => {
    it('should identify dominant categories (score >= 0.7)', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.8 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.75 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.3 } },
            INSULT: { summaryScore: { value: 0.85 } },
            PROFANITY: { summaryScore: { value: 0.9 } },
            THREAT: { summaryScore: { value: 0.2 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);
      const result = await perspectiveService.analyzeToxicity('multi-category toxic');

      expect(result.categories).toContain('severe_toxicity');
      expect(result.categories).toContain('insult');
      expect(result.categories).toContain('profanity');
      expect(result.categories).not.toContain('threat');
      expect(result.categories).not.toContain('identity_attack');
    });

    it('should prioritize threat category', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.5 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.2 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.3 } },
            PROFANITY: { summaryScore: { value: 0.1 } },
            THREAT: { summaryScore: { value: 0.95 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);
      const result = await perspectiveService.analyzeToxicity('threatening message');

      expect(result.categories[0]).toBe('threat');
      expect(result.severity).toBe('critical');
    });
  });

  describe('Error handling', () => {
    it('should handle 400 Bad Request errors', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: {
              message: 'API key not valid'
            }
          }
        }
      };

      axios.post.mockRejectedValue(error);

      await expect(perspectiveService.analyzeToxicity('test')).rejects.toThrow(
        'Invalid request to Perspective API: API key not valid'
      );
    });

    it('should handle 401 Unauthorized errors', async () => {
      const error = {
        response: {
          status: 401
        }
      };

      axios.post.mockRejectedValue(error);

      await expect(perspectiveService.analyzeToxicity('test')).rejects.toThrow(
        'Perspective API authentication failed - check API key'
      );
    });

    it('should handle 403 Forbidden errors', async () => {
      const error = {
        response: {
          status: 403
        }
      };

      axios.post.mockRejectedValue(error);

      await expect(perspectiveService.analyzeToxicity('test')).rejects.toThrow(
        'Perspective API authentication failed - check API key'
      );
    });

    it('should retry on 429 Rate Limit errors', async () => {
      const error = {
        response: {
          status: 429
        }
      };

      const mockSuccess = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.1 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.0 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      // Fail first time, succeed second time
      axios.post.mockRejectedValueOnce(error).mockResolvedValueOnce(mockSuccess);

      const result = await perspectiveService.analyzeToxicity('test');
      expect(result).toHaveProperty('toxicityScore');
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 Server errors', async () => {
      const error = {
        response: {
          status: 500
        }
      };

      const mockSuccess = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.1 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.0 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockRejectedValueOnce(error).mockResolvedValueOnce(mockSuccess);

      const result = await perspectiveService.analyzeToxicity('test');
      expect(result).toHaveProperty('toxicityScore');
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const error = {
        response: {
          status: 429
        }
      };

      // Mock to reject all 3 attempts
      axios.post
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      await expect(perspectiveService.analyzeToxicity('test')).rejects.toBeDefined();

      // Should retry 3 times
      expect(axios.post).toHaveBeenCalledTimes(3);
    });
  });

  describe('Health check', () => {
    it('should return healthy status when API is operational', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.0 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.0 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const health = await perspectiveService.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.message).toBe('Perspective API operational');
    });

    it('should return unhealthy status when API key not configured', async () => {
      const serviceWithoutKey = new PerspectiveService();
      serviceWithoutKey.apiKey = null;

      const health = await serviceWithoutKey.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.error).toBe('API key not configured');
    });

    it('should return unhealthy status on API errors', async () => {
      const error = {
        response: {
          status: 401
        }
      };

      axios.post.mockRejectedValue(error);

      const health = await perspectiveService.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.error).toBeTruthy();
    });
  });

  describe('Service interface compliance', () => {
    it('should have analyzeToxicity method', () => {
      expect(typeof perspectiveService.analyzeToxicity).toBe('function');
    });

    it('should have apiKey property', () => {
      expect(perspectiveService).toHaveProperty('apiKey');
    });

    it('should be instance of PerspectiveService', () => {
      expect(perspectiveService).toBeInstanceOf(PerspectiveService);
    });

    it('should have healthCheck method', () => {
      expect(typeof perspectiveService.healthCheck).toBe('function');
    });
  });

  describe('Response metadata', () => {
    it('should include metadata in response', async () => {
      const mockResponse = {
        data: {
          attributeScores: {
            TOXICITY: { summaryScore: { value: 0.5 } },
            SEVERE_TOXICITY: { summaryScore: { value: 0.0 } },
            IDENTITY_ATTACK: { summaryScore: { value: 0.0 } },
            INSULT: { summaryScore: { value: 0.0 } },
            PROFANITY: { summaryScore: { value: 0.0 } },
            THREAT: { summaryScore: { value: 0.0 } }
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await perspectiveService.analyzeToxicity('test text');

      expect(result.metadata).toBeDefined();
      expect(result.metadata.textLength).toBe(9);
      expect(result.metadata.provider).toBe('perspective-api');
      expect(result.metadata.timestamp).toBeDefined();
    });
  });
});
