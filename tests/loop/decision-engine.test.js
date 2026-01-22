/**
 * Tests - Decision Engine
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const {
  DECISION,
  makeDecision,
  VIOLATION_SEVERITY,
  getSeverity,
  hasCriticalViolations,
  hasHighViolations,
  summarizeViolations,
  shouldRollback,
  shouldEscalate,
  CRITICAL_VIOLATION_TYPES,
  HIGH_VIOLATION_TYPES,
} = require('../../scripts/loop/lib/decision-engine');

describe('Decision Engine', () => {
  describe('makeDecision', () => {
    describe('pre-task phase', () => {
      it('should return CONTINUE if no violations', () => {
        const validationResult = {
          status: 'CONTINUE',
          v2Only: { passed: true, violations: [] },
        };
        
        const decision = makeDecision('pre-task', validationResult);
        
        expect(decision.decision).toBe(DECISION.CONTINUE);
        expect(decision.severity).toBeNull();
        expect(decision.violations).toHaveLength(0);
      });
      
      it('should return BLOCK if violations detected', () => {
        const validationResult = {
          status: 'BLOCK',
          v2Only: {
            passed: false,
            violations: [
              { type: 'LEGACY_IMPORT', file: 'test.js' },
            ],
          },
        };
        
        const decision = makeDecision('pre-task', validationResult);
        
        expect(decision.decision).toBe(DECISION.BLOCK);
        expect(decision.severity).toBe(VIOLATION_SEVERITY.CRITICAL);
        expect(decision.violations).toHaveLength(1);
      });
    });
    
    describe('post-task phase', () => {
      it('should return CONTINUE if no violations', () => {
        const validationResult = {
          status: 'CONTINUE',
          v2Only: { passed: true, violations: [] },
        };
        
        const decision = makeDecision('post-task', validationResult);
        
        expect(decision.decision).toBe(DECISION.CONTINUE);
        expect(decision.severity).toBeNull();
      });
      
      it('should return BLOCK if critical violations', () => {
        const validationResult = {
          status: 'BLOCK',
          v2Only: {
            passed: false,
            violations: [
              { type: 'LEGACY_FILE_MODIFICATION', file: 'docs/legacy/test.md' },
            ],
          },
        };
        
        const decision = makeDecision('post-task', validationResult);
        
        expect(decision.decision).toBe(DECISION.BLOCK);
        expect(decision.severity).toBe(VIOLATION_SEVERITY.CRITICAL);
      });
      
      it('should return BLOCK if high violations (default)', () => {
        const validationResult = {
          status: 'BLOCK',
          v2Only: {
            passed: false,
            violations: [
              { type: 'LEGACY_ID_REFERENCE', file: 'test.js' },
            ],
          },
        };
        
        const decision = makeDecision('post-task', validationResult);
        
        expect(decision.decision).toBe(DECISION.BLOCK);
        expect(decision.severity).toBe(VIOLATION_SEVERITY.HIGH);
      });
      
      it('should return ESCALATE if high violations and allowHighViolations context', () => {
        const validationResult = {
          status: 'BLOCK',
          v2Only: {
            passed: false,
            violations: [
              { type: 'LEGACY_ID_REFERENCE', file: 'test.js' },
            ],
          },
        };
        
        const context = { allowHighViolations: true };
        const decision = makeDecision('post-task', validationResult, context);
        
        expect(decision.decision).toBe(DECISION.ESCALATE);
        expect(decision.severity).toBe(VIOLATION_SEVERITY.HIGH);
      });
      
      it('should return ESCALATE if medium violations', () => {
        const validationResult = {
          status: 'BLOCK',
          v2Only: {
            passed: false,
            violations: [
              { type: 'LEGACY_BILLING_PROVIDER', file: 'test.js' },
            ],
          },
        };
        
        const decision = makeDecision('post-task', validationResult);
        
        expect(decision.decision).toBe(DECISION.ESCALATE);
        expect(decision.severity).toBe(VIOLATION_SEVERITY.MEDIUM);
      });
    });
  });
  
  describe('getSeverity', () => {
    it('should return null for empty violations', () => {
      expect(getSeverity([])).toBeNull();
      expect(getSeverity(null)).toBeNull();
    });
    
    it('should return CRITICAL for critical violation types', () => {
      const violations = [
        { type: 'LEGACY_IMPORT', file: 'test.js' },
      ];
      
      expect(getSeverity(violations)).toBe(VIOLATION_SEVERITY.CRITICAL);
    });
    
    it('should return HIGH for high violation types', () => {
      const violations = [
        { type: 'LEGACY_ID_REFERENCE', file: 'test.js' },
      ];
      
      expect(getSeverity(violations)).toBe(VIOLATION_SEVERITY.HIGH);
    });
    
    it('should return MEDIUM for medium violation types', () => {
      const violations = [
        { type: 'LEGACY_BILLING_PROVIDER', file: 'test.js' },
      ];
      
      expect(getSeverity(violations)).toBe(VIOLATION_SEVERITY.MEDIUM);
    });
    
    it('should return highest severity if mixed violations', () => {
      const violations = [
        { type: 'LEGACY_BILLING_PROVIDER', file: 'test.js' }, // MEDIUM
        { type: 'LEGACY_ID_REFERENCE', file: 'test2.js' },    // HIGH
      ];
      
      expect(getSeverity(violations)).toBe(VIOLATION_SEVERITY.HIGH);
      
      const violations2 = [
        { type: 'LEGACY_ID_REFERENCE', file: 'test.js' },     // HIGH
        { type: 'LEGACY_IMPORT', file: 'test2.js' },          // CRITICAL
      ];
      
      expect(getSeverity(violations2)).toBe(VIOLATION_SEVERITY.CRITICAL);
    });
  });
  
  describe('hasCriticalViolations', () => {
    it('should return false for empty violations', () => {
      expect(hasCriticalViolations([])).toBe(false);
      expect(hasCriticalViolations(null)).toBe(false);
    });
    
    it('should return true if any critical violation', () => {
      const violations = [
        { type: 'LEGACY_ID_REFERENCE', file: 'test.js' },  // HIGH
        { type: 'LEGACY_IMPORT', file: 'test2.js' },       // CRITICAL
      ];
      
      expect(hasCriticalViolations(violations)).toBe(true);
    });
    
    it('should return false if no critical violations', () => {
      const violations = [
        { type: 'LEGACY_ID_REFERENCE', file: 'test.js' },  // HIGH
      ];
      
      expect(hasCriticalViolations(violations)).toBe(false);
    });
  });
  
  describe('summarizeViolations', () => {
    it('should return empty summary for no violations', () => {
      const summary = summarizeViolations([]);
      
      expect(summary.total).toBe(0);
      expect(summary.critical).toBe(0);
      expect(summary.high).toBe(0);
      expect(summary.medium).toBe(0);
      expect(summary.low).toBe(0);
      expect(Object.keys(summary.byType)).toHaveLength(0);
    });
    
    it('should count violations correctly', () => {
      const violations = [
        { type: 'LEGACY_IMPORT', file: 'test1.js' },           // CRITICAL
        { type: 'LEGACY_FILE_MODIFICATION', file: 'test2.js' }, // CRITICAL
        { type: 'LEGACY_ID_REFERENCE', file: 'test3.js' },     // HIGH
        { type: 'LEGACY_BILLING_PROVIDER', file: 'test4.js' }, // MEDIUM
      ];
      
      const summary = summarizeViolations(violations);
      
      expect(summary.total).toBe(4);
      expect(summary.critical).toBe(2);
      expect(summary.high).toBe(1);
      expect(summary.medium).toBe(1);
      expect(summary.low).toBe(0);
      
      expect(summary.byType['LEGACY_IMPORT']).toBe(1);
      expect(summary.byType['LEGACY_FILE_MODIFICATION']).toBe(1);
      expect(summary.byType['LEGACY_ID_REFERENCE']).toBe(1);
      expect(summary.byType['LEGACY_BILLING_PROVIDER']).toBe(1);
    });
  });
  
  describe('shouldRollback', () => {
    it('should return true for BLOCK decision', () => {
      const decision = { decision: DECISION.BLOCK };
      expect(shouldRollback(decision)).toBe(true);
    });
    
    it('should return false for other decisions', () => {
      expect(shouldRollback({ decision: DECISION.CONTINUE })).toBe(false);
      expect(shouldRollback({ decision: DECISION.ESCALATE })).toBe(false);
      expect(shouldRollback({ decision: DECISION.COMPLETED })).toBe(false);
    });
  });
  
  describe('shouldEscalate', () => {
    it('should return true for ESCALATE decision', () => {
      const decision = { decision: DECISION.ESCALATE };
      expect(shouldEscalate(decision)).toBe(true);
    });
    
    it('should return false for other decisions', () => {
      expect(shouldEscalate({ decision: DECISION.CONTINUE })).toBe(false);
      expect(shouldEscalate({ decision: DECISION.BLOCK })).toBe(false);
      expect(shouldEscalate({ decision: DECISION.COMPLETED })).toBe(false);
    });
  });
});
