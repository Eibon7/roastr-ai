#!/usr/bin/env node

/**
 * Redis/Upstash Connection Verification Script
 * 
 * Verifies that Redis/Upstash is properly configured and accessible.
 * Critical for Disk IO optimization - Redis reduces DB queries by 95%.
 * 
 * Usage:
 *   node scripts/verify-redis-connection.js
 */

require('dotenv').config();
const { Redis } = require('@upstash/redis');

async function verifyRedisConnection() {
  console.log('\n🔍 Verifying Redis/Upstash Connection...\n');

  // Check environment variables
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const preferRedis = process.env.QUEUE_PREFER_REDIS !== 'false';

  console.log('Configuration:');
  console.log(`  REDIS_URL: ${redisUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`  REDIS_TOKEN: ${redisToken ? '✅ Set' : '❌ Missing'}`);
  console.log(`  QUEUE_PREFER_REDIS: ${preferRedis ? '✅ Enabled' : '⚠️  Disabled'}`);
  console.log('');

  if (!redisUrl) {
    console.error('❌ ERROR: Redis URL not configured');
    console.error('\nTo fix:');
    console.error('  1. Get Upstash Redis (free tier): https://upstash.com/');
    console.error('  2. Add to .env:');
    console.error('     UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io');
    console.error('     UPSTASH_REDIS_REST_TOKEN=your_token_here');
    console.error('     QUEUE_PREFER_REDIS=true');
    process.exit(1);
  }

  // Try to connect with Upstash SDK
  let redis;
  try {
    // Initialize Upstash Redis (REST SDK - much simpler!)
    if (redisUrl && redisToken) {
      redis = new Redis({
        url: redisUrl,
        token: redisToken
      });
    } else {
      throw new Error('Upstash credentials not properly configured');
    }

    console.log('🔌 Connecting to Redis...');
    const pong = await redis.ping();
    
    if (pong === 'PONG') {
      console.log('✅ Redis connection successful!\n');
      
      // Test basic operations
      console.log('🧪 Testing operations...');

      // SET (with short TTL to avoid stray keys)
      await redis.set('roastr:test:connection', 'ok', { ex: 10 });
      console.log('  ✅ SET operation');

      // GET
      const value = await redis.get('roastr:test:connection');
      if (value === 'ok') {
        console.log('  ✅ GET operation');
      } else {
        throw new Error('GET returned unexpected value');
      }

      // DEL
      await redis.del('roastr:test:connection');
      console.log('  ✅ DEL operation');

      // Get Redis info (optional - may fail with read-only tokens)
      try {
        const info = await redis.info('server');
        const versionMatch = info.match(/redis_version:([^\r\n]+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        console.log('\n📊 Redis Info:');
        console.log(`  Version: ${version}`);
      } catch (infoError) {
        // INFO command may be restricted on read-only tokens - non-fatal
        console.log('\n📊 Redis Info: (unavailable with current token permissions)');
      }

      console.log(`  Type: Upstash (REST SDK)`);

      console.log('\n✅ Redis is fully operational!');
      console.log('\n💡 Your workers will use Redis for queue management,');
      console.log('   reducing Disk IO by ~95% compared to database-only mode.\n');

      // Note: Upstash SDK is stateless (REST), no need to disconnect
      process.exit(0);
    } else {
      throw new Error('Unexpected PING response');
    }
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Verify UPSTASH_REDIS_REST_URL is correct');
    console.error('  2. Verify UPSTASH_REDIS_REST_TOKEN is valid');
    console.error('  3. Check network connectivity');
    console.error('  4. For Upstash, ensure you\'re using the REST URL format');
    console.error('\n⚠️  Workers will fallback to database (higher Disk IO)');
    process.exit(1);
  }
}

verifyRedisConnection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

