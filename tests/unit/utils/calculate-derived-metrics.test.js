/**
 * Unit tests for calculateDerivedMetrics - Codex Review #3311704785
 * Tests nullish coalescing fix for repair score (P1 issue)
 *
 * UPDATED - Codex Review #3311794192: Now imports real production code
 */

// Import the real TelemetryCollector class from production code
const TelemetryCollector = require('../../../scripts/collect-gdd-telemetry');

// Create a single instance to use across all tests
const collector = new TelemetryCollector();

// Helper function to call the production method
function calculateDerivedMetrics(metrics) {
  return collector.calculateDerivedMetrics(metrics);
}

describe('calculateDerivedMetrics - Nullish Coalescing Fix', () => {
  describe('P1: Nullish Coalescing for Repair Score', () => {
    test('should treat success_rate=0 as valid value (not fallback to 100)', () => {
      // Scenario: Auto-fix completely failing (0% success)
      const metrics = {
        health: { overall_score: 95, healthy_count: 10, total_nodes: 10 },
        drift: { average_drift_risk: 10 },
        repair: { success_rate: 0 }  // ❌ 0% success - should NOT fallback to 100
      };

      const derived = calculateDerivedMetrics(metrics);

      // With fix (??): repairScore = 0
      // stability_index = (95 + 90 + 0) / 3 = 61.67 → 62
      expect(derived.stability_index).toBe(62);

      // With bug (||): repairScore = 100
      // stability_index = (95 + 90 + 100) / 3 = 95
      // The fix prevents this incorrect inflation

      // System status should be DEGRADED (not STABLE)
      // healthScore=95 >= 80, driftScore=90 >= 40, repairScore=0 < 90
      expect(derived.system_status).toBe('DEGRADED');

      // Auto-fix efficiency should reflect the actual 0%
      expect(derived.auto_fix_efficiency).toBe(0);
    });

    test('should use fallback (100) when success_rate is null', () => {
      // Scenario: No repair data available
      const metrics = {
        health: { overall_score: 95, healthy_count: 10, total_nodes: 10 },
        drift: { average_drift_risk: 10 },
        repair: { success_rate: null }  // No data - should fallback to 100
      };

      const derived = calculateDerivedMetrics(metrics);

      // With ??: repairScore = null ?? 100 = 100
      // stability_index = (95 + 90 + 100) / 3 = 95
      expect(derived.stability_index).toBe(95);

      // System status should be STABLE
      // healthScore=95 >= 95, driftScore=90 >= 60, repairScore=100 >= 90
      expect(derived.system_status).toBe('STABLE');

      // Auto-fix efficiency should be null (no data)
      expect(derived.auto_fix_efficiency).toBe(null);
    });

    test('should use fallback (100) when repair object is undefined', () => {
      // Scenario: Repair metrics not collected
      const metrics = {
        health: { overall_score: 95, healthy_count: 10, total_nodes: 10 },
        drift: { average_drift_risk: 10 }
        // No repair object
      };

      const derived = calculateDerivedMetrics(metrics);

      // With ??: repairScore = undefined ?? 100 = 100
      // stability_index = (95 + 90 + 100) / 3 = 95
      expect(derived.stability_index).toBe(95);

      // System status should be STABLE
      expect(derived.system_status).toBe('STABLE');

      // Auto-fix efficiency should be undefined (no repair object)
      expect(derived.auto_fix_efficiency).toBeUndefined();
    });

    test('should use actual value when success_rate is 50%', () => {
      // Scenario: Auto-fix partially successful (50%)
      const metrics = {
        health: { overall_score: 95, healthy_count: 10, total_nodes: 10 },
        drift: { average_drift_risk: 10 },
        repair: { success_rate: 50 }  // 50% success - should use 50
      };

      const derived = calculateDerivedMetrics(metrics);

      // With ??: repairScore = 50
      // stability_index = (95 + 90 + 50) / 3 = 78.33 → 78
      expect(derived.stability_index).toBe(78);

      // System status should be DEGRADED
      // healthScore=95 >= 80, driftScore=90 >= 40, repairScore=50 < 90
      expect(derived.system_status).toBe('DEGRADED');

      // Auto-fix efficiency should be 50
      expect(derived.auto_fix_efficiency).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    test('should handle success_rate=100 (perfect auto-fix)', () => {
      const metrics = {
        health: { overall_score: 95, healthy_count: 10, total_nodes: 10 },
        drift: { average_drift_risk: 10 },
        repair: { success_rate: 100 }
      };

      const derived = calculateDerivedMetrics(metrics);

      // stability_index = (95 + 90 + 100) / 3 = 95
      expect(derived.stability_index).toBe(95);
      expect(derived.system_status).toBe('STABLE');
      expect(derived.auto_fix_efficiency).toBe(100);
    });

    test('should transition to CRITICAL when all scores are low', () => {
      const metrics = {
        health: { overall_score: 50, healthy_count: 5, total_nodes: 10 },
        drift: { average_drift_risk: 70 },
        repair: { success_rate: 0 }
      };

      const derived = calculateDerivedMetrics(metrics);

      // repairScore = 0 (not 100 due to fix)
      // stability_index = (50 + 30 + 0) / 3 = 26.67 → 27
      expect(derived.stability_index).toBe(27);

      // System status should be CRITICAL
      // healthScore=50 < 80
      expect(derived.system_status).toBe('CRITICAL');
    });
  });

  describe('Impact Analysis - Before vs After Fix', () => {
    test('demonstrates bug impact: 0% success inflated to 100% before fix', () => {
      const metrics = {
        health: { overall_score: 95, healthy_count: 10, total_nodes: 10 },
        drift: { average_drift_risk: 10 },
        repair: { success_rate: 0 }
      };

      // AFTER FIX (with ??):
      const derivedAfterFix = calculateDerivedMetrics(metrics);
      expect(derivedAfterFix.stability_index).toBe(62);  // Correctly low
      expect(derivedAfterFix.system_status).toBe('DEGRADED');  // Correctly degraded

      // BEFORE FIX (with ||) - simulated:
      function calculateDerivedMetricsBuggy(metrics) {
        const repairScore = metrics.repair?.success_rate || 100;  // ❌ Bug: treats 0 as falsy
        const healthScore = metrics.health?.overall_score || 0;
        const driftScore = 100 - (metrics.drift?.average_drift_risk || 0);
        const stability_index = Math.round((healthScore + driftScore + repairScore) / 3);

        let system_status;
        if (healthScore >= 95 && driftScore >= 60 && repairScore >= 90) {
          system_status = 'STABLE';
        } else if (healthScore >= 80 && driftScore >= 40) {
          system_status = 'DEGRADED';
        } else {
          system_status = 'CRITICAL';
        }

        return { stability_index, system_status };
      }

      const derivedBeforeFix = calculateDerivedMetricsBuggy(metrics);
      expect(derivedBeforeFix.stability_index).toBe(95);  // ❌ Incorrectly high
      expect(derivedBeforeFix.system_status).toBe('STABLE');  // ❌ Incorrectly stable

      // Demonstrate the fix prevents 33-point inflation:
      const inflation = derivedBeforeFix.stability_index - derivedAfterFix.stability_index;
      expect(inflation).toBe(33);  // 95 - 62 = 33 points inflation prevented
    });
  });
});
