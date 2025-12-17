/**
 * Tests for Auth Events Taxonomy v2
 * ROA-357
 */

const {
  AUTH_EVENTS_TAXONOMY_V2,
  buildEventId,
  parseEventId,
  getEventConfig,
  mapV1ToV2,
  getAllV2EventIds,
  isValidV2EventId,
  getFlatEventTypes
} = require('../../../src/config/authEventsTaxonomy');

describe('Auth Events Taxonomy v2', () => {
  describe('buildEventId', () => {
    it('should build event ID from path array', () => {
      expect(buildEventId(['session', 'login', 'success'])).toBe(
        'auth.session.login.success'
      );
      expect(buildEventId(['password', 'reset', 'requested'])).toBe(
        'auth.password.reset.requested'
      );
    });

    it('should throw error for empty path', () => {
      expect(() => buildEventId([])).toThrow('Path must be a non-empty array');
    });

    it('should throw error for invalid path', () => {
      expect(() => buildEventId(null)).toThrow('Path must be a non-empty array');
    });
  });

  describe('parseEventId', () => {
    it('should parse event ID into path array', () => {
      expect(parseEventId('auth.session.login.success')).toEqual([
        'session',
        'login',
        'success'
      ]);
      expect(parseEventId('auth.password.reset.requested')).toEqual([
        'password',
        'reset',
        'requested'
      ]);
    });

    it('should throw error for invalid event ID', () => {
      expect(() => parseEventId('invalid.event')).toThrow(
        'Event ID must start with "auth."'
      );
      expect(() => parseEventId(null)).toThrow(
        'Event ID must start with "auth."'
      );
    });
  });

  describe('getEventConfig', () => {
    it('should get event config for valid v2 event ID', () => {
      const config = getEventConfig('auth.session.login.success');
      expect(config).toBeDefined();
      expect(config.severity).toBe('info');
      expect(config.description).toBe('User successfully logged in');
      expect(config.v1Mapping).toBe('auth.login');
    });

    it('should get event config for password reset requested', () => {
      const config = getEventConfig('auth.password.reset.requested');
      expect(config).toBeDefined();
      expect(config.severity).toBe('warning');
      expect(config.description).toBe('Password reset requested');
      expect(config.v1Mapping).toBe('auth.reset_request');
    });

    it('should return null for invalid event ID', () => {
      expect(getEventConfig('auth.invalid.event')).toBeNull();
      expect(getEventConfig('auth.session.invalid')).toBeNull();
    });
  });

  describe('mapV1ToV2', () => {
    it('should map v1 login to v2', () => {
      expect(mapV1ToV2('auth.login')).toBe('auth.session.login.success');
    });

    it('should map v1 logout to v2', () => {
      expect(mapV1ToV2('auth.logout')).toBe('auth.session.logout.manual');
    });

    it('should map v1 failed_login to v2', () => {
      expect(mapV1ToV2('auth.failed_login')).toBe('auth.session.login.failed');
    });

    it('should map v1 reset_request to v2', () => {
      expect(mapV1ToV2('auth.reset_request')).toBe(
        'auth.password.reset.requested'
      );
    });

    it('should map v1 reset_complete to v2', () => {
      expect(mapV1ToV2('auth.reset_complete')).toBe(
        'auth.password.reset.completed'
      );
    });

    it('should return null for v1 event without mapping', () => {
      expect(mapV1ToV2('auth.nonexistent')).toBeNull();
    });
  });

  describe('getAllV2EventIds', () => {
    it('should return all v2 event IDs', () => {
      const eventIds = getAllV2EventIds();
      expect(Array.isArray(eventIds)).toBe(true);
      expect(eventIds.length).toBeGreaterThan(0);
      expect(eventIds).toContain('auth.session.login.success');
      expect(eventIds).toContain('auth.session.logout.manual');
      expect(eventIds).toContain('auth.password.reset.requested');
      expect(eventIds).toContain('auth.registration.signup.success');
    });

    it('should return unique event IDs', () => {
      const eventIds = getAllV2EventIds();
      const uniqueIds = [...new Set(eventIds)];
      expect(eventIds.length).toBe(uniqueIds.length);
    });
  });

  describe('isValidV2EventId', () => {
    it('should validate correct v2 event IDs', () => {
      expect(isValidV2EventId('auth.session.login.success')).toBe(true);
      expect(isValidV2EventId('auth.password.reset.requested')).toBe(true);
      expect(isValidV2EventId('auth.registration.signup.success')).toBe(true);
    });

    it('should reject invalid event IDs', () => {
      expect(isValidV2EventId('auth.invalid.event')).toBe(false);
      expect(isValidV2EventId('invalid.event')).toBe(false);
      expect(isValidV2EventId(null)).toBe(false);
      expect(isValidV2EventId('')).toBe(false);
    });

    it('should reject v1 event IDs', () => {
      expect(isValidV2EventId('auth.login')).toBe(false);
      expect(isValidV2EventId('auth.logout')).toBe(false);
    });
  });

  describe('getFlatEventTypes', () => {
    it('should return flat object with all v2 events', () => {
      const flat = getFlatEventTypes();
      expect(typeof flat).toBe('object');
      expect(flat['auth.session.login.success']).toBeDefined();
      expect(flat['auth.session.login.success'].severity).toBe('info');
      expect(flat['auth.session.login.success'].description).toBe(
        'User successfully logged in'
      );
    });

    it('should include all categories', () => {
      const flat = getFlatEventTypes();
      expect(flat['auth.session.login.success']).toBeDefined();
      expect(flat['auth.registration.signup.success']).toBeDefined();
      expect(flat['auth.password.reset.requested']).toBeDefined();
      expect(flat['auth.magic_link.login.sent']).toBeDefined();
      expect(flat['auth.oauth.initiated']).toBeDefined();
    });
  });

  describe('Taxonomy Structure', () => {
    it('should have all expected categories', () => {
      expect(AUTH_EVENTS_TAXONOMY_V2.session).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.registration).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.password).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.magic_link).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.oauth).toBeDefined();
    });

    it('should have session events', () => {
      expect(AUTH_EVENTS_TAXONOMY_V2.session.login).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.session.logout).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.session.refresh).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.session.expired).toBeDefined();
    });

    it('should have registration events', () => {
      expect(AUTH_EVENTS_TAXONOMY_V2.registration.signup).toBeDefined();
      expect(
        AUTH_EVENTS_TAXONOMY_V2.registration.email_verification
      ).toBeDefined();
    });

    it('should have password events', () => {
      expect(AUTH_EVENTS_TAXONOMY_V2.password.reset).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.password.change).toBeDefined();
    });

    it('should have magic_link events', () => {
      expect(AUTH_EVENTS_TAXONOMY_V2.magic_link.login).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.magic_link.signup).toBeDefined();
    });

    it('should have oauth events', () => {
      expect(AUTH_EVENTS_TAXONOMY_V2.oauth.initiated).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.oauth.callback).toBeDefined();
      expect(AUTH_EVENTS_TAXONOMY_V2.oauth.token_refresh).toBeDefined();
    });
  });

  describe('Event Configurations', () => {
    it('should have correct severity levels', () => {
      const loginSuccess = getEventConfig('auth.session.login.success');
      expect(loginSuccess.severity).toBe('info');

      const loginFailed = getEventConfig('auth.session.login.failed');
      expect(loginFailed.severity).toBe('warning');

      const resetRequested = getEventConfig('auth.password.reset.requested');
      expect(resetRequested.severity).toBe('warning');
    });

    it('should have descriptions for all events', () => {
      const eventIds = getAllV2EventIds();
      for (const eventId of eventIds) {
        const config = getEventConfig(eventId);
        expect(config).toBeDefined();
        expect(config.description).toBeDefined();
        expect(typeof config.description).toBe('string');
        expect(config.description.length).toBeGreaterThan(0);
      }
    });
  });
});

