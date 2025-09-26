/**
 * Test setup validation - CodeRabbit fixes for PR #426
 */

const { TestData } = require('../../helpers/test-setup');

describe('Test Setup - UUID Generation (CodeRabbit Fix)', () => {
  
  test('should generate unique IDs for organizations', () => {
    const org1 = TestData.organization();
    const org2 = TestData.organization();
    
    // IDs should be different (UUID-based)
    expect(org1.id).not.toBe(org2.id);
    expect(org1.id).toMatch(/^test-org-[a-f0-9-]{36}$/);
    expect(org2.id).toMatch(/^test-org-[a-f0-9-]{36}$/);
  });
  
  test('should generate unique IDs for users', () => {
    const user1 = TestData.user('test-org-123');
    const user2 = TestData.user('test-org-123');
    
    // IDs should be different (UUID-based)
    expect(user1.id).not.toBe(user2.id);
    expect(user1.email).not.toBe(user2.email);
    expect(user1.id).toMatch(/^test-user-[a-f0-9-]{36}$/);
    expect(user2.id).toMatch(/^test-user-[a-f0-9-]{36}$/);
  });
  
  test('should generate unique IDs for comments', () => {
    const comment1 = TestData.comment('test-org-123');
    const comment2 = TestData.comment('test-org-123');
    
    // IDs should be different (UUID-based)
    expect(comment1.id).not.toBe(comment2.id);
    expect(comment1.external_id).not.toBe(comment2.external_id);
    expect(comment1.id).toMatch(/^test-comment-[a-f0-9-]{36}$/);
    expect(comment2.id).toMatch(/^test-comment-[a-f0-9-]{36}$/);
  });
  
  test('should generate unique IDs for roasts', () => {
    const roast1 = TestData.roast('comment-1', 'org-1');
    const roast2 = TestData.roast('comment-2', 'org-2');
    
    // IDs should be different (UUID-based)
    expect(roast1.id).not.toBe(roast2.id);
    expect(roast1.id).toMatch(/^test-roast-[a-f0-9-]{36}$/);
    expect(roast2.id).toMatch(/^test-roast-[a-f0-9-]{36}$/);
  });
  
});