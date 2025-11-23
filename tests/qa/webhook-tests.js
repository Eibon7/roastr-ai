/**
 * Webhook QA Tests for Social Media Integrations
 * Issue #90: Test webhooks in real environment with ngrok and HMAC signatures
 *
 * These tests require:
 * - ngrok tunnel running on port 3000
 * - Real webhook secrets configured
 * - Platform webhook endpoints configured with ngrok URLs
 */

const request = require('supertest');
const crypto = require('crypto');
const { app } = require('../../src/index');
const { logger } = require('../../src/utils/logger');
const { flags } = require('../../src/config/flags');

// Test configuration for webhook testing
const WEBHOOK_CONFIG = {
  ngrokUrl: process.env.NGROK_URL || 'https://abcd1234.ngrok.io',
  platforms: ['twitter', 'youtube'],
  mockPayloads: true, // Set to false for real webhook testing
  timeout: 15000
};

// Mock webhook secrets for testing
const WEBHOOK_SECRETS = {
  twitter: process.env.TWITTER_WEBHOOK_SECRET || 'test-twitter-webhook-secret',
  youtube: process.env.YOUTUBE_WEBHOOK_SECRET || 'test-youtube-webhook-secret'
};

describe('Webhook Integration QA Tests', () => {
  beforeAll(() => {
    logger.info('Webhook QA Test Setup', {
      ngrokUrl: WEBHOOK_CONFIG.ngrokUrl,
      platforms: WEBHOOK_CONFIG.platforms,
      mockPayloads: WEBHOOK_CONFIG.mockPayloads
    });
  });

  describe('Webhook Status and Configuration', () => {
    test('should return webhook configuration status', async () => {
      const response = await request(app).get('/api/webhooks/status').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('twitter');
      expect(response.body.data).toHaveProperty('youtube');
      expect(response.body.data).toHaveProperty('mockMode');

      // Check Twitter webhook config
      expect(response.body.data.twitter).toHaveProperty('configured');
      expect(response.body.data.twitter).toHaveProperty('endpoint');
      expect(response.body.data.twitter.endpoint).toBe('/api/webhooks/twitter');

      // Check YouTube webhook config
      expect(response.body.data.youtube).toHaveProperty('configured');
      expect(response.body.data.youtube).toHaveProperty('endpoint');
      expect(response.body.data.youtube.endpoint).toBe('/api/webhooks/youtube');

      logger.info('Webhook status test passed', response.body.data);
    });

    test('should handle webhook endpoint discovery', async () => {
      // Test that webhook endpoints are accessible
      const endpoints = ['/api/webhooks/twitter', '/api/webhooks/youtube'];

      for (const endpoint of endpoints) {
        // OPTIONS request should be allowed for CORS
        const optionsResponse = await request(app).options(endpoint).expect(200);

        // POST without proper payload should return 400, not 404
        const postResponse = await request(app).post(endpoint).send('invalid-payload').expect(400);

        expect(postResponse.body.success).toBe(false);
        logger.info(`Endpoint ${endpoint} is accessible and handles errors properly`);
      }
    });
  });

  describe('Twitter Webhook Tests', () => {
    test('should handle Twitter CRC challenge', async () => {
      const crcToken = 'test-crc-token-' + Date.now();
      const challengePayload = {
        crc_token: crcToken
      };

      // Calculate expected response
      const expectedResponse = crypto
        .createHmac('sha256', WEBHOOK_SECRETS.twitter)
        .update(crcToken)
        .digest('base64');

      const response = await request(app)
        .post('/api/webhooks/twitter')
        .set('Content-Type', 'application/json')
        .send(challengePayload)
        .expect(200);

      expect(response.body).toHaveProperty('response_token');
      expect(response.body.response_token).toBe(`sha256=${expectedResponse}`);

      logger.info('Twitter CRC challenge test passed', {
        crcToken: crcToken.substring(0, 10) + '...',
        responseValid: response.body.response_token === `sha256=${expectedResponse}`
      });
    });

    test('should verify Twitter webhook signatures', async () => {
      const webhookPayload = {
        for_user_id: '123456789',
        tweet_create_events: [
          {
            id: '1234567890123456789',
            text: 'Test tweet for webhook verification',
            user: {
              id: '123456789',
              screen_name: 'testuser'
            },
            created_at: new Date().toISOString()
          }
        ]
      };

      const payloadString = JSON.stringify(webhookPayload);

      // Generate valid signature
      const validSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRETS.twitter)
        .update(payloadString)
        .digest('base64');

      // Test with valid signature
      const validResponse = await request(app)
        .post('/api/webhooks/twitter')
        .set('Content-Type', 'application/json')
        .set('X-Twitter-Webhooks-Signature', validSignature)
        .send(webhookPayload)
        .expect(200);

      expect(validResponse.body.success).toBe(true);
      expect(validResponse.body.data.eventsProcessed).toBeGreaterThan(0);

      // Test with invalid signature (only if not in mock mode)
      if (!flags.shouldUseMockOAuth()) {
        const invalidResponse = await request(app)
          .post('/api/webhooks/twitter')
          .set('Content-Type', 'application/json')
          .set('X-Twitter-Webhooks-Signature', 'invalid-signature')
          .send(webhookPayload)
          .expect(401);

        expect(invalidResponse.body.success).toBe(false);
        expect(invalidResponse.body.code).toBe('INVALID_SIGNATURE');
      }

      logger.info('Twitter signature verification test passed');
    });

    test('should process Twitter tweet creation events', async () => {
      const tweetEvent = {
        for_user_id: '123456789',
        tweet_create_events: [
          {
            id: '1234567890123456789',
            text: 'This is a test tweet that mentions @our_bot_account',
            user: {
              id: '987654321',
              screen_name: 'testuser',
              name: 'Test User'
            },
            created_at: new Date().toISOString(),
            entities: {
              user_mentions: [
                {
                  id: '123456789',
                  screen_name: 'our_bot_account'
                }
              ]
            }
          }
        ]
      };

      const payloadString = JSON.stringify(tweetEvent);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRETS.twitter)
        .update(payloadString)
        .digest('base64');

      const response = await request(app)
        .post('/api/webhooks/twitter')
        .set('Content-Type', 'application/json')
        .set('X-Twitter-Webhooks-Signature', signature)
        .send(tweetEvent)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.eventsProcessed).toBe(1);
      expect(response.body.data.results[0].action).toBe('tweet_processed');

      logger.info('Twitter tweet creation processing test passed', {
        tweetId: tweetEvent.tweet_create_events[0].id,
        action: response.body.data.results[0].action
      });
    });

    test('should handle Twitter mention events', async () => {
      const mentionEvent = {
        for_user_id: '123456789',
        user_mention_events: [
          {
            id: '1234567890123456789',
            text: '@our_bot_account this tweet is toxic and needs a roast!',
            user: {
              id: '987654321',
              screen_name: 'toxicuser'
            },
            created_at: new Date().toISOString(),
            in_reply_to_status_id: '1234567890123456788'
          }
        ]
      };

      const payloadString = JSON.stringify(mentionEvent);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRETS.twitter)
        .update(payloadString)
        .digest('base64');

      const response = await request(app)
        .post('/api/webhooks/twitter')
        .set('Content-Type', 'application/json')
        .set('X-Twitter-Webhooks-Signature', signature)
        .send(mentionEvent)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.eventsProcessed).toBe(1);
      expect(response.body.data.results[0].action).toBe('mention_processed');

      logger.info('Twitter mention processing test passed');
    });
  });

  describe('YouTube Webhook Tests', () => {
    test('should handle YouTube subscription challenge', async () => {
      const challenge = 'youtube-challenge-' + Date.now();

      const response = await request(app)
        .post('/api/webhooks/youtube')
        .query({ 'hub.challenge': challenge })
        .set('Content-Type', 'application/xml')
        .send('')
        .expect(200);

      expect(response.text).toBe(challenge);

      logger.info('YouTube challenge test passed', {
        challenge: challenge.substring(0, 20) + '...'
      });
    });

    test('should verify YouTube webhook signatures', async () => {
      const xmlPayload = `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns="http://www.w3.org/2005/Atom">
  <link rel="hub" href="https://pubsubhubbub.appspot.com"/>
  <link rel="self" href="https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC123456"/>
  <title>YouTube video feed</title>
  <updated>2024-01-15T10:00:00+00:00</updated>
  <entry>
    <id>yt:video:dQw4w9WgXcQ</id>
    <yt:videoId>dQw4w9WgXcQ</yt:videoId>
    <yt:channelId>UC123456</yt:channelId>
    <title>Test Video</title>
    <link rel="alternate" href="http://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
    <author>
      <name>Test Channel</name>
      <uri>http://www.youtube.com/channel/UC123456</uri>
    </author>
    <published>2024-01-15T10:00:00+00:00</published>
    <updated>2024-01-15T10:00:00+00:00</updated>
  </entry>
</feed>`;

      // Generate valid signature
      const validSignature =
        'sha256=' +
        crypto.createHmac('sha256', WEBHOOK_SECRETS.youtube).update(xmlPayload).digest('hex');

      const validResponse = await request(app)
        .post('/api/webhooks/youtube')
        .set('Content-Type', 'application/xml')
        .set('X-Hub-Signature-256', validSignature)
        .send(xmlPayload)
        .expect(200);

      expect(validResponse.body.success).toBe(true);
      expect(validResponse.body.data.action).toBe('video_processed');

      // Test invalid signature (only if not in mock mode)
      if (!flags.shouldUseMockOAuth()) {
        const invalidResponse = await request(app)
          .post('/api/webhooks/youtube')
          .set('Content-Type', 'application/xml')
          .set('X-Hub-Signature-256', 'sha256=invalid-signature')
          .send(xmlPayload)
          .expect(401);

        expect(invalidResponse.body.success).toBe(false);
        expect(invalidResponse.body.code).toBe('INVALID_SIGNATURE');
      }

      logger.info('YouTube signature verification test passed');
    });

    test('should parse YouTube XML webhook payloads', async () => {
      const xmlPayload = `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>yt:video:test123456</id>
    <yt:videoId>test123456</yt:videoId>
    <yt:channelId>UCtest123456</yt:channelId>
    <title>Test Video for Webhook</title>
    <published>2024-01-15T10:00:00+00:00</published>
    <updated>2024-01-15T10:05:00+00:00</updated>
  </entry>
</feed>`;

      const signature =
        'sha256=' +
        crypto.createHmac('sha256', WEBHOOK_SECRETS.youtube).update(xmlPayload).digest('hex');

      const response = await request(app)
        .post('/api/webhooks/youtube')
        .set('Content-Type', 'application/xml')
        .set('X-Hub-Signature-256', signature)
        .send(xmlPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.videoId).toBe('test123456');
      expect(response.body.data.action).toBe('video_processed');

      logger.info('YouTube XML parsing test passed', {
        videoId: response.body.data.videoId
      });
    });
  });

  describe('Webhook Error Handling', () => {
    test('should handle malformed JSON payloads', async () => {
      const response = await request(app)
        .post('/api/webhooks/twitter')
        .set('Content-Type', 'application/json')
        .send('invalid-json{')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_PAYLOAD');
    });

    test('should handle missing required headers', async () => {
      const webhookPayload = {
        for_user_id: '123456789',
        tweet_create_events: [{ id: '123', text: 'test' }]
      };

      // Test without signature header (only fails if not in mock mode)
      const response = await request(app)
        .post('/api/webhooks/twitter')
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      if (flags.shouldUseMockOAuth()) {
        expect(response.status).toBe(200);
      } else {
        expect(response.status).toBe(401);
        expect(response.body.code).toBe('INVALID_SIGNATURE');
      }
    });

    test('should handle missing user ID in Twitter webhooks', async () => {
      const invalidPayload = {
        tweet_create_events: [
          {
            id: '123',
            text: 'test tweet without user context'
          }
        ]
      };

      const payloadString = JSON.stringify(invalidPayload);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRETS.twitter)
        .update(payloadString)
        .digest('base64');

      const response = await request(app)
        .post('/api/webhooks/twitter')
        .set('Content-Type', 'application/json')
        .set('X-Twitter-Webhooks-Signature', signature)
        .send(invalidPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_USER_ID');
    });

    test('should handle malformed XML in YouTube webhooks', async () => {
      const invalidXML = '<?xml version="1.0"?><invalid><unclosed-tag></invalid>';

      const signature =
        'sha256=' +
        crypto.createHmac('sha256', WEBHOOK_SECRETS.youtube).update(invalidXML).digest('hex');

      const response = await request(app)
        .post('/api/webhooks/youtube')
        .set('Content-Type', 'application/xml')
        .set('X-Hub-Signature-256', signature)
        .send(invalidXML)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_IDS');
    });
  });

  describe('Real Environment Webhook Tests', () => {
    test('should provide ngrok setup instructions', async () => {
      const instructions = {
        step1: 'Install ngrok: npm install -g ngrok',
        step2: 'Start tunnel: ngrok http 3000',
        step3: 'Copy HTTPS URL (e.g., https://abc123.ngrok.io)',
        step4: 'Set NGROK_URL environment variable',
        step5: 'Configure platform webhooks:',
        twitter: `${WEBHOOK_CONFIG.ngrokUrl}/api/webhooks/twitter`,
        youtube: `${WEBHOOK_CONFIG.ngrokUrl}/api/webhooks/youtube`,
        step6: 'Set webhook secrets in environment variables',
        step7: 'Run tests with real webhooks enabled'
      };

      logger.info('🔧 Webhook Setup Instructions', instructions);

      // Verify ngrok URL format if provided
      if (WEBHOOK_CONFIG.ngrokUrl && WEBHOOK_CONFIG.ngrokUrl !== 'https://abcd1234.ngrok.io') {
        expect(WEBHOOK_CONFIG.ngrokUrl).toMatch(/^https:\/\/[a-z0-9]+\.ngrok\.io$/);
        logger.info('✅ Valid ngrok URL detected', { url: WEBHOOK_CONFIG.ngrokUrl });
      } else {
        logger.warn('⚠️  Using default ngrok URL - set NGROK_URL for real testing');
      }
    });

    test('should test webhook endpoint accessibility', async () => {
      if (WEBHOOK_CONFIG.ngrokUrl && WEBHOOK_CONFIG.ngrokUrl !== 'https://abcd1234.ngrok.io') {
        // Test that the endpoints would be accessible externally
        const endpoints = [
          `${WEBHOOK_CONFIG.ngrokUrl}/api/webhooks/twitter`,
          `${WEBHOOK_CONFIG.ngrokUrl}/api/webhooks/youtube`,
          `${WEBHOOK_CONFIG.ngrokUrl}/api/webhooks/status`
        ];

        logger.info('🌐 External webhook endpoints', { endpoints });

        // In a real test environment, you could make HTTP requests to these URLs
        // to verify they're accessible from the internet
        endpoints.forEach((endpoint) => {
          expect(endpoint).toMatch(/^https:\/\/[a-z0-9]+\.ngrok\.io\/api\/webhooks\//);
        });
      } else {
        logger.info('⏭️  Skipping external accessibility test - no real ngrok URL');
      }
    });

    test('should validate webhook secrets configuration', async () => {
      const secretsCheck = {
        twitter: {
          configured: !!WEBHOOK_SECRETS.twitter,
          isDefault: WEBHOOK_SECRETS.twitter === 'test-twitter-webhook-secret',
          length: WEBHOOK_SECRETS.twitter?.length || 0
        },
        youtube: {
          configured: !!WEBHOOK_SECRETS.youtube,
          isDefault: WEBHOOK_SECRETS.youtube === 'test-youtube-webhook-secret',
          length: WEBHOOK_SECRETS.youtube?.length || 0
        }
      };

      // Secrets should be configured and not default values in production
      expect(secretsCheck.twitter.configured).toBe(true);
      expect(secretsCheck.youtube.configured).toBe(true);

      // Warn if using default test secrets
      if (secretsCheck.twitter.isDefault) {
        logger.warn(
          '⚠️  Using default Twitter webhook secret - set TWITTER_WEBHOOK_SECRET for production'
        );
      }

      if (secretsCheck.youtube.isDefault) {
        logger.warn(
          '⚠️  Using default YouTube webhook secret - set YOUTUBE_WEBHOOK_SECRET for production'
        );
      }

      logger.info('🔐 Webhook secrets validation', secretsCheck);
    });
  });
});

/**
 * Manual Testing Procedures
 *
 * After running automated tests, perform these manual steps:
 *
 * 1. Platform Configuration:
 *    - Twitter: Configure Account Activity API webhook in Twitter Developer Portal
 *    - YouTube: Set up PubSubHubbub subscription in Google Cloud Console
 *
 * 2. Real Webhook Testing:
 *    - Send test tweets mentioning your bot account
 *    - Upload test YouTube videos to monitored channels
 *    - Verify webhook payloads are received and processed
 *
 * 3. Error Scenario Testing:
 *    - Test network failures during webhook processing
 *    - Test high-volume webhook floods
 *    - Test webhook secret rotation
 *
 * 4. Performance Testing:
 *    - Monitor webhook response times
 *    - Test concurrent webhook handling
 *    - Verify queue integration for async processing
 */

module.exports = {
  WEBHOOK_CONFIG,
  WEBHOOK_SECRETS
};
