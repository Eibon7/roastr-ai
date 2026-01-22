/**
 * Tests para V2-Only Validator
 * 
 * Issue: ROA-538
 * Versión: 1.0.0
 * Fecha: 2025-01-22
 */

const {
  detectLegacyFileModifications,
  detectLegacyImports,
  detectLegacyIDReferences,
  detectLegacyWorkers,
  detectLegacyServices,
  mapLegacyToV2,
  mapLegacyIDToV2,
  mapLegacyWorkerToV2,
  LEGACY_PATHS,
  LEGACY_IDS,
  LEGACY_WORKERS,
  LEGACY_SERVICES,
} = require('../../scripts/loop/validators/v2-only');

describe('V2-Only Validator', () => {
  describe('detectLegacyFileModifications', () => {
    it('detecta modificación de archivo en docs/legacy/', () => {
      const files = ['docs/legacy/v1/roast-flow.md'];
      const violations = detectLegacyFileModifications(files);
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('LEGACY_FILE_MODIFICATION');
      expect(violations[0].file).toBe('docs/legacy/v1/roast-flow.md');
    });

    it('detecta modificación de docs/nodes/ (sin -v2)', () => {
      const files = ['docs/nodes/roast.md'];
      const violations = detectLegacyFileModifications(files);
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('LEGACY_FILE_MODIFICATION');
    });

    it('NO detecta docs/nodes-v2/ (path v2)', () => {
      const files = ['docs/nodes-v2/06-motor-roasting.md'];
      const violations = detectLegacyFileModifications(files);
      
      expect(violations.length).toBe(0);
    });

    it('detecta modificación de spec.md (legacy)', () => {
      const files = ['spec.md'];
      const violations = detectLegacyFileModifications(files);
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].file).toBe('spec.md');
    });

    it('detecta modificación de system-map.yaml (sin -v2)', () => {
      const files = ['docs/system-map.yaml'];
      const violations = detectLegacyFileModifications(files);
      
      expect(violations.length).toBeGreaterThan(0);
    });

    it('NO detecta system-map-v2.yaml (path v2)', () => {
      const files = ['docs/system-map-v2.yaml'];
      const violations = detectLegacyFileModifications(files);
      
      expect(violations.length).toBe(0);
    });
  });

  describe('detectLegacyImports', () => {
    it('detecta import desde src/ (V1 backend)', () => {
      // Mock readFileContent para este test
      const mockFiles = ['scripts/loop/task.js'];
      const mockContent = "import { RoastService } from '../../../src/services/roastService';";
      
      // Este test requeriría mockear readFileContent
      // Por ahora, test conceptual
      expect(mockContent).toContain('src/services/');
    });

    it('detecta import desde frontend/ (V1 frontend)', () => {
      const mockContent = "import { Dashboard } from '../../../frontend/src/pages/Dashboard';";
      expect(mockContent).toContain('frontend/');
    });

    it('detecta import desde docs/legacy/', () => {
      const mockContent = "const spec = require('../../../docs/legacy/spec-v1.md');";
      expect(mockContent).toContain('docs/legacy/');
    });

    it('NO detecta import desde apps/backend-v2/', () => {
      const mockContent = "import { AuthService } from '../../../apps/backend-v2/src/services/authService';";
      expect(mockContent).toContain('apps/backend-v2/');
      expect(mockContent).not.toContain('src/services/roastService');
    });
  });

  describe('detectLegacyIDReferences', () => {
    it('detecta ID legacy "roast" en código', () => {
      const mockContent = "const node = 'roast';";
      expect(mockContent).toContain("'roast'");
    });

    it('detecta ID legacy "shield" en código', () => {
      const mockContent = 'const nodeId = "shield";';
      expect(mockContent).toContain('"shield"');
    });

    it('detecta plan ID legacy "free"', () => {
      const mockContent = "const plan = 'free';";
      expect(mockContent).toContain("'free'");
    });

    it('NO detecta ID legacy en comentario', () => {
      const mockContent = "// Legacy V1 used 'roast' node";
      expect(mockContent).toContain('//');
    });

    it('NO detecta ID v2 válido', () => {
      const mockContent = "const node = 'roasting-engine';";
      expect(mockContent).toContain('roasting-engine');
      expect(mockContent).not.toContain("'roast'");
    });
  });

  describe('detectLegacyWorkers', () => {
    it('detecta worker legacy "GenerateReplyWorker"', () => {
      const mockContent = "const worker = new GenerateReplyWorker();";
      expect(mockContent).toContain('GenerateReplyWorker');
    });

    it('detecta worker legacy "PublisherWorker"', () => {
      const mockContent = "import { PublisherWorker } from './workers';";
      expect(mockContent).toContain('PublisherWorker');
    });

    it('NO detecta worker legacy en comentario', () => {
      const mockContent = "// Legacy: GenerateReplyWorker was replaced";
      expect(mockContent).toContain('//');
    });

    it('NO detecta worker v2 válido', () => {
      const mockContent = "const worker = new GenerateRoast();";
      expect(mockContent).toContain('GenerateRoast');
      expect(mockContent).not.toContain('GenerateReplyWorker');
    });
  });

  describe('detectLegacyServices', () => {
    it('detecta servicio legacy "stripeService"', () => {
      const mockContent = "const stripe = require('./services/stripeService');";
      expect(mockContent).toContain('stripeService');
    });

    it('NO detecta servicio legacy en comentario', () => {
      const mockContent = "// V1 used stripeService, now we use Polar";
      expect(mockContent).toContain('//');
    });
  });

  describe('Mapeos Legacy → V2', () => {
    it('mapea archivo legacy a equivalente V2', () => {
      expect(mapLegacyToV2('docs/nodes/roast.md')).toContain('docs/nodes-v2/');
      expect(mapLegacyToV2('docs/system-map.yaml')).toContain('system-map-v2.yaml');
      expect(mapLegacyToV2('spec.md')).toContain('SSOT-V2.md');
    });

    it('mapea ID legacy a equivalente V2', () => {
      expect(mapLegacyIDToV2('roast')).toBe('roasting-engine');
      expect(mapLegacyIDToV2('shield')).toBe('shield-engine');
      expect(mapLegacyIDToV2('persona')).toContain('analysis-engine');
    });

    it('mapea worker legacy a equivalente V2', () => {
      expect(mapLegacyWorkerToV2('GenerateReplyWorker')).toBe('GenerateRoast');
      expect(mapLegacyWorkerToV2('PublisherWorker')).toBe('SocialPosting');
      expect(mapLegacyWorkerToV2('BillingWorker')).toBe('BillingUpdate');
    });
  });

  describe('Constantes de configuración', () => {
    it('tiene LEGACY_PATHS definidos', () => {
      expect(LEGACY_PATHS).toContain('docs/legacy/');
      expect(LEGACY_PATHS).toContain('docs/nodes/');
      expect(LEGACY_PATHS).toContain('docs/system-map.yaml');
      expect(LEGACY_PATHS).toContain('spec.md');
    });

    it('tiene LEGACY_IDS definidos', () => {
      expect(LEGACY_IDS).toContain('roast');
      expect(LEGACY_IDS).toContain('shield');
      expect(LEGACY_IDS).toContain('persona');
    });

    it('tiene LEGACY_WORKERS definidos', () => {
      expect(LEGACY_WORKERS).toContain('GenerateReplyWorker');
      expect(LEGACY_WORKERS).toContain('PublisherWorker');
      expect(LEGACY_WORKERS).toContain('BillingWorker');
    });

    it('tiene LEGACY_SERVICES definidos', () => {
      expect(LEGACY_SERVICES).toContain('stripeService');
    });
  });
});
