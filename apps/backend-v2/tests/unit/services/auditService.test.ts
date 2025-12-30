/**
 * Audit Service Tests v2
 *
 * Tests unitarios para auditService.
 * Issue: ROA-407 - A3 Auth Policy Wiring v2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabaseAdmin
const mockSupabaseInsert = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();

const mockFrom = vi.fn(() => ({
  insert: mockSupabaseInsert
}));

vi.mock('../../../src/lib/supabaseClient.js', () => ({
  supabase: {
    from: mockFrom
  }
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import auditService AFTER mocks
const { auditService } = await import('../../../src/services/auditService.js');
const { AuditEvent } = await import('../../../src/services/auditService.js');

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain: insert().select().single()
    mockSupabaseSingle.mockResolvedValue({
      data: { id: 'audit-123' },
      error: null
    });
    mockSupabaseSelect.mockReturnValue({
      single: mockSupabaseSingle
    });
    mockSupabaseInsert.mockReturnValue({
      select: mockSupabaseSelect
    });

    mockFrom.mockReturnValue({
      insert: mockSupabaseInsert
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logEvent', () => {
    it('should log event successfully', async () => {
      const event: typeof AuditEvent = {
        action_type: 'auth.login.success',
        resource_type: 'auth',
        resource_id: 'user-123',
        admin_user_id: 'user-123',
        description: 'User logged in',
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        severity: 'low'
      };

      const result = await auditService.logEvent(event);

      expect(result.success).toBe(true);
      expect(result.event_id).toBe('audit-123');
      expect(mockSupabaseInsert).toHaveBeenCalledWith({
        admin_user_id: 'user-123',
        action_type: 'auth.login.success',
        resource_type: 'auth',
        resource_id: 'user-123',
        old_value: null,
        new_value: null,
        description: 'User logged in',
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0'
      });
    });

    it('should handle missing required fields', async () => {
      const event = {
        // Missing action_type
        resource_type: 'auth',
        severity: 'low'
      } as any;

      const result = await auditService.logEvent(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
      expect(mockSupabaseInsert).not.toHaveBeenCalled();
    });
  });

  describe('logLoginSuccess', () => {
    it('should log login success', async () => {
      await auditService.logLoginSuccess('user-123', '127.0.0.1', 'Mozilla/5.0');

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'auth.login.success',
          resource_type: 'auth',
          resource_id: 'user-123',
          admin_user_id: 'user-123',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          description: 'User logged in successfully'
        })
      );
    });
  });

  describe('logLoginFailed', () => {
    it('should log login failed', async () => {
      await auditService.logLoginFailed(
        'user@example.com',
        'invalid_credentials',
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'auth.login.failed',
          resource_type: 'auth',
          resource_id: 'user@example.com',
          description: 'Login failed: invalid_credentials',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0'
        })
      );
    });
  });
});
