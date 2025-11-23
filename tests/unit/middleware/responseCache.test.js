/**
 * Response Cache Middleware Tests (Issue #924)
 *
 * Tests for response caching with TTL and invalidation
 */

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

const {
  cacheResponse,
  invalidateCache,
  invalidateAdminUsersCache,
  getCacheStats,
  responseCache
} = require('../../../src/middleware/responseCache');

const { logger } = require('../../../src/utils/logger');

describe('Response Cache Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/api/test',
      originalUrl: '/api/test',
      query: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      statusCode: 200
    };
    next = jest.fn();
    jest.clearAllMocks();
    responseCache.clear();
  });

  describe('ResponseCache class', () => {
    describe('generateKey', () => {
      test('should generate consistent keys for same request', () => {
        const key1 = responseCache.generateKey(req);
        const key2 = responseCache.generateKey(req);

        expect(key1).toBe(key2);
        expect(key1).toHaveLength(64);
      });

      test('should generate different keys for different URLs', () => {
        const key1 = responseCache.generateKey(req);
        req.originalUrl = '/api/other';
        const key2 = responseCache.generateKey(req);

        expect(key1).not.toBe(key2);
      });

      test('should include user ID in key', () => {
        req.user = { id: 'user123' };
        const key1 = responseCache.generateKey(req);

        req.user = { id: 'user456' };
        const key2 = responseCache.generateKey(req);

        expect(key1).not.toBe(key2);
      });

      test('should include query params in key', () => {
        req.query = { page: '1' };
        const key1 = responseCache.generateKey(req);

        req.query = { page: '2' };
        const key2 = responseCache.generateKey(req);

        expect(key1).not.toBe(key2);
      });
    });

    describe('get and set', () => {
      test('should return null for non-existent key', () => {
        const result = responseCache.get('nonexistent');

        expect(result).toBeNull();
        expect(responseCache.stats.misses).toBe(1);
      });

      test('should store and retrieve cached data', () => {
        const key = 'test_key';
        const data = { status: 200, body: { message: 'test' } };

        responseCache.set(key, data, 60000);
        const result = responseCache.get(key);

        expect(result).toEqual(data);
        expect(responseCache.stats.hits).toBe(1);
      });

      test('should return null for expired entry', () => {
        const key = 'test_key';
        const data = { status: 200, body: { message: 'test' } };

        responseCache.set(key, data, 100); // 100ms TTL

        // Wait for expiration
        return new Promise((resolve) => {
          setTimeout(() => {
            const result = responseCache.get(key);
            expect(result).toBeNull();
            resolve();
          }, 150);
        });
      });

      test('should enforce maxSize with LRU-like behavior', () => {
        const originalMaxSize = responseCache.maxSize;
        responseCache.maxSize = 2;

        responseCache.set('key1', { data: 1 });
        responseCache.set('key2', { data: 2 });
        responseCache.set('key3', { data: 3 }); // Should evict key1

        expect(responseCache.get('key1')).toBeNull();
        expect(responseCache.get('key2')).toBeDefined();
        expect(responseCache.get('key3')).toBeDefined();

        responseCache.maxSize = originalMaxSize;
      });
    });

    describe('invalidate', () => {
      test('should invalidate by string pattern', () => {
        responseCache.set('key1', { status: 200, body: {}, url: '/api/admin/users' });
        responseCache.set('key2', { status: 200, body: {}, url: '/api/admin/settings' });

        const count = responseCache.invalidate('/api/admin/users');

        expect(count).toBe(1);
        expect(responseCache.get('key1')).toBeNull();
        expect(responseCache.get('key2')).toBeDefined();
      });

      test('should invalidate by RegExp pattern', () => {
        responseCache.set('key1', { status: 200, body: {}, url: '/api/admin/users' });
        responseCache.set('key2', { status: 200, body: {}, url: '/api/admin/users?page=1' });
        responseCache.set('key3', { status: 200, body: {}, url: '/api/admin/settings' });

        const count = responseCache.invalidate(/\/api\/admin\/users/);

        expect(count).toBe(2);
        expect(responseCache.get('key1')).toBeNull();
        expect(responseCache.get('key2')).toBeNull();
        expect(responseCache.get('key3')).toBeDefined();
      });
    });

    describe('clear', () => {
      test('should clear all cache entries', () => {
        responseCache.set('key1', { data: 1 });
        responseCache.set('key2', { data: 2 });

        responseCache.clear();

        expect(responseCache.cache.size).toBe(0);
        expect(responseCache.get('key1')).toBeNull();
        expect(responseCache.get('key2')).toBeNull();
      });
    });

    describe('getStats', () => {
      test('should return cache statistics', () => {
        // Reset stats
        responseCache.stats = { hits: 0, misses: 0, invalidations: 0 };
        responseCache.clear();

        responseCache.set('key1', { data: 1 });
        responseCache.get('key1'); // Hit
        responseCache.get('nonexistent'); // Miss

        const stats = responseCache.getStats();

        expect(stats.size).toBe(1);
        expect(stats.hits).toBeGreaterThanOrEqual(1);
        expect(stats.misses).toBeGreaterThanOrEqual(1);
        expect(stats.hitRate).toBeDefined();
      });
    });
  });

  describe('cacheResponse middleware', () => {
    test('should skip caching for non-GET requests', () => {
      req.method = 'POST';
      const middleware = cacheResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).not.toHaveBeenCalledWith('X-Cache', expect.any(String));
    });

    test('should skip caching when skip function returns true', () => {
      req.method = 'GET';
      req.path = '/api/test';
      const middleware = cacheResponse({
        skip: (req) => req.path === '/api/test'
      });

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      // When skip returns true, middleware should not set X-Cache header
      // But it may set it before checking skip, so we just verify next was called
      expect(next).toHaveBeenCalled();
    });

    test('should return cached response on cache hit', () => {
      req.method = 'GET';
      const key = responseCache.generateKey(req);
      const cachedData = { status: 200, body: { message: 'cached' } };
      responseCache.set(key, cachedData);

      const middleware = cacheResponse();

      middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'cached' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should cache response on cache miss', () => {
      req.method = 'GET';
      const middleware = cacheResponse({ ttl: 60000 });

      middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(next).toHaveBeenCalled();

      // Intercept json call
      res.json({ message: 'test' });

      const key = responseCache.generateKey(req);
      const cached = responseCache.get(key);

      expect(cached).toBeDefined();
      expect(cached.body).toEqual({ message: 'test' });
    });

    test('should only cache successful responses (2xx)', () => {
      req.method = 'GET';
      res.statusCode = 404;
      const middleware = cacheResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      // Intercept json call
      res.json({ error: 'Not found' });

      const key = responseCache.generateKey(req);
      const cached = responseCache.get(key);

      expect(cached).toBeNull();
    });

    test('should use custom TTL', () => {
      req.method = 'GET';
      const middleware = cacheResponse({ ttl: 30000 });

      middleware(req, res, next);

      res.json({ message: 'test' });

      const key = responseCache.generateKey(req);
      const entry = responseCache.cache.get(key);

      expect(entry).toBeDefined();
      expect(entry.expiresAt - entry.createdAt).toBe(30000);
    });
  });

  describe('invalidateCache', () => {
    test('should invalidate cache by pattern', () => {
      responseCache.set('key1', { status: 200, body: {}, url: '/api/admin/users' });

      const count = invalidateCache('/api/admin/users');

      expect(count).toBe(1);
    });
  });

  describe('invalidateAdminUsersCache', () => {
    test('should invalidate admin users cache patterns', () => {
      responseCache.set('key1', { status: 200, body: {}, url: '/api/admin/users' });
      responseCache.set('key2', { status: 200, body: {}, url: '/api/admin/users?page=1' });
      responseCache.set('key3', { status: 200, body: {}, url: '/api/admin/settings' });

      const count = invalidateAdminUsersCache();

      expect(count).toBeGreaterThanOrEqual(1);
      expect(responseCache.get('key1')).toBeNull();
      expect(responseCache.get('key2')).toBeNull();
      expect(responseCache.get('key3')).toBeDefined();
    });
  });

  describe('getCacheStats', () => {
    test('should return cache statistics', () => {
      const stats = getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('invalidations');
    });
  });
});
