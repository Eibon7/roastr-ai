/**
 * Tests - PRD Parser
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const path = require('path');
const {
  parsePRD,
  extractTitle,
  extractObjectives,
  extractAcceptanceCriteria,
  extractOutOfScope,
  extractTechnicalNotes,
  generateSubtasksFromACs,
  isInScope,
  findSubtaskByAC,
} = require('../../scripts/loop/lib/prd-parser');

// PRD de ejemplo para tests
const EXAMPLE_PRD_PATH = path.resolve(__dirname, '../../docs/prd/example-roast-v2-endpoint.md');

describe('PRD Parser', () => {
  describe('parsePRD', () => {
    it('should parse PRD file successfully', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      expect(prd.path).toBe(EXAMPLE_PRD_PATH);
      expect(prd.title).toBe('Roast V2 Endpoint');
      expect(prd.objectives).toBeInstanceOf(Array);
      expect(prd.acceptanceCriteria).toBeInstanceOf(Array);
      expect(prd.outOfScope).toBeInstanceOf(Array);
      expect(prd.technicalNotes).toBeInstanceOf(Array);
      expect(prd.subtasks).toBeInstanceOf(Array);
    });
    
    it('should throw error if PRD file not found', () => {
      expect(() => {
        parsePRD('/nonexistent/path/prd.md');
      }).toThrow('PRD file not found');
    });
  });
  
  describe('extractTitle', () => {
    it('should extract title from "# PRD:" format', () => {
      const content = '# PRD: My Feature\n\nContent...';
      expect(extractTitle(content)).toBe('My Feature');
    });
    
    it('should extract title from "# " format', () => {
      const content = '# My Feature\n\nContent...';
      expect(extractTitle(content)).toBe('My Feature');
    });
    
    it('should return default title if no title found', () => {
      const content = 'No title here\n\nContent...';
      expect(extractTitle(content)).toBe('Untitled PRD');
    });
  });
  
  describe('extractObjectives', () => {
    it('should extract objectives from PRD', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      expect(prd.objectives.length).toBeGreaterThan(0);
      expect(prd.objectives[0]).toContain('endpoint');
    });
  });
  
  describe('extractAcceptanceCriteria', () => {
    it('should extract all ACs from PRD', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      expect(prd.acceptanceCriteria.length).toBeGreaterThanOrEqual(4);
      
      const ac1 = prd.acceptanceCriteria.find(ac => ac.id === 'AC1');
      expect(ac1).toBeDefined();
      expect(ac1.title).toContain('Crear endpoint');
      expect(ac1.checklist).toBeInstanceOf(Array);
      expect(ac1.checklist.length).toBeGreaterThan(0);
    });
    
    it('should parse checklist items correctly', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      const ac1 = prd.acceptanceCriteria.find(ac => ac.id === 'AC1');
      
      expect(ac1.checklist[0]).toHaveProperty('item');
      expect(ac1.checklist[0]).toHaveProperty('completed');
      expect(ac1.checklist[0].completed).toBe(false);
    });
  });
  
  describe('extractOutOfScope', () => {
    it('should extract out-of-scope items', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      expect(prd.outOfScope.length).toBeGreaterThan(0);
      expect(prd.outOfScope[0]).toContain('UI');
    });
  });
  
  describe('extractTechnicalNotes', () => {
    it('should extract technical notes', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      expect(prd.technicalNotes.length).toBeGreaterThan(0);
      expect(prd.technicalNotes[0]).toContain('apps/backend-v2');
    });
  });
  
  describe('generateSubtasksFromACs', () => {
    it('should generate subtasks from ACs', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      expect(prd.subtasks.length).toBeGreaterThanOrEqual(4);
      
      const subtask1 = prd.subtasks.find(st => st.acId === 'AC1');
      expect(subtask1).toBeDefined();
      expect(subtask1.id).toBe('subtask-ac1');
      expect(subtask1.status).toBe('pending');
      expect(subtask1.checklist).toBeInstanceOf(Array);
    });
  });
  
  describe('isInScope', () => {
    it('should return true for task in AC', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      expect(isInScope(prd, 'Crear endpoint POST /api/v2/roast')).toBe(true);
    });
    
    it('should return true for task in objectives', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      expect(isInScope(prd, 'Integrar con roasting-engine V2')).toBe(true);
    });
    
    it('should return true by default if not explicitly out of scope', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      // Por defecto, si no está en out-of-scope explícitamente, se asume en scope
      expect(isInScope(prd, 'Nueva feature no mencionada')).toBe(true);
    });
  });
  
  describe('findSubtaskByAC', () => {
    it('should find subtask by AC ID', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      const subtask = findSubtaskByAC(prd, 'AC1');
      expect(subtask).toBeDefined();
      expect(subtask.acId).toBe('AC1');
    });
    
    it('should return null if AC not found', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      const subtask = findSubtaskByAC(prd, 'AC999');
      expect(subtask).toBeNull();
    });
    
    it('should be case-insensitive', () => {
      const prd = parsePRD(EXAMPLE_PRD_PATH);
      
      const subtask = findSubtaskByAC(prd, 'ac1');
      expect(subtask).toBeDefined();
      expect(subtask.acId).toBe('AC1');
    });
  });
});
