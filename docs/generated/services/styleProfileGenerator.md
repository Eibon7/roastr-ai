# styleProfileGenerator.test.js

**Path:** `tests/unit/services/styleProfileGenerator.test.js`

## style Profile Generator Tests

### StyleProfileGenerator

#### initialization

Tests:

- ✓ should initialize without errors
- ✓ should handle multiple initialization calls

#### detectLanguages

Tests:

- ✓ should detect single dominant language
- ✓ should detect multiple languages with sufficient threshold
- ✓ should filter out languages below minimum threshold
- ✓ should handle empty content
- ✓ should return most common language when none meet criteria

#### analyzeLanguageContent

Tests:

- ✓ should analyze Spanish content correctly
- ✓ should return null for non-existent language
- ✓ should detect tone indicators
- ✓ should count common words

#### generateLanguageProfile

Tests:

- ✓ should generate Spanish profile correctly
- ✓ should generate English profile correctly
- ✓ should handle Portuguese profile
- ✓ should fallback to English for unknown language
- ✓ should determine style types based on length

#### generateStyleProfile

Tests:

- ✓ should generate complete style profile
- ✓ should respect maxItemsPerPlatform option
- ✓ should throw error for empty content
- ✓ should throw error for insufficient content
- ✓ should handle multiple languages correctly

#### getProfileStats

Tests:

- ✓ should generate correct statistics
- ✓ should handle empty profiles
- ✓ should handle single profile

#### edge cases and error handling

Tests:

- ✓ should handle content with missing fields
- ✓ should handle very long text content
- ✓ should handle special characters and emojis
- ✓ should handle null or undefined platform data
