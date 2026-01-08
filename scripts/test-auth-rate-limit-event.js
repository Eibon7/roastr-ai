#!/usr/bin/env node
/**
 * Test script for auth_rate_limited event emission
 * 
 * This simulates the event that would be sent when authPolicyGate blocks a request.
 * In production, this event flows through logger.info() and can be consumed by
 * analytics services (Amplitude, etc.)
 */

const { logger } = require('../src/utils/logger');

// Simulate auth_rate_limited event
const testEvent = {
  event: 'auth_rate_limited',
  flow: 'auth',
  auth_action: 'auth_login',
  retryable: true,
  policy: 'rate_limit',
  scope: 'auth',
  request_id: 'test-' + Date.now()
};

console.log('📊 Sending test event: auth_rate_limited');
console.log('Event payload:', JSON.stringify(testEvent, null, 2));

// Emit event (same way authPolicyGate does)
logger.info('auth_rate_limited_event', testEvent);

console.log('✅ Event sent successfully!');
console.log('\nIn production, this event would be:');
console.log('1. Logged with structured format');
console.log('2. Consumed by analytics service');
console.log('3. Sent to Amplitude (if configured)');
console.log('\nEvent details:');
console.log('- Event name: auth_rate_limited');
console.log('- Flow: auth');
console.log('- Action: auth_login');
console.log('- Retryable: true');
console.log('- Scope: auth');
console.log('- Request ID:', testEvent.request_id);

