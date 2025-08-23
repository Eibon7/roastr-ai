const request = require('supertest');
const app = require('../../../src/index');

describe('Core System Health', () => {
  describe('API Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String)
      });
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('Core Services Availability', () => {
    it('should verify queue service is available', async () => {
      const QueueService = require('../../../src/services/queueService');
      const queueService = new QueueService();

      expect(queueService).toBeDefined();
      expect(typeof queueService.add).toBe('function');
    });

    it('should verify shield service is available', async () => {
      const ShieldService = require('../../../src/services/shieldService');
      const shieldService = new ShieldService();

      expect(shieldService).toBeDefined();
      expect(typeof shieldService.analyzeComment).toBe('function');
    });
  });
});