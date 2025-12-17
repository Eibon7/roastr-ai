/**
 * Auth Events Taxonomy v2
 *
 * ROA-357: Structured hierarchical taxonomy for authentication events
 *
 * This module defines the v2 taxonomy for authentication events, providing
 * a hierarchical structure that replaces the flat v1 event naming.
 *
 * Structure: auth/{category}/{subcategory}/{action}
 *
 * Example: auth.session.login.success
 */

/**
 * Event taxonomy structure
 * Categories are organized hierarchically for better organization and filtering
 */
const AUTH_EVENTS_TAXONOMY_V2 = {
  session: {
    login: {
      success: {
        severity: 'info',
        description: 'User successfully logged in',
        v1Mapping: 'auth.login'
      },
      failed: {
        severity: 'warning',
        description: 'User login attempt failed',
        v1Mapping: 'auth.failed_login'
      },
      blocked: {
        severity: 'warning',
        description: 'User login blocked (rate limit, suspicious activity)',
        v1Mapping: null
      }
    },
    logout: {
      manual: {
        severity: 'info',
        description: 'User manually logged out',
        v1Mapping: 'auth.logout'
      },
      automatic: {
        severity: 'info',
        description: 'User automatically logged out (timeout, session expired)',
        v1Mapping: null
      }
    },
    refresh: {
      success: {
        severity: 'info',
        description: 'Session token refreshed successfully',
        v1Mapping: null
      },
      failed: {
        severity: 'warning',
        description: 'Session token refresh failed',
        v1Mapping: null
      }
    },
    expired: {
      severity: 'info',
      description: 'User session expired',
      v1Mapping: null
    }
  },
  registration: {
    signup: {
      success: {
        severity: 'info',
        description: 'User successfully registered',
        v1Mapping: null
      },
      failed: {
        severity: 'warning',
        description: 'User registration failed',
        v1Mapping: null
      }
    },
    email_verification: {
      sent: {
        severity: 'info',
        description: 'Email verification link sent',
        v1Mapping: null
      },
      verified: {
        severity: 'info',
        description: 'Email successfully verified',
        v1Mapping: null
      },
      expired: {
        severity: 'warning',
        description: 'Email verification link expired',
        v1Mapping: null
      }
    }
  },
  password: {
    reset: {
      requested: {
        severity: 'warning',
        description: 'Password reset requested',
        v1Mapping: 'auth.reset_request'
      },
      completed: {
        severity: 'info',
        description: 'Password reset completed',
        v1Mapping: 'auth.reset_complete'
      },
      failed: {
        severity: 'warning',
        description: 'Password reset failed',
        v1Mapping: null
      }
    },
    change: {
      success: {
        severity: 'info',
        description: 'Password changed successfully',
        v1Mapping: null
      },
      failed: {
        severity: 'warning',
        description: 'Password change failed',
        v1Mapping: null
      }
    }
  },
  magic_link: {
    login: {
      sent: {
        severity: 'info',
        description: 'Magic link for login sent',
        v1Mapping: null
      },
      used: {
        severity: 'info',
        description: 'Magic link for login used successfully',
        v1Mapping: null
      },
      expired: {
        severity: 'warning',
        description: 'Magic link for login expired',
        v1Mapping: null
      }
    },
    signup: {
      sent: {
        severity: 'info',
        description: 'Magic link for signup sent',
        v1Mapping: null
      },
      used: {
        severity: 'info',
        description: 'Magic link for signup used successfully',
        v1Mapping: null
      },
      expired: {
        severity: 'warning',
        description: 'Magic link for signup expired',
        v1Mapping: null
      }
    }
  },
  oauth: {
    initiated: {
      severity: 'info',
      description: 'OAuth flow initiated',
      v1Mapping: null
    },
    callback: {
      success: {
        severity: 'info',
        description: 'OAuth callback successful',
        v1Mapping: null
      },
      failed: {
        severity: 'warning',
        description: 'OAuth callback failed',
        v1Mapping: null
      }
    },
    token_refresh: {
      success: {
        severity: 'info',
        description: 'OAuth token refreshed successfully',
        v1Mapping: null
      },
      failed: {
        severity: 'warning',
        description: 'OAuth token refresh failed',
        v1Mapping: null
      }
    }
  }
};

