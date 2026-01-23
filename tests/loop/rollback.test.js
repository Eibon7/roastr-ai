/**
 * Tests - Rollback Manager (Unit Tests)
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const { RollbackState } = require('../../scripts/loop/lib/rollback');

describe('Rollback Manager', () => {
  describe('RollbackState', () => {
    it('should create instance with taskId', () => {
      const taskId = 'test-task-001';
      const state = new RollbackState(taskId);
      
      expect(state.taskId).toBe(taskId);
      expect(state.originalCommit).toBeNull();
      expect(state.originalBranch).toBeNull();
      expect(state.tempCommit).toBeNull();
      expect(state.stashCreated).toBe(false);
      expect(state.timestamp).toBeDefined();
    });
    
    it('should capture current git state', () => {
      const state = new RollbackState('test-task-002');
      state.capture();
      
      expect(state.originalCommit).toBeDefined();
      expect(state.originalBranch).toBeDefined();
      expect(typeof state.originalCommit).toBe('string');
      expect(typeof state.originalBranch).toBe('string');
      expect(state.originalCommit.length).toBeGreaterThan(0);
    });
    
    it('should mark stash created', () => {
      const state = new RollbackState('test-task-003');
      
      expect(state.stashCreated).toBe(false);
      state.markStashCreated();
      expect(state.stashCreated).toBe(true);
    });
    
    it('should mark temp commit', () => {
      const state = new RollbackState('test-task-004');
      const mockCommitSha = 'abc123def456';
      
      expect(state.tempCommit).toBeNull();
      state.markTempCommit(mockCommitSha);
      expect(state.tempCommit).toBe(mockCommitSha);
    });
    
    it('should serialize to JSON correctly', () => {
      const state = new RollbackState('test-task-005');
      state.capture();
      state.markStashCreated();
      state.markTempCommit('temp-sha');
      
      const json = state.toJSON();
      
      expect(json).toMatchObject({
        taskId: 'test-task-005',
        originalCommit: expect.any(String),
        originalBranch: expect.any(String),
        tempCommit: 'temp-sha',
        stashCreated: true,
        timestamp: expect.any(String),
      });
    });
    
    it('should have valid ISO timestamp', () => {
      const state = new RollbackState('test-task-006');
      
      // Verificar que timestamp es ISO válido
      const parsed = new Date(state.timestamp);
      expect(parsed.toISOString()).toBe(state.timestamp);
    });
  });
  
  describe('RollbackState - Edge Cases', () => {
    it('should handle empty taskId', () => {
      expect(() => {
        new RollbackState('');
      }).not.toThrow();
    });
    
    it('should handle special characters in taskId', () => {
      const taskId = 'test-task-123_abc-xyz';
      const state = new RollbackState(taskId);
      
      expect(state.taskId).toBe(taskId);
    });
    
    it('should create independent instances', () => {
      const state1 = new RollbackState('task-001');
      const state2 = new RollbackState('task-002');
      
      state1.markStashCreated();
      
      expect(state1.stashCreated).toBe(true);
      expect(state2.stashCreated).toBe(false);
    });
  });
  
  describe('API Contract', () => {
    it('should have all required methods', () => {
      const state = new RollbackState('test');
      
      expect(typeof state.capture).toBe('function');
      expect(typeof state.markStashCreated).toBe('function');
      expect(typeof state.markTempCommit).toBe('function');
      expect(typeof state.toJSON).toBe('function');
    });
    
    it('should have all required properties', () => {
      const state = new RollbackState('test');
      
      expect(state).toHaveProperty('taskId');
      expect(state).toHaveProperty('originalCommit');
      expect(state).toHaveProperty('originalBranch');
      expect(state).toHaveProperty('tempCommit');
      expect(state).toHaveProperty('stashCreated');
      expect(state).toHaveProperty('timestamp');
    });
  });
});
