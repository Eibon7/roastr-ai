/**
 * Tests - Escalation Handler
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const fs = require('fs');
const path = require('path');
const {
  ESCALATION_OPTIONS,
  readEscalationFile,
  saveEscalation,
  getEscalationFilePath,
  markEscalationResolved,
} = require('../../scripts/loop/lib/escalation');

const PROGRESS_DIR = path.resolve(__dirname, '../../docs/autonomous-progress');

describe('Escalation Handler', () => {
  const mockTaskId = 'test-escalation-001';
  const mockReason = 'High-severity violations detected';
  const mockViolations = [
    {
      type: 'LEGACY_ID_REFERENCE',
      file: 'test.js',
      details: 'Legacy ID found',
      suggestion: 'Use V2 ID',
    },
  ];
  
  afterEach(() => {
    // Limpiar archivos de test
    const taskDir = path.join(PROGRESS_DIR, mockTaskId);
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true });
    }
  });
  
  describe('ESCALATION_OPTIONS', () => {
    it('should have all required options', () => {
      expect(ESCALATION_OPTIONS.APPROVE).toBe('approve');
      expect(ESCALATION_OPTIONS.REJECT).toBe('reject');
      expect(ESCALATION_OPTIONS.MODIFY).toBe('modify');
      expect(ESCALATION_OPTIONS.ABORT).toBe('abort');
    });
  });
  
  describe('saveEscalation', () => {
    it('should create escalation files', () => {
      saveEscalation(mockTaskId, mockReason, mockViolations);
      
      const taskDir = path.join(PROGRESS_DIR, mockTaskId, 'artifacts');
      expect(fs.existsSync(taskDir)).toBe(true);
      
      const escalationPath = path.join(taskDir, 'escalation.json');
      expect(fs.existsSync(escalationPath)).toBe(true);
      
      const escalation = JSON.parse(fs.readFileSync(escalationPath, 'utf-8'));
      expect(escalation.taskId).toBe(mockTaskId);
      expect(escalation.reason).toBe(mockReason);
      expect(escalation.violations).toEqual(mockViolations);
      expect(escalation.status).toBe('pending');
    });
    
    it('should create instructions file', () => {
      saveEscalation(mockTaskId, mockReason, mockViolations);
      
      const instructionsPath = path.join(
        PROGRESS_DIR,
        mockTaskId,
        'artifacts',
        'ESCALATION-INSTRUCTIONS.txt'
      );
      expect(fs.existsSync(instructionsPath)).toBe(true);
      
      const instructions = fs.readFileSync(instructionsPath, 'utf-8');
      expect(instructions).toContain('ESCALACIÓN REQUERIDA');
      expect(instructions).toContain(mockTaskId);
      expect(instructions).toContain(mockReason);
      expect(instructions).toContain('APPROVE');
      expect(instructions).toContain('REJECT');
    });
  });
  
  describe('getEscalationFilePath', () => {
    it('should return correct path', () => {
      const filePath = getEscalationFilePath(mockTaskId);
      
      expect(filePath).toBe(
        path.join(PROGRESS_DIR, mockTaskId, 'escalation-decision.json')
      );
    });
  });
  
  describe('readEscalationFile', () => {
    it('should read JSON decision file', () => {
      const decisionPath = getEscalationFilePath(mockTaskId);
      const taskDir = path.dirname(decisionPath);
      
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(
        decisionPath,
        JSON.stringify({
          option: 'approve',
          reason: 'Approved by human',
          timestamp: new Date().toISOString(),
        })
      );
      
      const decision = readEscalationFile(decisionPath);
      
      expect(decision.option).toBe(ESCALATION_OPTIONS.APPROVE);
      expect(decision.reason).toBe('Approved by human');
      expect(decision.timestamp).toBeDefined();
    });
    
    it('should parse text file with option', () => {
      const decisionPath = getEscalationFilePath(mockTaskId);
      const taskDir = path.dirname(decisionPath);
      
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(decisionPath, 'approve\nSome additional comments');
      
      const decision = readEscalationFile(decisionPath);
      
      expect(decision.option).toBe(ESCALATION_OPTIONS.APPROVE);
      expect(decision.reason).toBe('Decision from text file');
    });
    
    it('should parse reject option from text', () => {
      const decisionPath = getEscalationFilePath(mockTaskId);
      const taskDir = path.dirname(decisionPath);
      
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(decisionPath, 'reject');
      
      const decision = readEscalationFile(decisionPath);
      expect(decision.option).toBe(ESCALATION_OPTIONS.REJECT);
    });
    
    it('should parse modify option from text', () => {
      const decisionPath = getEscalationFilePath(mockTaskId);
      const taskDir = path.dirname(decisionPath);
      
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(decisionPath, 'modify');
      
      const decision = readEscalationFile(decisionPath);
      expect(decision.option).toBe(ESCALATION_OPTIONS.MODIFY);
    });
    
    it('should parse abort option from text', () => {
      const decisionPath = getEscalationFilePath(mockTaskId);
      const taskDir = path.dirname(decisionPath);
      
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(decisionPath, 'abort');
      
      const decision = readEscalationFile(decisionPath);
      expect(decision.option).toBe(ESCALATION_OPTIONS.ABORT);
    });
    
    it('should default to abort on invalid text', () => {
      const decisionPath = getEscalationFilePath(mockTaskId);
      const taskDir = path.dirname(decisionPath);
      
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(decisionPath, 'invalid option');
      
      const decision = readEscalationFile(decisionPath);
      expect(decision.option).toBe(ESCALATION_OPTIONS.ABORT);
    });
  });
  
  describe('markEscalationResolved', () => {
    it('should update escalation status', () => {
      saveEscalation(mockTaskId, mockReason, mockViolations);
      
      const decision = {
        option: ESCALATION_OPTIONS.APPROVE,
        reason: 'Approved after review',
        timestamp: new Date().toISOString(),
      };
      
      markEscalationResolved(mockTaskId, decision);
      
      const escalationPath = path.join(
        PROGRESS_DIR,
        mockTaskId,
        'artifacts',
        'escalation.json'
      );
      const escalation = JSON.parse(fs.readFileSync(escalationPath, 'utf-8'));
      
      expect(escalation.status).toBe('resolved');
      expect(escalation.decision).toEqual(decision);
      expect(escalation.resolvedAt).toBeDefined();
    });
    
    it('should handle missing escalation file gracefully', () => {
      const decision = {
        option: ESCALATION_OPTIONS.ABORT,
        reason: 'No escalation file',
        timestamp: new Date().toISOString(),
      };
      
      // No debería lanzar error si archivo no existe
      expect(() => {
        markEscalationResolved('nonexistent-task', decision);
      }).not.toThrow();
    });
  });
  
  describe('Escalation Options Validation', () => {
    it('should have unique option values', () => {
      const values = Object.values(ESCALATION_OPTIONS);
      const uniqueValues = new Set(values);
      
      expect(values.length).toBe(uniqueValues.size);
    });
    
    it('should have lowercase option values', () => {
      const values = Object.values(ESCALATION_OPTIONS);
      
      values.forEach(value => {
        expect(value).toBe(value.toLowerCase());
      });
    });
  });
});