/**
 * Build event ID from hierarchical path
 * @param {string[]} path - Array of path segments (e.g., ['session', 'login', 'success'])
 * @returns {string} Event ID (e.g., 'auth.session.login.success')
 */
function buildEventId(path) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new Error('Path must be a non-empty array');
  }
  return `auth.${path.join('.')}`;
}

/**
 * Parse event ID into hierarchical path
 * @param {string} eventId - Event ID (e.g., 'auth.session.login.success')
 * @returns {string[]} Array of path segments
 */
function parseEventId(eventId) {
  if (!eventId || !eventId.startsWith('auth.')) {
    throw new Error('Event ID must start with "auth."');
  }
  return eventId.substring(5).split('.');
}

/**
 * Get event configuration from taxonomy
 * @param {string} eventId - Event ID (v2 format)
 * @returns {object|null} Event configuration or null if not found
 */
function getEventConfig(eventId) {
  const path = parseEventId(eventId);
  let current = AUTH_EVENTS_TAXONOMY_V2;

  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null;
    }
    current = current[segment];
  }

  // Check if we reached a leaf node (has severity)
  if (current && typeof current === 'object' && 'severity' in current) {
    return current;
  }

  return null;
}

/**
 * Map v1 event ID to v2 event ID
 * @param {string} v1EventId - v1 event ID (e.g., 'auth.login')
 * @returns {string|null} v2 event ID or null if no mapping exists
 */
function mapV1ToV2(v1EventId) {
  // Search through taxonomy for v1Mapping
  function searchTaxonomy(obj, path = []) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        if ('v1Mapping' in value && value.v1Mapping === v1EventId) {
          return buildEventId([...path, key]);
        }
        const result = searchTaxonomy(value, [...path, key]);
        if (result) return result;
      }
    }
    return null;
  }

  return searchTaxonomy(AUTH_EVENTS_TAXONOMY_V2);
}

/**
 * Get all v2 event IDs
 * @returns {string[]} Array of all v2 event IDs
 */
function getAllV2EventIds() {
  const eventIds = [];

  function traverse(obj, path = []) {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        if ('severity' in value) {
          // Leaf node
          eventIds.push(buildEventId([...path, key]));
        } else {
          // Continue traversing
          traverse(value, [...path, key]);
        }
      }
    }
  }

  traverse(AUTH_EVENTS_TAXONOMY_V2);
  return eventIds;
}

/**
 * Validate event ID format
 * @param {string} eventId - Event ID to validate
 * @returns {boolean} True if valid v2 format
 */
function isValidV2EventId(eventId) {
  if (!eventId || typeof eventId !== 'string') {
    return false;
  }
  if (!eventId.startsWith('auth.')) {
    return false;
  }
  const config = getEventConfig(eventId);
  return config !== null;
}

/**
 * Get flat event types object for backward compatibility
 * This generates a flat object similar to v1 for easy migration
 * @returns {object} Flat object with event IDs as keys
 */
function getFlatEventTypes() {
  const flat = {};
  const eventIds = getAllV2EventIds();

  for (const eventId of eventIds) {
    const config = getEventConfig(eventId);
    if (config) {
      flat[eventId] = {
        severity: config.severity,
        description: config.description
      };
    }
  }

  return flat;
}

module.exports = {
  AUTH_EVENTS_TAXONOMY_V2,
  buildEventId,
  parseEventId,
  getEventConfig,
  mapV1ToV2,
  getAllV2EventIds,
  isValidV2EventId,
  getFlatEventTypes
};

