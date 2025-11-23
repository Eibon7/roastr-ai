/**
 * Unit tests for telemetry null handling - CodeRabbit Review #3313481290
 * Tests P1-2, M1, M2 fixes for proper null/undefined handling
 */

const TelemetryCollector = require('../../../scripts/collect-gdd-telemetry');

describe('Telemetry Null Handling - Review #3313481290', () => {
  let collector;

  beforeEach(() => {
    collector = new TelemetryCollector({ ci: true });
  });

  describe('P1-2: calculateDerivedMetrics - Nullish Coalescing', () => {
    test('should treat success_rate=0 as valid value (not fallback to 100)', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: { success_rate: 0 } // ❌ 0% success - should NOT fallback to 100
      };

      const derived = collector.calculateDerivedMetrics(metrics);

      // With fix (??): repairScore = 0
      // stability_index = (95 + 90 + 0) / 3 = 61.67 → 62
      expect(derived.stability_index).toBe(62);

      // System status should be DEGRADED (not STABLE)
      expect(derived.system_status).toBe('DEGRADED');
      expect(derived.auto_fix_efficiency).toBe(0);
    });

    test('should use fallback when success_rate is null', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: { success_rate: null } // null - should fallback to 100
      };

      const derived = collector.calculateDerivedMetrics(metrics);

      // With fix (??): repairScore = 100 (fallback)
      // stability_index = (95 + 90 + 100) / 3 = 95
      expect(derived.stability_index).toBe(95);
      expect(derived.system_status).toBe('STABLE');
      expect(derived.auto_fix_efficiency).toBe(null);
    });

    test('should use fallback when success_rate is undefined', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: {} // success_rate undefined
      };

      const derived = collector.calculateDerivedMetrics(metrics);

      // With fix (??): repairScore = 100 (fallback)
      expect(derived.stability_index).toBe(95);
      expect(derived.system_status).toBe('STABLE');
    });

    test('should use actual value when success_rate is 50', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: { success_rate: 50 }
      };

      const derived = collector.calculateDerivedMetrics(metrics);

      // stability_index = (95 + 90 + 50) / 3 = 78.33 → 78
      expect(derived.stability_index).toBe(78);
      expect(derived.system_status).toBe('DEGRADED');
      expect(derived.auto_fix_efficiency).toBe(50);
    });

    test('should handle perfect auto-fix (100%)', () => {
      const metrics = {
        health: { overall_score: 98 },
        drift: { average_drift_risk: 5 },
        repair: { success_rate: 100 }
      };

      const derived = collector.calculateDerivedMetrics(metrics);

      // stability_index = (98 + 95 + 100) / 3 = 97.67 → 98
      expect(derived.stability_index).toBe(98);
      expect(derived.system_status).toBe('STABLE');
      expect(derived.auto_fix_efficiency).toBe(100);
    });
  });

  describe('M1: checkAlerts - Type Guard for success_rate', () => {
    test('should NOT generate alert when success_rate is null', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: {
          success_rate: null, // null - should NOT trigger alert
          total_fixes_attempted: 0
        }
      };

      const alerts = collector.checkAlerts(metrics);

      // No auto-fix alert should be generated for null value
      const autoFixAlerts = alerts.filter((a) => a.type === 'auto_fix');
      expect(autoFixAlerts).toHaveLength(0);
    });

    test('should NOT generate alert when success_rate is undefined', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: {
          // success_rate undefined
          total_fixes_attempted: 0
        }
      };

      const alerts = collector.checkAlerts(metrics);

      const autoFixAlerts = alerts.filter((a) => a.type === 'auto_fix');
      expect(autoFixAlerts).toHaveLength(0);
    });

    test('should generate alert when success_rate=0 (below threshold)', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: {
          success_rate: 0, // 0% - SHOULD trigger alert (valid number below 80)
          total_fixes_attempted: 10,
          successful_fixes: 0
        }
      };

      const alerts = collector.checkAlerts(metrics);

      const autoFixAlerts = alerts.filter((a) => a.type === 'auto_fix');
      expect(autoFixAlerts).toHaveLength(1);
      expect(autoFixAlerts[0].message).toContain('0%');
      expect(autoFixAlerts[0].severity).toBe('warning');
    });

    test('should generate alert when success_rate=50 (below threshold)', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: {
          success_rate: 50, // 50% < 80% threshold
          total_fixes_attempted: 10,
          successful_fixes: 5
        }
      };

      const alerts = collector.checkAlerts(metrics);

      const autoFixAlerts = alerts.filter((a) => a.type === 'auto_fix');
      expect(autoFixAlerts).toHaveLength(1);
      expect(autoFixAlerts[0].message).toContain('50%');
    });

    test('should NOT generate alert when success_rate=90 (above threshold)', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: {
          success_rate: 90, // 90% >= 80% threshold
          total_fixes_attempted: 10,
          successful_fixes: 9
        }
      };

      const alerts = collector.checkAlerts(metrics);

      const autoFixAlerts = alerts.filter((a) => a.type === 'auto_fix');
      expect(autoFixAlerts).toHaveLength(0);
    });
  });

  describe('M2: buildMarkdownReport - Null Handling in Output', () => {
    test('should display "N/A" with neutral marker when success_rate is null', () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        date: '2025-10-08',
        metrics: {
          repair: {
            success_rate: null, // null - should display N/A
            total_fixes_attempted: 0,
            successful_fixes: 0,
            failed_fixes: 0
          },
          derived: {
            system_status: 'STABLE'
          }
        },
        alerts: []
      };

      const report = collector.buildMarkdownReport(snapshot);

      // Should display "N/A" not "null%"
      expect(report).toContain('| Auto-Fix Success | N/A |');

      // Should use neutral status marker ➖ not ❌
      expect(report).toContain('➖');

      // Should NOT contain "null%"
      expect(report).not.toContain('null%');
    });

    test('should display "N/A" when success_rate is undefined', () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        date: '2025-10-08',
        metrics: {
          repair: {
            // success_rate undefined
            total_fixes_attempted: 0,
            successful_fixes: 0
          },
          derived: {
            system_status: 'STABLE'
          }
        },
        alerts: []
      };

      const report = collector.buildMarkdownReport(snapshot);

      expect(report).toContain('| Auto-Fix Success | N/A |');
      expect(report).toContain('➖');
      expect(report).not.toContain('undefined%');
    });

    test('should display "0%" with ❌ when success_rate=0', () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        date: '2025-10-08',
        metrics: {
          repair: {
            success_rate: 0, // 0% - valid numeric value
            total_fixes_attempted: 10,
            successful_fixes: 0
          },
          derived: {
            system_status: 'DEGRADED'
          }
        },
        alerts: []
      };

      const report = collector.buildMarkdownReport(snapshot);

      expect(report).toContain('| Auto-Fix Success | 0% |');
      expect(report).toContain('❌'); // 0 < 70, so critical status
    });

    test('should display "75%" with ⚠️ when success_rate=75', () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        date: '2025-10-08',
        metrics: {
          repair: {
            success_rate: 75, // 70 <= 75 < 90
            total_fixes_attempted: 100,
            successful_fixes: 75
          },
          derived: {
            system_status: 'STABLE'
          }
        },
        alerts: []
      };

      const report = collector.buildMarkdownReport(snapshot);

      expect(report).toContain('| Auto-Fix Success | 75% |');
      expect(report).toContain('⚠️'); // warning status
    });

    test('should display "95%" with ✅ when success_rate=95', () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        date: '2025-10-08',
        metrics: {
          repair: {
            success_rate: 95, // >= 90
            total_fixes_attempted: 100,
            successful_fixes: 95
          },
          derived: {
            system_status: 'STABLE'
          }
        },
        alerts: []
      };

      const report = collector.buildMarkdownReport(snapshot);

      expect(report).toContain('| Auto-Fix Success | 95% |');
      expect(report).toContain('✅'); // success status
    });
  });

  describe('Edge Cases - Combined Scenarios', () => {
    test('should handle complete absence of repair metrics', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 }
        // No repair metrics at all
      };

      const derived = collector.calculateDerivedMetrics(metrics);
      const alerts = collector.checkAlerts(metrics);

      // Should use fallback for repairScore
      expect(derived.stability_index).toBe(95);
      expect(derived.system_status).toBe('STABLE');

      // No auto-fix alerts
      expect(alerts.filter((a) => a.type === 'auto_fix')).toHaveLength(0);
    });

    test('should handle repair object without success_rate property', () => {
      const metrics = {
        health: { overall_score: 95 },
        drift: { average_drift_risk: 10 },
        repair: {
          total_fixes_attempted: 5,
          successful_fixes: 3
          // success_rate missing
        }
      };

      const derived = collector.calculateDerivedMetrics(metrics);

      expect(derived.stability_index).toBe(95); // fallback to 100
      expect(derived.auto_fix_efficiency).toBeUndefined();
    });
  });
});
