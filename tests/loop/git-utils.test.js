/**
 * Tests - Git Utils (Unit Tests)
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 * 
 * Nota: Tests básicos que verifican la API pública sin modificar el repo.
 */

const gitUtils = require('../../scripts/loop/lib/git-utils');

describe('Git Utils', () => {
  describe('isWorkingDirectoryClean', () => {
    it('should return boolean', () => {
      const result = gitUtils.isWorkingDirectoryClean();
      expect(typeof result).toBe('boolean');
    });
  });
  
  describe('getCurrentCommit', () => {
    it('should return commit SHA string', () => {
      const result = gitUtils.getCurrentCommit();
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // SHA format (al menos 7 caracteres hex)
      expect(result).toMatch(/^[a-f0-9]{7,}$/);
    });
  });
  
  describe('getCurrentBranch', () => {
    it('should return branch name string', () => {
      const result = gitUtils.getCurrentBranch();
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
  
  describe('getModifiedFiles', () => {
    it('should return array', () => {
      const result = gitUtils.getModifiedFiles();
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  describe('getStagedFiles', () => {
    it('should return array', () => {
      const result = gitUtils.getStagedFiles();
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  describe('API validation', () => {
    it('should export all required functions', () => {
      expect(typeof gitUtils.isWorkingDirectoryClean).toBe('function');
      expect(typeof gitUtils.getCurrentCommit).toBe('function');
      expect(typeof gitUtils.getCurrentBranch).toBe('function');
      expect(typeof gitUtils.getModifiedFiles).toBe('function');
      expect(typeof gitUtils.getStagedFiles).toBe('function');
      expect(typeof gitUtils.stashChanges).toBe('function');
      expect(typeof gitUtils.popStash).toBe('function');
      expect(typeof gitUtils.dropStash).toBe('function');
      expect(typeof gitUtils.createTempCommit).toBe('function');
      expect(typeof gitUtils.amendCommit).toBe('function');
      expect(typeof gitUtils.revertCommit).toBe('function');
      expect(typeof gitUtils.resetToCommit).toBe('function');
    });
  });
});
