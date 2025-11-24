/**
 * Unit Tests for Toggle Zod Schemas
 * 
 * Issue #944: Migrar endpoints de Toggle (Roasting/Shield) a Zod
 * 
 * Tests strict type validation for critical state-changing endpoints:
 * - POST /api/roasting/toggle
 * - POST /api/shield/toggle
 */

const { z } = require('zod');
const {
  toggleBaseSchema,
  roastingToggleSchema,
  shieldToggleSchema
} = require('../../../../src/validators/zod/toggle.schema');

describe('Toggle Schemas - Zod Validation (Issue #944)', () => {
  
  describe('toggleBaseSchema', () => {
    
    describe('✅ Valid data', () => {
      it('should accept valid toggle data with all required fields', () => {
        const validData = {
          enabled: true,
          organization_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => toggleBaseSchema.parse(validData)).not.toThrow();
        const result = toggleBaseSchema.parse(validData);
        expect(result.enabled).toBe(true);
        expect(result.organization_id).toBe('123e4567-e89b-12d3-a456-426614174000');
      });
      
      it('should accept false as enabled value', () => {
        const validData = {
          enabled: false,
          organization_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => toggleBaseSchema.parse(validData)).not.toThrow();
        const result = toggleBaseSchema.parse(validData);
        expect(result.enabled).toBe(false);
      });
    });
    
    describe('❌ Invalid enabled field', () => {
      it('should reject string "true" instead of boolean', () => {
        const invalidData = {
          enabled: 'true', // String instead of boolean
          organization_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => toggleBaseSchema.parse(invalidData)).toThrow(z.ZodError);
        
        try {
          toggleBaseSchema.parse(invalidData);
        } catch (error) {
          expect(error.errors[0].path).toEqual(['enabled']);
          expect(error.errors[0].message).toContain('boolean');
        }
      });
      
      it('should reject string "false" instead of boolean', () => {
        const invalidData = {
          enabled: 'false',
          organization_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => toggleBaseSchema.parse(invalidData)).toThrow(z.ZodError);
      });
      
      it('should reject number 1 instead of boolean', () => {
        const invalidData = {
          enabled: 1, // Number instead of boolean
          organization_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => toggleBaseSchema.parse(invalidData)).toThrow(z.ZodError);
      });
      
      it('should reject missing enabled field', () => {
        const invalidData = {
          organization_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => toggleBaseSchema.parse(invalidData)).toThrow(z.ZodError);
        
        try {
          toggleBaseSchema.parse(invalidData);
        } catch (error) {
          expect(error.errors[0].message).toContain('required');
        }
      });
    });
    
    describe('❌ Invalid organization_id field', () => {
      it('should reject invalid UUID format', () => {
        const invalidData = {
          enabled: true,
          organization_id: 'not-a-uuid'
        };
        
        expect(() => toggleBaseSchema.parse(invalidData)).toThrow(z.ZodError);
        
        try {
          toggleBaseSchema.parse(invalidData);
        } catch (error) {
          expect(error.errors[0].path).toEqual(['organization_id']);
          expect(error.errors[0].message).toContain('UUID');
        }
      });
      
      it('should reject empty string as organization_id', () => {
        const invalidData = {
          enabled: true,
          organization_id: ''
        };
        
        expect(() => toggleBaseSchema.parse(invalidData)).toThrow(z.ZodError);
      });
      
      it('should reject missing organization_id', () => {
        const invalidData = {
          enabled: true
        };
        
        expect(() => toggleBaseSchema.parse(invalidData)).toThrow(z.ZodError);
        
        try {
          toggleBaseSchema.parse(invalidData);
        } catch (error) {
          expect(error.errors[0].message).toContain('required');
        }
      });
      
      it('should reject numeric organization_id', () => {
        const invalidData = {
          enabled: true,
          organization_id: 12345
        };
        
        expect(() => toggleBaseSchema.parse(invalidData)).toThrow(z.ZodError);
      });
    });
  });
  
  describe('roastingToggleSchema', () => {
    
    describe('✅ Valid data', () => {
      it('should accept valid roasting toggle data without reason', () => {
        const validData = {
          enabled: true,
          organization_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => roastingToggleSchema.parse(validData)).not.toThrow();
      });
      
      it('should accept valid roasting toggle data with reason', () => {
        const validData = {
          enabled: false,
          organization_id: '123e4567-e89b-12d3-a456-426614174000',
          reason: 'Temporary pause for maintenance'
        };
        
        expect(() => roastingToggleSchema.parse(validData)).not.toThrow();
        const result = roastingToggleSchema.parse(validData);
        expect(result.reason).toBe('Temporary pause for maintenance');
      });
      
      it('should accept reason up to 500 characters', () => {
        const validData = {
          enabled: false,
          organization_id: '123e4567-e89b-12d3-a456-426614174000',
          reason: 'A'.repeat(500) // Exactly 500 characters
        };
        
        expect(() => roastingToggleSchema.parse(validData)).not.toThrow();
      });
    });
    
    describe('❌ Invalid reason field', () => {
      it('should reject empty string as reason', () => {
        const invalidData = {
          enabled: false,
          organization_id: '123e4567-e89b-12d3-a456-426614174000',
          reason: '' // Empty string
        };
        
        expect(() => roastingToggleSchema.parse(invalidData)).toThrow(z.ZodError);
        
        try {
          roastingToggleSchema.parse(invalidData);
        } catch (error) {
          expect(error.errors[0].path).toEqual(['reason']);
          expect(error.errors[0].message).toContain('empty');
        }
      });
      
      it('should reject reason exceeding 500 characters', () => {
        const invalidData = {
          enabled: false,
          organization_id: '123e4567-e89b-12d3-a456-426614174000',
          reason: 'A'.repeat(501) // 501 characters
        };
        
        expect(() => roastingToggleSchema.parse(invalidData)).toThrow(z.ZodError);
        
        try {
          roastingToggleSchema.parse(invalidData);
        } catch (error) {
          expect(error.errors[0].path).toEqual(['reason']);
          expect(error.errors[0].message).toContain('500');
        }
      });
      
      it('should reject numeric reason', () => {
        const invalidData = {
          enabled: false,
          organization_id: '123e4567-e89b-12d3-a456-426614174000',
          reason: 12345
        };
        
        expect(() => roastingToggleSchema.parse(invalidData)).toThrow(z.ZodError);
      });
    });
    
    describe('🔄 Edge cases', () => {
      it('should accept enabled=true with reason (unusual but valid)', () => {
        const validData = {
          enabled: true,
          organization_id: '123e4567-e89b-12d3-a456-426614174000',
          reason: 'Re-enabling after maintenance'
        };
        
        expect(() => roastingToggleSchema.parse(validData)).not.toThrow();
      });
    });
  });
  
  describe('shieldToggleSchema', () => {
    
    describe('✅ Valid data', () => {
      it('should accept valid shield toggle data without reason', () => {
        const validData = {
          enabled: true,
          organization_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => shieldToggleSchema.parse(validData)).not.toThrow();
      });
      
      it('should accept valid shield toggle data with reason', () => {
        const validData = {
          enabled: false,
          organization_id: '123e4567-e89b-12d3-a456-426614174000',
          reason: 'Testing manual moderation workflow'
        };
        
        expect(() => shieldToggleSchema.parse(validData)).not.toThrow();
        const result = shieldToggleSchema.parse(validData);
        expect(result.reason).toBe('Testing manual moderation workflow');
      });
    });
    
    describe('❌ Invalid data', () => {
      it('should reject invalid shield toggle data (same validation as roasting)', () => {
        const invalidData = {
          enabled: 'true', // String instead of boolean
          organization_id: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => shieldToggleSchema.parse(invalidData)).toThrow(z.ZodError);
      });
    });
  });
  
  describe('🔐 Security: Type coercion prevention (P0 critical)', () => {
    
    it('should NOT coerce "1" to true', () => {
      const data = {
        enabled: '1',
        organization_id: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => toggleBaseSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should NOT coerce "0" to false', () => {
      const data = {
        enabled: '0',
        organization_id: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => toggleBaseSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should NOT coerce null to false', () => {
      const data = {
        enabled: null,
        organization_id: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => toggleBaseSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should NOT coerce undefined to false', () => {
      const data = {
        enabled: undefined,
        organization_id: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => toggleBaseSchema.parse(data)).toThrow(z.ZodError);
    });
  });
  
  describe('🧪 Real-world scenarios', () => {
    
    it('should handle form data with string booleans (should reject)', () => {
      // Common mistake: frontend sends string "true"/"false" from form
      const formData = {
        enabled: 'true',
        organization_id: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => toggleBaseSchema.parse(formData)).toThrow(z.ZodError);
    });
    
    it('should handle JSON with actual booleans (should accept)', () => {
      const jsonData = {
        enabled: true,
        organization_id: '123e4567-e89b-12d3-a456-426614174000'
      };
      
      expect(() => toggleBaseSchema.parse(jsonData)).not.toThrow();
    });
    
    it('should reject corrupted UUID with extra characters', () => {
      const data = {
        enabled: true,
        organization_id: '123e4567-e89b-12d3-a456-426614174000-extra'
      };
      
      expect(() => toggleBaseSchema.parse(data)).toThrow(z.ZodError);
    });
    
    it('should accept UUID with valid format regardless of version', () => {
      const data = {
        enabled: true,
        organization_id: '123e4567-e89b-12d3-a456-426614174000' // Version 1 (valid RFC 4122)
      };
      
      // Note: Zod's uuid() validates RFC 4122 format but doesn't enforce specific versions
      // We care about format validation (8-4-4-4-12 hex pattern), not version number
      expect(() => toggleBaseSchema.parse(data)).not.toThrow();
    });
  });
});

