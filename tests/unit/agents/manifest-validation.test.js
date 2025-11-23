/**
 * Unit Tests: Agent Manifest Validation
 *
 * Tests manifest structure and validation rules
 *
 * @see agents/manifest.yaml
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('Agent Manifest Validation', () => {
  const manifestPath = path.join(__dirname, '../../../agents/manifest.yaml');
  let manifest;

  beforeAll(() => {
    const content = fs.readFileSync(manifestPath, 'utf8');
    manifest = yaml.load(content);
  });

  it('should validate manifest structure', () => {
    expect(manifest).toBeDefined();
    expect(manifest).toHaveProperty('agents');
    expect(Array.isArray(manifest.agents)).toBe(true);
  });

  it('should require name, type, status for each agent', () => {
    expect(manifest.agents.length).toBeGreaterThan(0);

    manifest.agents.forEach((agent) => {
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('type');
      expect(agent).toHaveProperty('status');
      expect(typeof agent.name).toBe('string');
      expect(agent.name.length).toBeGreaterThan(0);
    });
  });

  it('should validate trigger format', () => {
    manifest.agents.forEach((agent) => {
      if (agent.triggers && agent.triggers.labels) {
        expect(Array.isArray(agent.triggers.labels)).toBe(true);
      }
      if (agent.triggers && agent.triggers.diffIncludes) {
        expect(Array.isArray(agent.triggers.diffIncludes)).toBe(true);
      }
    });
  });

  it('should detect duplicate agent names', () => {
    const names = manifest.agents.map((agent) => agent.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('should validate guardrails array', () => {
    manifest.agents.forEach((agent) => {
      if (agent.guardrails) {
        expect(Array.isArray(agent.guardrails)).toBe(true);
      }
    });
  });

  it('should validate outputs array', () => {
    manifest.agents.forEach((agent) => {
      if (agent.outputs) {
        expect(Array.isArray(agent.outputs)).toBe(true);
      }
    });
  });

  it('should detect invalid agent types', () => {
    manifest.agents.forEach((agent) => {
      expect(['autonomous', 'orchestrator', 'specialized']).toContain(agent.type);
    });
  });

  it('should validate cost_model structure', () => {
    manifest.agents.forEach((agent) => {
      if (agent.cost_model) {
        expect(typeof agent.cost_model).toBe('object');
      }
    });
  });
});
