/**
 * Unit Tests: ToneConfigService
 * Issue #876: Dynamic Roast Tone Configuration System
 */

const {
  ToneConfigService,
  getToneConfigService
} = require('../../../src/services/toneConfigService');

// Mock Supabase
const mockSupabase = {
  from: jest.fn((tableName) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() =>
          Promise.resolve({
            data: mockToneData[0],
            error: null
          })
        ),
        order: jest.fn(() =>
          Promise.resolve({
            data: mockToneData.filter((t) => t.active),
            error: null
          })
        )
      })),
      order: jest.fn(() =>
        Promise.resolve({
          data: mockToneData,
          error: null
        })
      )
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() =>
          Promise.resolve({
            data: mockToneData[0],
            error: null
          })
        )
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: mockToneData[0],
              error: null
            })
          )
        }))
      }))
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() =>
        Promise.resolve({
          data: null,
          error: null
        })
      )
    }))
  }))
};

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock tone data
const mockToneData = [
  {
    id: 'tone-1',
    name: 'flanders',
    display_name: { es: 'Flanders', en: 'Light' },
    description: { es: 'Tono amable', en: 'Gentle wit' },
    intensity: 2,
    personality: 'Educado, irónico',
    resources: ['Ironía marcada', 'Double entendre'],
    restrictions: ['NO insultos directos', 'NO vulgaridad'],
    examples: [
      {
        es: { input: 'Test', output: 'Respuesta' },
        en: { input: 'Test', output: 'Response' }
      }
    ],
    active: true,
    is_default: true,
    sort_order: 1,
    created_at: '2025-11-18T00:00:00Z',
    updated_at: '2025-11-18T00:00:00Z'
  },
  {
    id: 'tone-2',
    name: 'balanceado',
    display_name: { es: 'Balanceado', en: 'Balanced' },
    description: { es: 'Equilibrio perfecto', en: 'Perfect balance' },
    intensity: 3,
    personality: 'Directo, inteligente',
    resources: ['Sarcasmo directo', 'Ironía evidente'],
    restrictions: ['NO insultos personales graves', 'NO discriminación'],
    examples: [
      {
        es: { input: 'Test', output: 'Respuesta' },
        en: { input: 'Test', output: 'Response' }
      }
    ],
    active: true,
    is_default: false,
    sort_order: 2,
    created_at: '2025-11-18T00:00:00Z',
    updated_at: '2025-11-18T00:00:00Z'
  },
  {
    id: 'tone-3',
    name: 'canalla',
    display_name: { es: 'Canalla', en: 'Savage' },
    description: { es: 'Directo y sin filtros', en: 'Direct and unfiltered' },
    intensity: 4,
    personality: 'Directo, sin filtros',
    resources: ['Sarcasmo crudo', 'Ironía brutal'],
    restrictions: ['NO discriminación', 'NO amenazas reales'],
    examples: [
      {
        es: { input: 'Test', output: 'Respuesta' },
        en: { input: 'Test', output: 'Response' }
      }
    ],
    active: false,
    is_default: false,
    sort_order: 3,
    created_at: '2025-11-18T00:00:00Z',
    updated_at: '2025-11-18T00:00:00Z'
  }
];

