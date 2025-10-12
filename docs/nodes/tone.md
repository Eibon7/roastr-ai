# Tone - Tone Mapping & Humor Type Configuration

**Node ID:** `tone`
**Owner:** Back-end Dev
**Priority:** High
**Status:** Production
**Last Updated:** 2025-10-09
**Coverage:** 70%
**Coverage Source:** mocked
**Related PRs:** #499

## Dependencies

- `persona` - User personality configuration and style preferences
- `plan-features` - Subscription plan feature gates and limits

## Overview

The Tone system maps user preferences to AI roast styles through three pre-defined tones (Flanders, Balanceado, Canalla) and humor type configurations. It provides centralized tone definitions, normalization, and validation for consistent roast generation across the platform.

### Key Capabilities

1. **Three Core Tones** - Flanders (gentle), Balanceado (balanced), Canalla (savage)
2. **Humor Types** - Witty, clever, playful variations
3. **Intensity Levels** - 1-5 scale for roast aggressiveness
4. **Tone Normalization** - Case-insensitive, O(1) performance mapping
5. **Plan-Based Access** - Custom styles for Plus plans only

## Architecture

### Tone Definitions

**File:** `src/config/tones.js`

```javascript
const TONE_DEFINITIONS = Object.freeze({
  FLANDERS: {
    id: 'Flanders',
    name: 'Flanders',
    description: 'Suave y amigable',
    example: '"¡Vaya, qué comentario tan... creativo! 😄"'
  },
  BALANCEADO: {
    id: 'Balanceado',
    name: 'Balanceado',
    description: 'Equilibrado y constructivo',
    example: '"Interesante perspectiva, aunque creo que se podría mejorar un poco."'
  },
  CANALLA: {
    id: 'Canalla',
    name: 'Canalla',
    description: 'Directo y agresivo',
    example: '"¿En serio? Ese comentario necesita una ambulancia..."'
  }
});
```

### Humor Types

**Valid Values:** `['witty', 'clever', 'playful']`

| Type | Description | Example |
|------|-------------|---------|
| **witty** | Quick, sharp humor | "Tu comentario tiene más bugs que Windows Vista" |
| **clever** | Intelligent wordplay | "Argumentación tan sólida como JavaScript sin tipos" |
| **playful** | Light, fun teasing | "¿Tu teclado tiene autocorrecto o solo mal gusto?" |

### Intensity Levels

**Range:** 1-5 (integer)

| Level | Description | Tone Mapping |
|-------|-------------|--------------|
| 1 | Very gentle | Always Flanders |
| 2 | Mild | Flanders or light Balanceado |
| 3 | Moderate | Balanceado |
| 4 | Strong | Heavy Balanceado or light Canalla |
| 5 | Maximum | Always Canalla |

### Tone Normalization

**Function:** `normalizeTone(tone)` - O(1) performance
**Input:** Any case, whitespace allowed
**Output:** Canonical tone ID or null

```javascript
// Canonical map (lowercase → canonical)
const TONE_MAP_CANONICAL = {
  'flanders': 'Flanders',
  'balanceado': 'Balanceado',
  'canalla': 'Canalla'
};

function normalizeTone(tone) {
  if (!tone || typeof tone !== 'string') return null;
  const normalized = tone.trim().toLowerCase();
  return TONE_MAP_CANONICAL[normalized] || null;
}

// Examples:
normalizeTone('FLANDERS')    // → 'Flanders'
normalizeTone('  Canalla  ') // → 'Canalla'
normalizeTone('invalid')     // → null
```

## Integration with Roast Generation

**Path:** `RoastPromptTemplate.mapUserTone()`

```javascript
mapUserTone(userConfig) {
  const tone = userConfig.tone || 'Balanceado';
  const humorType = userConfig.humor_type || 'witty';
  const intensityLevel = userConfig.intensity_level || 3;
  const customPrompt = userConfig.custom_style_prompt;  // Plus plan only

  let toneDescription = this.getToneDescription(tone, intensityLevel);

  // Add humor type modifier
  toneDescription += `, estilo ${humorType}`;

  // Add custom style (Plus plan)
  if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && customPrompt) {
    toneDescription += `. Estilo personalizado: ${customPrompt}`;
  }

  return toneDescription;
}

// Example output:
// "Canalla, directo y sin filtros, estilo witty. Estilo personalizado: Fan de los 90s, referencias retro"
```

### Tone Mapping by Plan

| Plan | Available Tones | Humor Types | Intensity | Custom Style |
|------|----------------|-------------|-----------|--------------|
| **Free** | Balanceado only | witty only | Fixed at 3 | ❌ |
| **Starter** | All 3 | All 3 | 1-5 | ❌ |
| **Pro** | All 3 | All 3 | 1-5 | ❌ |
| **Plus** | All 3 | All 3 | 1-5 | ✅ |

