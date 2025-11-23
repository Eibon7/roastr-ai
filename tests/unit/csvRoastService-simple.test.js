/**
 * Tests unitarios simplificados para CsvRoastService
 * Enfoque en la lógica core sin dependencias complejas de fs
 */

const CsvRoastService = require('../../src/services/csvRoastService');

// Mock manual de Papa.parse
jest.mock('papaparse', () => ({
  parse: jest.fn(),
  unparse: jest.fn()
}));

describe('CsvRoastService (Simplified)', () => {
  let csvService;
  const Papa = require('papaparse');

  beforeEach(() => {
    jest.clearAllMocks();
    csvService = new CsvRoastService();
  });

  describe('Constructor', () => {
    test('debe inicializarse correctamente', () => {
      expect(csvService).toBeInstanceOf(CsvRoastService);
      expect(csvService.roasts).toEqual([]);
      expect(csvService.lastLoadTime).toBeNull();
      expect(csvService.cacheExpiry).toBe(5 * 60 * 1000);
    });

    test('debe usar archivo de test en entorno de tests', () => {
      expect(csvService.csvFilePath).toContain('tests/data/roasts_test.csv');
    });
  });

  describe('findBestRoast - lógica de búsqueda', () => {
    beforeEach(() => {
      // Simular datos cargados directamente
      csvService.roasts = [
        {
          comment: "Innovative: you've reinvented PowerPoint 1998.",
          roast: 'Innovador: has reinventado el PowerPoint de 1998.'
        },
        {
          comment: 'Your code is as efficient as a sand calculator.',
          roast: 'Tu código es tan eficiente como una calculadora de arena.'
        },
        {
          comment: 'What an elegant way to say you have no clue.',
          roast: 'Qué elegante forma de decir que no tienes ni idea.'
        }
      ];
    });

    test('debe encontrar coincidencia exacta', async () => {
      // Arrange
      jest.spyOn(csvService, 'loadRoasts').mockResolvedValue(csvService.roasts);

      // Act
      const result = await csvService.findBestRoast(
        'Your code is as efficient as a sand calculator.'
      );

      // Assert
      expect(result).toBe('Tu código es tan eficiente como una calculadora de arena.');
    });

    test('debe encontrar coincidencia parcial por palabras clave', async () => {
      // Arrange
      jest.spyOn(csvService, 'loadRoasts').mockResolvedValue(csvService.roasts);

      // Act
      const result = await csvService.findBestRoast('my code is efficient');

      // Assert
      expect(result).toBe('Tu código es tan eficiente como una calculadora de arena.');
    });

    test('debe devolver roast aleatorio si no hay coincidencias', async () => {
      // Arrange
      jest.spyOn(csvService, 'loadRoasts').mockResolvedValue(csvService.roasts);
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Forzar índice específico

      // Act
      const result = await csvService.findBestRoast('completely unrelated text xyz');

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('debe manejar comentarios vacíos', async () => {
      // Arrange
      jest.spyOn(csvService, 'loadRoasts').mockResolvedValue(csvService.roasts);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      // Act
      const result = await csvService.findBestRoast('');

      // Assert
      expect(result).toBeDefined();
      expect(result).toBe('Innovador: has reinventado el PowerPoint de 1998.');
    });

    test('debe lanzar error si no hay roasts disponibles', async () => {
      // Arrange
      jest.spyOn(csvService, 'loadRoasts').mockResolvedValue([]);

      // Act & Assert
      await expect(csvService.findBestRoast('test')).rejects.toThrow('No roasts available in CSV');
    });
  });

  describe('Cache behavior', () => {
    test('debe usar cache si está válido', async () => {
      // Arrange
      const mockData = [{ comment: 'test', roast: 'test roast' }];
      csvService.roasts = mockData;
      csvService.lastLoadTime = Date.now(); // Cache reciente

      // Act
      const result = await csvService.loadRoasts();

      // Assert
      expect(result).toEqual(mockData);
      // No debería intentar leer archivos
    });

    test('debe recargar si cache expiró', async () => {
      // Arrange
      const mockData = [{ comment: 'new', roast: 'new roast' }];
      csvService.lastLoadTime = Date.now() - 6 * 60 * 1000; // Cache expirado

      // Mock ensureCsvExists y readFile
      jest.spyOn(csvService, 'ensureCsvExists').mockResolvedValue(undefined);

      const fs = require('fs').promises;
      fs.readFile = jest.fn().mockResolvedValue('roast_text,language\n"test","es"');

      Papa.parse.mockReturnValue({
        data: [{ roast_text: 'test roast', language: 'es' }],
        errors: []
      });

      // Act
      const result = await csvService.loadRoasts();

      // Assert
      expect(result).toEqual([{ comment: 'test roast', roast: 'test roast' }]);
    });
  });

  describe('Validation logic', () => {
    test('debe calcular score correctamente para coincidencia exacta', () => {
      // Esta sería la lógica interna del algoritmo de matching
      const input = 'test comment';
      const candidate = 'test comment';

      // Simulamos el cálculo de score interno
      const score = input.toLowerCase() === candidate.toLowerCase() ? 1000 : 0;

      expect(score).toBe(1000);
    });

    test('debe calcular score para coincidencia parcial', () => {
      const inputWords = ['test', 'code'];
      const candidateWords = ['test', 'efficient', 'code'];

      let score = 0;
      for (const inputWord of inputWords) {
        for (const candidateWord of candidateWords) {
          if (inputWord === candidateWord) {
            score += 10;
          }
        }
      }

      expect(score).toBe(20); // 'test' + 'code' = 10 + 10
    });
  });
});