describe('ToneConfigService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ToneConfigService();
  });

  describe('getActiveTones', () => {
    it('should return active tones localized to ES', async () => {
      const tones = await service.getActiveTones('es');

      expect(tones).toHaveLength(2);
      expect(tones[0].display_name).toBe('Flanders');
      expect(tones[0].description).toBe('Tono amable');
      expect(tones[0].examples[0].input).toBe('Test');
    });

    it('should return active tones localized to EN', async () => {
      const tones = await service.getActiveTones('en');

      expect(tones).toHaveLength(2);
      expect(tones[0].display_name).toBe('Light');
      expect(tones[0].description).toBe('Gentle wit');
    });

    it('should cache tones for 5 minutes', async () => {
      // First call - fetches from DB
      await service.getActiveTones('es');
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call - uses cache
      await service.getActiveTones('es');
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // No additional call

      // Check cache is set
      expect(service.cache).toBeDefined();
      expect(service.cacheExpiry).toBeGreaterThan(Date.now());
    });

    it('should throw error if no active tones found', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() =>
              Promise.resolve({
                data: [],
                error: null
              })
            )
          }))
        }))
      });

      await expect(service.getActiveTones('es')).rejects.toThrow('No active tones available');
    });

    it('should throw error on database error', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: 'Database error' }
              })
            )
          }))
        }))
      });

      await expect(service.getActiveTones('es')).rejects.toThrow('Failed to fetch active tones');
    });
  });

  describe('getAllTones', () => {
    it('should return all tones (active + inactive)', async () => {
      const tones = await service.getAllTones();

      expect(tones).toHaveLength(3);
      expect(tones[2].active).toBe(false);
      expect(mockSupabase.from).toHaveBeenCalledWith('roast_tones');
    });
  });

  describe('getToneById', () => {
    it('should return tone by ID', async () => {
      const tone = await service.getToneById('tone-1');

      expect(tone.id).toBe('tone-1');
      expect(tone.name).toBe('flanders');
    });

    it('should throw error if tone not found', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { code: 'PGRST116' }
              })
            )
          }))
        }))
      });

      await expect(service.getToneById('invalid-id')).rejects.toThrow('not found');
    });
  });

  describe('createTone', () => {
    const newTone = {
      name: 'nuevo_tono',
      display_name: { es: 'Nuevo', en: 'New' },
      description: { es: 'Descripción', en: 'Description' },
      intensity: 3,
      personality: 'Test personality',
      resources: ['Resource 1'],
      restrictions: ['Restriction 1'],
      examples: [{ es: { input: 'A', output: 'B' }, en: { input: 'A', output: 'B' } }]
    };

    it('should create new tone', async () => {
      const created = await service.createTone(newTone);

      expect(created).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('roast_tones');
      expect(service.cache).toBeNull(); // Cache invalidated
    });

    it('should throw error if name already exists', async () => {
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { code: '23505' }
              })
            )
          }))
        }))
      });

      await expect(service.createTone(newTone)).rejects.toThrow('already exists');
    });

    it('should validate required fields', async () => {
      const invalidTone = { name: 'test' };

      await expect(service.createTone(invalidTone)).rejects.toThrow('Validation failed');
    });

    it('should validate intensity range (1-5)', async () => {
      const invalidTone = { ...newTone, intensity: 6 };

      await expect(service.createTone(invalidTone)).rejects.toThrow(
        'intensity must be between 1 and 5'
      );
    });

    it('should validate name format (lowercase, numbers, hyphens)', async () => {
      const invalidTone = { ...newTone, name: 'Invalid Name!' };

      await expect(service.createTone(invalidTone)).rejects.toThrow(
        'name must contain only lowercase'
      );
    });
  });

  describe('updateTone', () => {
    it('should update tone', async () => {
      const updates = { intensity: 4 };
      const updated = await service.updateTone('tone-1', updates);

      expect(updated).toBeDefined();
      expect(service.cache).toBeNull(); // Cache invalidated
    });

    it('should throw error if tone not found', async () => {
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116' }
                })
              )
            }))
          }))
        }))
      });

      await expect(service.updateTone('invalid-id', {})).rejects.toThrow('not found');
    });
  });

  describe('deleteTone', () => {
    it('should delete inactive tone', async () => {
      // Mock getToneById to return inactive tone
      jest.spyOn(service, 'getToneById').mockResolvedValue(mockToneData[2]);

      await service.deleteTone('tone-3');

      expect(mockSupabase.from).toHaveBeenCalledWith('roast_tones');
      expect(service.cache).toBeNull(); // Cache invalidated
    });

    it('should prevent deleting last active tone', async () => {
      // Mock getToneById to return active tone
      jest.spyOn(service, 'getToneById').mockResolvedValue(mockToneData[0]);

      // Mock only 1 active tone
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({
              data: [{ id: 'tone-1' }],
              error: null
            })
          )
        }))
      });

      await expect(service.deleteTone('tone-1')).rejects.toThrow('last active tone');
    });
  });

  describe('activateTone', () => {
    it('should activate tone', async () => {
      const activated = await service.activateTone('tone-3');

      expect(activated).toBeDefined();
    });
  });

  describe('deactivateTone', () => {
    it('should deactivate tone if not last active', async () => {
      // Mock 2 active tones
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({
              data: [{ id: 'tone-1' }, { id: 'tone-2' }],
              error: null
            })
          )
        }))
      });

      const deactivated = await service.deactivateTone('tone-2');

      expect(deactivated).toBeDefined();
    });

    it('should prevent deactivating last active tone', async () => {
      // Mock only 1 active tone
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() =>
            Promise.resolve({
              data: [{ id: 'tone-1' }],
              error: null
            })
          )
        }))
      });

      await expect(service.deactivateTone('tone-1')).rejects.toThrow('last active tone');
    });
  });

  describe('reorderTones', () => {
    it('should reorder tones', async () => {
      const orderArray = [
        { id: 'tone-2', sort_order: 1 },
        { id: 'tone-1', sort_order: 2 }
      ];

      const reordered = await service.reorderTones(orderArray);

      expect(reordered).toHaveLength(2);
      expect(service.cache).toBeNull(); // Cache invalidated
    });
  });

  describe('invalidateCache', () => {
    it('should clear cache', async () => {
      // Set cache
      await service.getActiveTones('es');
      expect(service.cache).toBeDefined();

      // Invalidate
      service.invalidateCache();

      expect(service.cache).toBeNull();
      expect(service.cacheExpiry).toBeNull();
    });
  });

  describe('localizeTone', () => {
    it('should localize tone to ES', () => {
      const localized = service.localizeTone(mockToneData[0], 'es');

      expect(localized.display_name).toBe('Flanders');
      expect(localized.description).toBe('Tono amable');
      expect(localized.examples[0].input).toBe('Test');
    });

    it('should localize tone to EN', () => {
      const localized = service.localizeTone(mockToneData[0], 'en');

      expect(localized.display_name).toBe('Light');
      expect(localized.description).toBe('Gentle wit');
    });

    it('should fallback to ES if language not available', () => {
      const localized = service.localizeTone(mockToneData[0], 'fr');

      expect(localized.display_name).toBe('Flanders');
      expect(localized.description).toBe('Tono amable');
    });
  });

  describe('singleton getToneConfigService', () => {
    it('should return same instance', () => {
      const instance1 = getToneConfigService();
      const instance2 = getToneConfigService();

      expect(instance1).toBe(instance2);
    });
  });
});
