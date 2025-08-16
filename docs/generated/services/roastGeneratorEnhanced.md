# roastGeneratorEnhanced.test.js

**Path:** `tests/unit/services/roastGeneratorEnhanced.test.js`

## roast Generator Enhanced Tests

### RoastGeneratorEnhanced

#### Plan-based Roast Generation

Tests:
- ✓ should use basic moderation for Free plan
- ✓ should use basic moderation for Pro plan
- ✓ should use basic moderation for Creator+ plan when RQC globally disabled
- ✓ should approve roast with 3 green reviewers
- ✓ should approve roast with 2 green reviewers (no moderator fail)
- ✓ should regenerate when moderator fails
- ✓ should use fallback after max regeneration attempts

#### Cost Control and Optimization

Tests:
- ✓ should not make extra GPT calls for Free plan
- ✓ should not make extra GPT calls for Pro plan

#### Fallback and Error Handling

Tests:
- ✓ should fallback to safe roast on OpenAI error
- ✓ should handle database errors gracefully

#### Basic Moderation Prompts

Tests:
- ✓ should include intensity level in basic moderation prompt
- ✓ should customize prompt based on tone