## API Routes

**File:** `src/routes/config.js`

### GET /api/config/:platform

```javascript
// Returns platform configuration including tone settings
{
  platform: 'twitter',
  enabled: true,
  tone: 'Balanceado',
  humor_type: 'witty',
  response_frequency: 1.0,
  trigger_words: ['roast', 'burn'],
  shield_enabled: true,
  shield_config: { /* ... */ }
}
```

### PUT /api/config/:platform

```javascript
// Update tone configuration
{
  tone: 'Canalla',              // Must be valid tone
  humor_type: 'clever',         // Must be valid humor type
  response_frequency: 0.8       // 0.0-1.0
}

// Validation:
if (!VALID_TONES.includes(tone)) {
  return error('Invalid tone. Must be one of: Flanders, Balanceado, Canalla');
}
```

## Validation

**File:** `src/config/validationConstants.js`

```javascript
const VALIDATION_RULES = {
  tone: {
    type: 'string',
    required: false,
    validator: (value) => normalizeTone(value) !== null,
    errorMessage: 'Tone must be one of: Flanders, Balanceado, Canalla'
  },
  humor_type: {
    type: 'string',
    required: false,
    enum: ['witty', 'clever', 'playful'],
    errorMessage: 'Humor type must be: witty, clever, or playful'
  },
  intensity_level: {
    type: 'integer',
    required: false,
    min: 1,
    max: 5,
    errorMessage: 'Intensity level must be between 1 and 5'
  }
};
```

## Testing

### Unit Tests

```javascript
// src/config/tones.test.js
describe('Tone Normalization', () => {
  test('normalizes case-insensitive input', () => {
    expect(normalizeTone('FLANDERS')).toBe('Flanders');
    expect(normalizeTone('canalla')).toBe('Canalla');
  });

  test('handles whitespace', () => {
    expect(normalizeTone('  Balanceado  ')).toBe('Balanceado');
  });

  test('returns null for invalid tones', () => {
    expect(normalizeTone('invalid')).toBeNull();
    expect(normalizeTone('')).toBeNull();
    expect(normalizeTone(null)).toBeNull();
  });

  test('is type-safe for non-strings', () => {
    expect(normalizeTone(123)).toBeNull();
    expect(normalizeTone({})).toBeNull();
  });
});

describe('Tone Validation', () => {
  test('isValidTone accepts normalized tones', () => {
    expect(isValidTone('Flanders')).toBe(true);
    expect(isValidTone('FLANDERS')).toBe(true);
  });

  test('strict mode requires canonical form', () => {
    expect(isValidTone('Flanders', true)).toBe(true);
    expect(isValidTone('flanders', true)).toBe(false);
  });
});
```

### Integration Tests

**File:** `tests/integration/generation-issue-409.test.js` (**Issue #409**)

**Tone Enforcement Tests (AC1):**
- ✅ `should respect user tone preference in all variants` - Validates all generated variants use user's configured tone
- ✅ `should fallback to default tone when user has no preference` - Tests default tone behavior
- 🟡 `should reject invalid tone parameter` - Validates error handling for invalid tones (needs fix)

**Status:** 2/3 passing (67% coverage)

```javascript
// Tone → Roast flow
test('tone configuration affects roast style', async () => {
  const userConfig = {
    tone: 'Canalla',
    humor_type: 'witty',
    intensity_level: 5
  };

  const roast = await generateRoast(comment, userConfig);

  expect(roast).toMatch(/directo|salvaje|brutal/i);
  expect(roast.length).toBeLessThan(280); // Platform constraint
});
```

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|-----------|
| `Invalid tone` | Unrecognized tone name | Use normalizeTone() before validation |
| `Intensity out of range` | Value < 1 or > 5 | Clamp to [1, 5] or reject |
| `Custom style on wrong plan` | Free/Starter/Pro trying custom prompt | Upgrade to Plus or disable feature |

## Future Enhancements

- [ ] User-created custom tones (Plus plan)
- [ ] A/B testing of tone effectiveness
- [ ] Tone recommendation based on comment type
- [ ] Multi-language tone definitions
- [ ] Tone evolution over time (learning)


## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Documentation Agent**
- **Test Engineer**
- **Backend Developer**
- **UX Designer**


## Related Nodes

- **persona** - Provides humor_type and custom_style_prompt
- **plan-features** - Gates custom style access by plan
- **roast** - Consumes tone configuration for generation
- **platform-constraints** - Character limits affect tone verbosity

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Quarterly or on tone system changes
**Last Reviewed:** 2025-10-03
**Version:** 1.0.0
