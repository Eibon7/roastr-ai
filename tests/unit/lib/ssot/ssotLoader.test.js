const { describe, test, expect, beforeEach, vi, afterEach } = require('vitest');
const fs = require('fs');
const ssotLoader = require('../../../../src/lib/ssot/ssotLoader');

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn()
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

describe('ssotLoader', () => {
  const mockSSOTContent = `# Roastr v2 — SSOT

## 4. Shield & Motor de Análisis

### 4.6 Gatekeeper Configuration

\`\`\`yaml
gatekeeper:
  mode: multiplicative
  thresholds:
    suspicious: 0.5
    highConfidence: 0.9
    maxScore: 1.0
  heuristics:
    multipleNewlines: 0.3
    codeBlocks: 0.4
    unusualLength: 0.2
    repeatedPhrases: 0.3
  heuristicsConfig:
    newlineThreshold: 3
    unusualLengthThreshold: 1000
    repeatedPhraseCount: 2
  patternWeights:
    instruction_override: 1.0
    prompt_extraction: 0.9
    role_manipulation: 0.9
    jailbreak: 1.0
    output_control: 0.7
    hidden_instruction: 0.7
    priority_override: 0.9
    encoding_trick: 0.7
\`\`\`
`;

  beforeEach(() => {
    vi.clearAllMocks();
    ssotLoader.clearCache();
  });

  afterEach(() => {
    ssotLoader.clearCache();
  });

  describe('getGatekeeperConfig', () => {
    test('should load configuration from SSOT file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockSSOTContent);

      const config = ssotLoader.getGatekeeperConfig();

      expect(config).toBeDefined();
      expect(config.mode).toBe('multiplicative');
      expect(config.thresholds.suspicious).toBe(0.5);
      expect(config.thresholds.highConfidence).toBe(0.9);
      expect(config.thresholds.maxScore).toBe(1.0);
    });

    test('should use defaults if SSOT file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const config = ssotLoader.getGatekeeperConfig();

      expect(config).toBeDefined();
      expect(config.mode).toBe('multiplicative');
      expect(config.thresholds.suspicious).toBe(0.5);
    });
  });
});
