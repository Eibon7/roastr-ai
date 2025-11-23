/**
 * Test fixtures loader deep cloning functionality
 * Validates CodeRabbit review fixes for PR #426
 */

const {
  loadFixtures,
  generateTestComments,
  createTestScenario
} = require('../../helpers/fixtures-loader');

describe('Fixtures Loader - Deep Cloning (CodeRabbit Fix)', () => {
  test('should return deep cloned comments fixtures to prevent mutations', async () => {
    // Load fixtures twice
    const fixtures1 = await loadFixtures('comments', 'spanish');
    const fixtures2 = await loadFixtures('comments', 'spanish');

    // They should have the same data but be different objects
    expect(fixtures1).toEqual(fixtures2);
    expect(fixtures1).not.toBe(fixtures2);

    // Mutate first fixture
    fixtures1.roastable[0].text = 'MUTATED';

    // Second fixture should be unaffected
    expect(fixtures2.roastable[0].text).not.toBe('MUTATED');
    expect(fixtures2.roastable[0].text).toBe('Esta aplicación es horrible, no funciona nada');
  });

  test('should return deep cloned user fixtures to prevent mutations', async () => {
    const users1 = await loadFixtures('users');
    const users2 = await loadFixtures('users');

    // They should have the same data but be different objects
    expect(users1).toEqual(users2);
    expect(users1).not.toBe(users2);

    // Mutate first fixture
    users1.organizations[0].name = 'MUTATED ORG';

    // Second fixture should be unaffected
    expect(users2.organizations[0].name).toBe('Test Organization 1');
  });

  test('should return cloned data from generateTestComments', () => {
    const comments1 = generateTestComments('test-org-1', 'spanish', 5);
    const comments2 = generateTestComments('test-org-1', 'spanish', 5);

    // Comments should have different IDs (UUID-based)
    expect(comments1[0].id).not.toBe(comments2[0].id);

    // But same source text (cloned from fixtures)
    expect(comments1[0].text).toBe(comments2[0].text);

    // Mutating one shouldn't affect the other
    comments1[0].text = 'MUTATED';
    expect(comments2[0].text).not.toBe('MUTATED');
  });

  test('should return cloned scenarios from createTestScenario', () => {
    const scenario1 = createTestScenario('test1');
    const scenario2 = createTestScenario('test2');

    // Should be different objects
    expect(scenario1).not.toBe(scenario2);

    // Mutating one shouldn't affect the other
    scenario1.organizations[0].name = 'MUTATED';
    expect(scenario2.organizations[0].name).not.toContain('MUTATED');
  });
});
