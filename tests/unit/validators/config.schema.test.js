/**
 * Unit Tests for Zod Config Schemas
 * Issue #943: Migrar endpoints de config a Zod
 *
 * Tests roastLevelSchema, shieldLevelSchema, platformConfigSchema
 */

const {
  roastLevelSchema,
  shieldLevelSchema,
  platformConfigSchema,
  roastLevelUpdateSchema,
  shieldLevelUpdateSchema
} = require('../../../src/validators/zod/config.schema');

describe('Zod Config Schemas - Issue #943', () => {
  describe('roastLevelSchema', () => {
    it('should accept valid roast level 1', () => {
      const result = roastLevelSchema.safeParse(1);
      expect(result.success).toBe(true);
      expect(result.data).toBe(1);
    });

    it('should accept valid roast level 3', () => {
      const result = roastLevelSchema.safeParse(3);
      expect(result.success).toBe(true);
      expect(result.data).toBe(3);
    });

    it('should accept valid roast level 5', () => {
      const result = roastLevelSchema.safeParse(5);
      expect(result.success).toBe(true);
      expect(result.data).toBe(5);
    });

    it('should reject roast level < 1', () => {
      const result = roastLevelSchema.safeParse(0);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be between 1 and 5');
    });

    it('should reject roast level > 5', () => {
      const result = roastLevelSchema.safeParse(6);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be between 1 and 5');
    });

    it('should reject negative roast level', () => {
      const result = roastLevelSchema.safeParse(-1);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be between 1 and 5');
    });

    it('should reject non-integer roast level', () => {
      const result = roastLevelSchema.safeParse(3.5);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be an integer');
    });

    it('should reject string roast level', () => {
      const result = roastLevelSchema.safeParse('3');
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be a number');
    });

    it('should reject null roast level', () => {
      const result = roastLevelSchema.safeParse(null);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be a number');
    });

    it('should reject undefined roast level', () => {
      const result = roastLevelSchema.safeParse(undefined);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('required');
    });
  });

  describe('shieldLevelSchema', () => {
    it('should accept valid shield level 1', () => {
      const result = shieldLevelSchema.safeParse(1);
      expect(result.success).toBe(true);
      expect(result.data).toBe(1);
    });

    it('should accept valid shield level 3', () => {
      const result = shieldLevelSchema.safeParse(3);
      expect(result.success).toBe(true);
      expect(result.data).toBe(3);
    });

    it('should accept valid shield level 5', () => {
      const result = shieldLevelSchema.safeParse(5);
      expect(result.success).toBe(true);
      expect(result.data).toBe(5);
    });

    it('should reject shield level < 1', () => {
      const result = shieldLevelSchema.safeParse(0);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be between 1 and 5');
    });

    it('should reject shield level > 5', () => {
      const result = shieldLevelSchema.safeParse(6);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be between 1 and 5');
    });

    it('should reject negative shield level', () => {
      const result = shieldLevelSchema.safeParse(-1);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be between 1 and 5');
    });

    it('should reject non-integer shield level', () => {
      const result = shieldLevelSchema.safeParse(2.7);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be an integer');
    });

    it('should reject string shield level', () => {
      const result = shieldLevelSchema.safeParse('2');
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be a number');
    });

    it('should reject null shield level', () => {
      const result = shieldLevelSchema.safeParse(null);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('must be a number');
    });

    it('should reject undefined shield level', () => {
      const result = shieldLevelSchema.safeParse(undefined);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toContain('required');
    });
  });

  describe('platformConfigSchema', () => {
    it('should accept valid config with roast_level', () => {
      const config = {
        roast_level: 3
      };
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data.roast_level).toBe(3);
    });

    it('should accept valid config with shield_level', () => {
      const config = {
        shield_level: 4
      };
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data.shield_level).toBe(4);
    });

    it('should accept valid config with both levels', () => {
      const config = {
        roast_level: 2,
        shield_level: 3
      };
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data.roast_level).toBe(2);
      expect(result.data.shield_level).toBe(3);
    });

    it('should accept valid config with all fields', () => {
      const config = {
        enabled: true,
        tone: 'balanceado',
        response_frequency: 0.8,
        trigger_words: ['roast', 'burn'],
        shield_enabled: true,
        shield_config: {
          auto_actions: true,
          mute_enabled: true,
          block_enabled: false,
          report_enabled: true
        },
        config: { custom_key: 'value' },
        roast_level: 3,
        shield_level: 4
      };
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid roast_level in config', () => {
      const config = {
        roast_level: 6
      };
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid shield_level in config', () => {
      const config = {
        shield_level: 0
      };
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid tone', () => {
      const config = {
        tone: 'invalid_tone'
      };
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject unknown properties (strict mode)', () => {
      const config = {
        roast_level: 3,
        unknown_field: 'should fail'
      };
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      expect(result.error.errors[0].code).toBe('unrecognized_keys');
    });

    it('should accept empty config object', () => {
      const config = {};
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with only optional fields', () => {
      const config = {
        enabled: false
      };
      const result = platformConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('roastLevelUpdateSchema', () => {
    it('should accept valid roast level update', () => {
      const update = {
        roast_level: 4
      };
      const result = roastLevelUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
      expect(result.data.roast_level).toBe(4);
    });

    it('should accept roast level update with organization_id', () => {
      const update = {
        roast_level: 3,
        organization_id: '550e8400-e29b-41d4-a716-446655440000'
      };
      const result = roastLevelUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should reject missing roast_level', () => {
      const update = {};
      const result = roastLevelUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should reject invalid organization_id format', () => {
      const update = {
        roast_level: 3,
        organization_id: 'not-a-uuid'
      };
      const result = roastLevelUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });
  });

  describe('shieldLevelUpdateSchema', () => {
    it('should accept valid shield level update', () => {
      const update = {
        shield_level: 2
      };
      const result = shieldLevelUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
      expect(result.data.shield_level).toBe(2);
    });

    it('should accept shield level update with organization_id', () => {
      const update = {
        shield_level: 5,
        organization_id: '550e8400-e29b-41d4-a716-446655440000'
      };
      const result = shieldLevelUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should reject missing shield_level', () => {
      const update = {};
      const result = shieldLevelUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should reject invalid organization_id format', () => {
      const update = {
        shield_level: 4,
        organization_id: 'invalid-uuid'
      };
      const result = shieldLevelUpdateSchema.safeParse(update);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle boundary values correctly', () => {
      expect(roastLevelSchema.safeParse(1).success).toBe(true);
      expect(roastLevelSchema.safeParse(5).success).toBe(true);
      expect(shieldLevelSchema.safeParse(1).success).toBe(true);
      expect(shieldLevelSchema.safeParse(5).success).toBe(true);
    });

    it('should reject boundary violations', () => {
      expect(roastLevelSchema.safeParse(0).success).toBe(false);
      expect(roastLevelSchema.safeParse(6).success).toBe(false);
      expect(shieldLevelSchema.safeParse(0).success).toBe(false);
      expect(shieldLevelSchema.safeParse(6).success).toBe(false);
    });

    it('should handle type coercion correctly', () => {
      // Zod does NOT coerce by default
      expect(roastLevelSchema.safeParse('3').success).toBe(false);
      expect(shieldLevelSchema.safeParse('4').success).toBe(false);
    });
  });
});
