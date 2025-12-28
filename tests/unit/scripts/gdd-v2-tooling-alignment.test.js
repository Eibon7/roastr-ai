const os = require('os');
const path = require('path');
const { mkdtemp, mkdir, writeFile, rm } = require('fs').promises;

const { GDDValidator } = require('../../../scripts/validate-gdd-runtime');
const { GDDHealthScorer } = require('../../../scripts/score-gdd-health');

async function writeFileRecursive(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

describe('ROA-516 — GDD v2 tooling alignment', () => {
  let tempRoot;

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it('does not require system-map node IDs to match docs filenames', async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gdd-v2-alignment-'));

    await writeFileRecursive(
      path.join(tempRoot, 'docs', 'system-map-v2.yaml'),
      [
        'nodes:',
        '  node-a:',
        '    last_updated: "2025-12-28T00:00:00.000Z"',
        '    docs:',
        '      - docs/nodes-v2/non-matching-file.md'
      ].join('\n')
    );

    await writeFileRecursive(
      path.join(tempRoot, 'docs', 'nodes-v2', 'non-matching-file.md'),
      '# Node A\n'
    );

    const validator = new GDDValidator({
      rootDir: tempRoot,
      ci: true,
      skipReports: true,
      gddVersion: 'v2'
    });

    const results = await validator.validate();
    expect(results.status).toBe('healthy');
    expect(results.missing_refs).toHaveLength(0);
  });

  it('fails v2 validation when system-map references missing docs paths', async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gdd-v2-alignment-'));

    await writeFileRecursive(
      path.join(tempRoot, 'docs', 'system-map-v2.yaml'),
      [
        'nodes:',
        '  node-a:',
        '    last_updated: "2025-12-28T00:00:00.000Z"',
        '    docs:',
        '      - docs/nodes-v2/does-not-exist.md'
      ].join('\n')
    );

    const validator = new GDDValidator({
      rootDir: tempRoot,
      ci: true,
      skipReports: true,
      gddVersion: 'v2'
    });

    const results = await validator.validate();
    expect(results.status).toBe('critical');
    expect(results.missing_refs.some((r) => r.type === 'missing_doc_path')).toBe(true);
  });

  it('ignores legacy spec.md references in v2 validation mode', async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gdd-v2-alignment-'));

    await writeFileRecursive(
      path.join(tempRoot, 'docs', 'system-map-v2.yaml'),
      [
        'nodes:',
        '  node-a:',
        '    last_updated: "2025-12-28T00:00:00.000Z"',
        '    docs:',
        '      - docs/nodes-v2/node-a.md'
      ].join('\n')
    );

    await writeFileRecursive(path.join(tempRoot, 'docs', 'nodes-v2', 'node-a.md'), '# Node A\n');

    await writeFileRecursive(
      path.join(tempRoot, 'spec.md'),
      [
        '# Legacy spec',
        '',
        'References to deprecated nodes should not fail v2 validation:',
        '- guardian',
        '- queue-system'
      ].join('\n')
    );

    const validator = new GDDValidator({
      rootDir: tempRoot,
      ci: true,
      skipReports: true,
      gddVersion: 'v2'
    });

    const results = await validator.validate();
    expect(results.status).toBe('healthy');
  });

  it('scores v2 health without v1-only metrics (coverage/agents/spec)', async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gdd-v2-alignment-'));

    await writeFileRecursive(
      path.join(tempRoot, 'docs', 'system-map-v2.yaml'),
      [
        'validation:',
        '  update_freshness_days: 30',
        'nodes:',
        '  node-a:',
        '    status: production',
        '    last_updated: "2025-12-28T00:00:00.000Z"',
        '    depends_on: []',
        '    required_by: []',
        '    docs:',
        '      - docs/nodes-v2/node-a.md'
      ].join('\n')
    );

    await writeFileRecursive(path.join(tempRoot, 'docs', 'nodes-v2', 'node-a.md'), '# Node A\n');

    const scorer = new GDDHealthScorer({ rootDir: tempRoot, ci: false, json: true });
    const { stats, scores } = await scorer.score();

    expect(stats.overall_score).toBe(100);
    expect(scores['node-a'].breakdown).toMatchObject({
      docsIntegrity: 100,
      dependencyIntegrity: 100,
      symmetryIntegrity: 100,
      updateFreshness: 100
    });
  });
});

