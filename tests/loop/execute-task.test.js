/**
 * Tests - Execute Task (Integration Tests)
 * 
 * Issue: ROA-539
 * Versión: 1.0.0
 * Fecha: 2026-01-22
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROGRESS_DIR = path.resolve(__dirname, '../../docs/autonomous-progress');
const EXECUTE_SCRIPT = path.resolve(__dirname, '../../scripts/loop/execute-task.js');

describe('Execute Task - Path Security', () => {
  it('should allow valid alphanumeric taskIds', () => {
    const result = execSync(
      `node ${EXECUTE_SCRIPT} --task-id="test-abc-123" --instruction="echo test" --dry-run`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    
    expect(result).toContain('test-abc-123');
  });
  
  it('should reject path traversal attempts', () => {
    expect(() => {
      execSync(
        `node ${EXECUTE_SCRIPT} --task-id="../../../etc/passwd" --instruction="echo test" --dry-run`,
        { encoding: 'utf-8', timeout: 5000 }
      );
    }).toThrow();
  });
});

describe('Execute Task - Progress Tracking', () => {
  const testTaskId = 'test-progress-001';
  
  afterEach(() => {
    const taskDir = path.join(PROGRESS_DIR, testTaskId);
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true });
    }
  });
  
  it('should create progress directory structure', () => {
    execSync(
      `node ${EXECUTE_SCRIPT} --task-id="${testTaskId}" --instruction="echo test" --dry-run`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    
    const taskDir = path.join(PROGRESS_DIR, testTaskId);
    expect(fs.existsSync(taskDir)).toBe(true);
  });
  
  it('should create progress.json file', () => {
    execSync(
      `node ${EXECUTE_SCRIPT} --task-id="${testTaskId}" --instruction="echo test" --dry-run`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    
    const progressPath = path.join(PROGRESS_DIR, testTaskId, 'progress.json');
    expect(fs.existsSync(progressPath)).toBe(true);
  });
});

describe('Execute Task - CLI Arguments', () => {
  const testTaskId = 'test-cli-args';
  
  afterEach(() => {
    const taskDir = path.join(PROGRESS_DIR, testTaskId);
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true });
    }
  });
  
  it('should require task-id argument', () => {
    expect(() => {
      execSync(
        `node ${EXECUTE_SCRIPT} --instruction="echo test"`,
        { encoding: 'utf-8', timeout: 5000 }
      );
    }).toThrow();
  });
  
  it('should accept instruction argument', () => {
    const output = execSync(
      `node ${EXECUTE_SCRIPT} --task-id="${testTaskId}" --instruction="echo test" --dry-run`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    
    expect(output).toContain('test');
  });
  
  it('should parse args with equals in value', () => {
    const output = execSync(
      `node ${EXECUTE_SCRIPT} --task-id="${testTaskId}" --instruction="echo key=value=more" --dry-run`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    
    expect(output).toContain('key=value=more');
  });
});

describe('Execute Task - Dry Run Mode', () => {
  it('should execute in dry-run without making changes', () => {
    const testTaskId = 'test-dry-run-1';
    
    try {
      const output = execSync(
        `node ${EXECUTE_SCRIPT} --task-id="${testTaskId}" --instruction="echo test" --dry-run`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      
      expect(output).toBeDefined();
    } finally {
      const taskDir = path.join(PROGRESS_DIR, testTaskId);
      if (fs.existsSync(taskDir)) {
        fs.rmSync(taskDir, { recursive: true, force: true });
      }
    }
  });
  
  it('should track progress in progress.json', () => {
    const testTaskId = 'test-dry-run-2';
    
    try {
      execSync(
        `node ${EXECUTE_SCRIPT} --task-id="${testTaskId}" --instruction="echo test" --dry-run`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      
      const progressPath = path.join(PROGRESS_DIR, testTaskId, 'progress.json');
      expect(fs.existsSync(progressPath)).toBe(true);
      
      const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      
      // Verificar que tiene estructura básica
      expect(progress.taskId).toBe(testTaskId);
      expect(progress.status).toBeDefined();
    } finally {
      const taskDir = path.join(PROGRESS_DIR, testTaskId);
      if (fs.existsSync(taskDir)) {
        fs.rmSync(taskDir, { recursive: true, force: true });
      }
    }
  });
});

describe('Execute Task - Exit Codes', () => {
  const testTaskId = 'test-exit-codes';
  
  afterEach(() => {
    const taskDir = path.join(PROGRESS_DIR, testTaskId);
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true });
    }
  });
  
  it('should exit 0 on successful dry-run', () => {
    let exitCode = 0;
    try {
      execSync(
        `node ${EXECUTE_SCRIPT} --task-id="${testTaskId}" --instruction="echo test" --dry-run`,
        { encoding: 'utf-8', timeout: 5000 }
      );
    } catch (error) {
      exitCode = error.status || 1;
    }
    
    expect(exitCode).toBe(0);
  });
});

describe('Execute Task - V2-Only Integration', () => {
  const testTaskId = 'test-v2-gate';
  
  afterEach(() => {
    const taskDir = path.join(PROGRESS_DIR, testTaskId);
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true });
    }
  });
  
  it('should call pre-task validator', () => {
    const output = execSync(
      `node ${EXECUTE_SCRIPT} --task-id="${testTaskId}" --instruction="echo test" --dry-run`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    
    expect(output).toContain('Pre-task');
  });
});

describe('Execute Task - Output & Summary', () => {
  const testTaskId = 'test-output';
  
  afterEach(() => {
    const taskDir = path.join(PROGRESS_DIR, testTaskId);
    if (fs.existsSync(taskDir)) {
      fs.rmSync(taskDir, { recursive: true, force: true });
    }
  });
  
  it('should display summary at the end', () => {
    const output = execSync(
      `node ${EXECUTE_SCRIPT} --task-id="${testTaskId}" --instruction="echo test" --dry-run`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    
    expect(output).toContain('RESUMEN');
  });
});

describe('Execute Task - File System', () => {
  it('should verify execute-task.js exists', () => {
    expect(fs.existsSync(EXECUTE_SCRIPT)).toBe(true);
  });
});
