/**
 * Jest Configuration Validation Test
 * Validates CodeRabbit fixes for project configuration issues
 */

const jestConfig = require('../../../jest.testing-mvp.config.js');

describe('Jest Configuration - Projects Config Fix (CodeRabbit)', () => {
  
  test('should have JSON reporter in coverageReporters for Codecov', () => {
    // Main config should include JSON reporter
    expect(jestConfig.coverageReporters).toContain('json');
    expect(jestConfig.coverageReporters).toContain('json-summary');
    console.log('✅ JSON coverage reporters configured for Codecov compatibility');
  });

  test('should have complete project configurations with shared settings', () => {
    const projects = jestConfig.projects;
    expect(projects).toBeDefined();
    expect(projects.length).toBe(3); // unit, integration, e2e
    
    projects.forEach(project => {
      // Each project should have setup files
      expect(project.setupFilesAfterEnv).toContain('<rootDir>/tests/helpers/test-setup.js');
      expect(project.setupFiles).toContain('<rootDir>/tests/helpers/env-setup.js');
      
      // Each project should have coverage configuration
      expect(project.collectCoverageFrom).toBeDefined();
      expect(project.coverageDirectory).toBeDefined();
      expect(project.coverageReporters).toContain('json');
      expect(project.coverageReporters).toContain('json-summary');
      
      // Each project should have coverage thresholds
      expect(project.coverageThreshold).toBeDefined();
      expect(project.coverageThreshold.global).toBeDefined();
      expect(project.coverageThreshold['src/services/']).toBeDefined();
      expect(project.coverageThreshold['src/workers/']).toBeDefined();
      
      console.log(`✅ Project "${project.displayName}" has complete configuration`);
    });
  });

  test('should have appropriate timeouts for different test types', () => {
    const projects = jestConfig.projects;
    
    const unitProject = projects.find(p => p.displayName === 'unit');
    const integrationProject = projects.find(p => p.displayName === 'integration');
    const e2eProject = projects.find(p => p.displayName === 'e2e');
    
    expect(unitProject.testTimeout).toBe(10000); // 10 seconds
    expect(integrationProject.testTimeout).toBe(45000); // 45 seconds
    expect(e2eProject.testTimeout).toBe(60000); // 60 seconds
    
    console.log('✅ Test timeouts configured appropriately for each test type');
  });

  test('should have consistent coverage thresholds across projects', () => {
    const projects = jestConfig.projects;
    
    projects.forEach(project => {
      const thresholds = project.coverageThreshold;
      
      // Global thresholds
      expect(thresholds.global.lines).toBe(80);
      expect(thresholds.global.functions).toBe(75);
      expect(thresholds.global.branches).toBe(70);
      expect(thresholds.global.statements).toBe(80);
      
      // Services thresholds (higher requirements)
      expect(thresholds['src/services/'].lines).toBe(90);
      expect(thresholds['src/services/'].functions).toBe(85);
      expect(thresholds['src/services/'].branches).toBe(80);
      expect(thresholds['src/services/'].statements).toBe(90);
      
      // Workers thresholds
      expect(thresholds['src/workers/'].lines).toBe(85);
      expect(thresholds['src/workers/'].functions).toBe(80);
      expect(thresholds['src/workers/'].branches).toBe(75);
      expect(thresholds['src/workers/'].statements).toBe(85);
    });
    
    console.log('✅ Coverage thresholds consistent across all projects');
  });

  test('should exclude appropriate files from coverage', () => {
    const projects = jestConfig.projects;
    
    projects.forEach(project => {
      const coverageFrom = project.collectCoverageFrom;
      
      expect(coverageFrom).toContain('src/**/*.js');
      expect(coverageFrom).toContain('!src/public/**');
      expect(coverageFrom).toContain('!src/**/*.test.js');
      expect(coverageFrom).toContain('!src/**/test-*.js');
    });
    
    console.log('✅ Coverage exclusions properly configured');
  });
  
});