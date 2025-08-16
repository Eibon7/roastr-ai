# rqcService.test.js

**Path:** `tests/unit/services/rqcService.test.js`

## rqc Service Tests

### RQCService

#### Main Review Process

Tests:
- ✓ should run all 3 reviewers in parallel
- ✓ should provide detailed review metrics

#### Moderator Reviewer

Tests:
- ✓ should pass compliant roast
- ✓ should fail roast with moderation issues
- ✓ should include intensity level in prompt
- ✓ should handle moderator API errors gracefully

#### Comedian Reviewer

Tests:
- ✓ should pass funny and punchy roast
- ✓ should fail generic or unfunny roast
- ✓ should adjust expectations based on intensity level

#### Style Reviewer

Tests:
- ✓ should pass roast that matches default style
- ✓ should use custom style prompt when configured
- ✓ should fail roast that doesn\

#### RQC Decision Logic

Tests:
- ✓ should approve with 3 passes
- ✓ should approve with 2 passes (moderator pass)
- ✓ should regenerate when moderator fails (non-negotiable)
- ✓ should regenerate with less than 2 passes
- ✓ should handle mixed fail scenarios

#### Performance and Optimization

Tests:
- ✓ should estimate tokens accurately
- ✓ should run reviewers in parallel (performance check)

#### Error Handling

Tests:
- ✓ should handle partial reviewer failures
- ✓ should handle complete review failure

#### Configuration Integration

Tests:
- ✓ should handle different intensity levels appropriately
- ✓ should use low temperature for consistent moderation

