/**
 * Connection Limits Tests - Issue #366
 * Testing tier-based connection limits (Free=1, Pro=5, Creator Plus=999)
 */

describe('Connection Limits by Tier - Issue #366', () => {
    
    // Test the connection limit validation logic
    const getMaxConnections = (userPlan) => {
        if (!userPlan) return 1; // Handle null/undefined
        switch (userPlan.toLowerCase()) {
            case 'free':
                return 1;
            case 'pro':
                return 5;
            case 'creator_plus':
            case 'custom':
                return 999;
            default:
                return 1; // Default to free plan limits
        }
    };

    const checkConnectionLimit = (currentConnections, userPlan) => {
        const maxConnections = getMaxConnections(userPlan);
        return {
            allowed: currentConnections < maxConnections,
            currentConnections,
            maxConnections,
            message: currentConnections >= maxConnections
                ? `Plan ${userPlan} permite máximo ${maxConnections} ${maxConnections === 1 ? 'conexión' : 'conexiones'}. Actualiza tu plan para conectar más plataformas.`
                : 'Connection allowed'
        };
    };

    // Test array safety validation - Issue #366 CodeRabbit feedback
    const validateConnectionsArray = (connections) => {
        if (!Array.isArray(connections)) {
            return [];
        }
        return connections.filter(conn => conn && typeof conn === 'object');
    };

    describe('Free Plan Limits', () => {
        test('should allow 0 connections for free plan', () => {
            const result = checkConnectionLimit(0, 'free');
            expect(result.allowed).toBe(true);
            expect(result.maxConnections).toBe(1);
        });

        test('should block 1+ connections for free plan', () => {
            const result = checkConnectionLimit(1, 'free');
            expect(result.allowed).toBe(false);
            expect(result.maxConnections).toBe(1);
            expect(result.message).toContain('Plan free permite máximo 1 conexión');
        });
    });

    describe('Pro Plan Limits', () => {
        test('should allow up to 4 connections for pro plan', () => {
            const result = checkConnectionLimit(4, 'pro');
            expect(result.allowed).toBe(true);
            expect(result.maxConnections).toBe(5);
        });

        test('should block 5+ connections for pro plan', () => {
            const result = checkConnectionLimit(5, 'pro');
            expect(result.allowed).toBe(false);
            expect(result.maxConnections).toBe(5);
            expect(result.message).toContain('Plan pro permite máximo 5 conexiones');
        });
    });

    describe('Creator Plus Plan Limits', () => {
        test('should allow many connections for creator_plus plan', () => {
            const result = checkConnectionLimit(50, 'creator_plus');
            expect(result.allowed).toBe(true);
            expect(result.maxConnections).toBe(999);
        });

        test('should effectively be unlimited for creator_plus plan', () => {
            const result = checkConnectionLimit(998, 'creator_plus');
            expect(result.allowed).toBe(true);
            expect(result.maxConnections).toBe(999);
        });
    });

    describe('Custom Plan Limits', () => {
        test('should allow many connections for custom plan', () => {
            const result = checkConnectionLimit(500, 'custom');
            expect(result.allowed).toBe(true);
            expect(result.maxConnections).toBe(999);
        });

        test('should effectively be unlimited for custom plan', () => {
            const result = checkConnectionLimit(998, 'custom');
            expect(result.allowed).toBe(true);
            expect(result.maxConnections).toBe(999);
        });

        test('should handle case variations for custom plan', () => {
            expect(getMaxConnections('CUSTOM')).toBe(999);
            expect(getMaxConnections('Custom')).toBe(999);
            expect(getMaxConnections('custom')).toBe(999);
        });
    });

    describe('Unknown Plan Handling', () => {
        test('should default to free plan limits for unknown plans', () => {
            const result = checkConnectionLimit(0, 'unknown_plan');
            expect(result.allowed).toBe(true);
            expect(result.maxConnections).toBe(1);
        });

        test('should block connections for unknown plans at free tier limit', () => {
            const result = checkConnectionLimit(1, 'unknown_plan');
            expect(result.allowed).toBe(false);
            expect(result.maxConnections).toBe(1);
        });
    });

    describe('Edge Cases', () => {
        test('should handle null/undefined plans', () => {
            const result1 = checkConnectionLimit(0, null);
            const result2 = checkConnectionLimit(0, undefined);
            
            expect(result1.maxConnections).toBe(1);
            expect(result2.maxConnections).toBe(1);
        });

        test('should handle case variations', () => {
            expect(getMaxConnections('FREE')).toBe(1);
            expect(getMaxConnections('Pro')).toBe(5);
            expect(getMaxConnections('CREATOR_PLUS')).toBe(999);
        });
    });

    describe('Array Safety Validation - CodeRabbit Fix', () => {
        test('should safely handle null connections array', () => {
            const result = validateConnectionsArray(null);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        test('should safely handle undefined connections array', () => {
            const result = validateConnectionsArray(undefined);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        test('should safely handle non-array input', () => {
            const result = validateConnectionsArray('not-an-array');
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        test('should filter out invalid connections from array', () => {
            const connections = [
                { platform: 'twitter', enabled: true },
                null,
                undefined,
                'invalid',
                { platform: 'youtube', enabled: false }
            ];
            
            const result = validateConnectionsArray(connections);
            expect(result.length).toBe(2);
            expect(result[0].platform).toBe('twitter');
            expect(result[1].platform).toBe('youtube');
        });

        test('should preserve valid connections', () => {
            const connections = [
                { platform: 'twitter', enabled: true },
                { platform: 'youtube', enabled: false },
                { platform: 'instagram', enabled: true }
            ];
            
            const result = validateConnectionsArray(connections);
            expect(result.length).toBe(3);
            expect(result).toEqual(connections);
        });
    });

    describe('Plan Limits Integration', () => {
        test('should validate Free plan connection limits with array safety', () => {
            const connections = [
                { platform: 'twitter', enabled: true }
            ];
            
            const validConnections = validateConnectionsArray(connections);
            const result = checkConnectionLimit(validConnections.length, 'free');
            
            expect(result.allowed).toBe(false); // 1 connection = at limit
            expect(result.maxConnections).toBe(1);
        });

        test('should validate Pro plan connection limits with array safety', () => {
            const connections = [
                { platform: 'twitter', enabled: true },
                { platform: 'youtube', enabled: true },
                { platform: 'instagram', enabled: true },
                null, // This should be filtered out
                { platform: 'facebook', enabled: true }
            ];
            
            const validConnections = validateConnectionsArray(connections);
            const result = checkConnectionLimit(validConnections.length, 'pro');
            
            expect(validConnections.length).toBe(4); // null filtered out
            expect(result.allowed).toBe(true); // 4 < 5
            expect(result.maxConnections).toBe(5);
        });

        test('should validate Creator Plus plan allows many connections', () => {
            // Create a large array of connections
            const connections = Array.from({ length: 50 }, (_, i) => ({
                platform: `platform-${i}`,
                enabled: true
            }));
            
            const validConnections = validateConnectionsArray(connections);
            const result = checkConnectionLimit(validConnections.length, 'creator_plus');
            
            expect(validConnections.length).toBe(50);
            expect(result.allowed).toBe(true);
            expect(result.maxConnections).toBe(999);
        });
    });
});

describe('Feature Flags Validation - Issue #366', () => {
    
    // Mock the parseFlag function
    const parseFlag = (value, defaultValue = false) => {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return defaultValue;
    };

    describe('SHOP_ENABLED flag', () => {
        test('should default to false when not set', () => {
            const result = parseFlag(undefined, false);
            expect(result).toBe(false);
        });

        test('should parse string "true" correctly', () => {
            const result = parseFlag('true', false);
            expect(result).toBe(true);
        });

        test('should parse string "false" correctly', () => {
            const result = parseFlag('false', false);
            expect(result).toBe(false);
        });

        test('should handle boolean values', () => {
            expect(parseFlag(true, false)).toBe(true);
            expect(parseFlag(false, false)).toBe(false);
        });
    });

    describe('ENABLE_SHIELD_UI flag', () => {
        test('should default to specified default value', () => {
            const result = parseFlag(undefined, true);
            expect(result).toBe(true);
        });

        test('should override default when explicitly set', () => {
            const result = parseFlag('false', true);
            expect(result).toBe(false);
        });
    });
});

describe('Analytics Metrics Logic - Issue #366', () => {
    
    describe('Metrics Display', () => {
        test('should handle null/undefined analytics data', () => {
            const analytics = null;
            const completedAnalyses = analytics?.completed_analyses ?? 0;
            const sentRoasts = analytics?.sent_roasts ?? 0;
            
            expect(completedAnalyses).toBe(0);
            expect(sentRoasts).toBe(0);
        });

        test('should display actual values when data exists', () => {
            const analytics = {
                completed_analyses: 42,
                sent_roasts: 24
            };
            
            const completedAnalyses = analytics?.completed_analyses ?? 0;
            const sentRoasts = analytics?.sent_roasts ?? 0;
            
            expect(completedAnalyses).toBe(42);
            expect(sentRoasts).toBe(24);
        });

        test('should handle partial data gracefully', () => {
            const analytics = {
                completed_analyses: 15
                // sent_roasts missing
            };
            
            const completedAnalyses = analytics?.completed_analyses ?? 0;
            const sentRoasts = analytics?.sent_roasts ?? 0;
            
            expect(completedAnalyses).toBe(15);
            expect(sentRoasts).toBe(0);
        });
    });
});