/**
 * Tests unitarios para CsvRoastService
 * Valida la búsqueda inteligente de roasts desde CSV
 */

const CsvRoastService = require('../../src/services/csvRoastService');
const Papa = require('papaparse');
const fs = require('fs').promises;
const { getMockCsvData, setMockEnvVars, cleanupMocks } = require('../helpers/testUtils');

// Mock de dependencias
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    appendFile: jest.fn()
  }
}));

jest.mock('papaparse');

describe('CsvRoastService', () => {
  let csvService;
  let mockFs;

  beforeAll(() => {
    setMockEnvVars();
  });

  beforeEach(() => {
    cleanupMocks();
    mockFs = require('fs').promises;
    csvService = new CsvRoastService();
  });

  afterEach(() => {
    cleanupMocks();
  });

  describe('Constructor', () => {
    test('debe inicializarse con configuración por defecto', () => {
      expect(csvService).toBeInstanceOf(CsvRoastService);
      expect(csvService.csvFilePath).toContain('data/roasts.csv');
      expect(csvService.roasts).toEqual([]);
      expect(csvService.cacheExpiry).toBe(5 * 60 * 1000); // 5 minutos
    });

    test('debe configurar debug mode según variable de entorno', () => {
      process.env.DEBUG = 'true';
      const debugService = new CsvRoastService();
      expect(debugService.debug).toBe(true);

      process.env.DEBUG = 'false';
      const noDebugService = new CsvRoastService();
      expect(noDebugService.debug).toBe(false);
    });
  });

  describe('ensureCsvExists', () => {
    test('debe no hacer nada si el CSV ya existe', async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined); // File exists

      // Act
      await csvService.ensureCsvExists();

      // Assert
      expect(mockFs.access).toHaveBeenCalledWith(csvService.csvFilePath);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    test('debe crear CSV con datos de muestra si no existe', async () => {
      // Arrange
      mockFs.access.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const mockCsvContent = 'comment,roast\n"test","test roast"';
      Papa.unparse.mockReturnValue(mockCsvContent);

      // Act
      await csvService.ensureCsvExists();

      // Assert
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(csvService.csvFilePath, mockCsvContent, 'utf8');
    });
  });

  describe('loadRoasts', () => {
    test('debe usar cache si está válido', async () => {
      // Arrange
      const mockData = getMockCsvData();
      csvService.roasts = mockData;
      csvService.lastLoadTime = Date.now();

      // Act
      const result = await csvService.loadRoasts();

      // Assert
      expect(result).toEqual(mockData);
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    test('debe cargar datos del CSV si cache expiró', async () => {
      // Arrange
      const mockCsvContent = 'comment,roast\n"test comment","test roast"';
      const mockParsedData = [{ comment: 'test comment', roast: 'test roast' }];

      // Force cache expiry
      csvService.lastLoadTime = 0;

      jest.spyOn(csvService, 'ensureCsvExists').mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockCsvContent);
      Papa.parse.mockReturnValue({
        data: mockParsedData,
        errors: []
      });

      // Act
      const result = await csvService.loadRoasts();

      // Assert
      expect(mockFs.readFile).toHaveBeenCalledWith(csvService.csvFilePath, 'utf8');
      expect(Papa.parse).toHaveBeenCalledWith(mockCsvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ','
      });
      expect(result).toEqual(mockParsedData);
    });

    test('debe filtrar filas vacías del CSV', async () => {
      // Arrange
      const mockParsedData = [
        { comment: 'valid comment', roast: 'valid roast' },
        { comment: '', roast: 'no comment' },
        { comment: 'no roast', roast: '' },
        { comment: 'another valid', roast: 'another roast' }
      ];

      // Force cache expiry
      csvService.lastLoadTime = 0;

      jest.spyOn(csvService, 'ensureCsvExists').mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('mock csv');
      Papa.parse.mockReturnValue({
        data: mockParsedData,
        errors: []
      });

      // Act
      const result = await csvService.loadRoasts();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ comment: 'valid comment', roast: 'valid roast' });
      expect(result[1]).toEqual({ comment: 'another valid', roast: 'another roast' });
    });

    test('debe manejar errores de parsing del CSV', async () => {
      // Arrange
      csvService.lastLoadTime = 0; // Force reload

      jest.spyOn(csvService, 'ensureCsvExists').mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('invalid csv');
      Papa.parse.mockReturnValue({
        data: [],
        errors: [{ message: 'Parse error' }]
      });

      // Act & Assert
      await expect(csvService.loadRoasts()).rejects.toThrow();
    });

    test('debe validar columnas requeridas', async () => {
      // Arrange
      const mockParsedData = [{ comment: 'test', wrongColumn: 'missing roast column' }];

      csvService.lastLoadTime = 0; // Force reload

      jest.spyOn(csvService, 'ensureCsvExists').mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('mock csv');
      Papa.parse.mockReturnValue({
        data: mockParsedData,
        errors: []
      });

      // Act & Assert
      await expect(csvService.loadRoasts()).rejects.toThrow('Missing required CSV columns');
    });
  });

  describe('findBestRoast', () => {
    beforeEach(() => {
      // Mock loadRoasts para estos tests
      const mockData = getMockCsvData();
      jest.spyOn(csvService, 'loadRoasts').mockResolvedValue(mockData);
      csvService.roasts = mockData;
    });

    test('debe encontrar coincidencia exacta', async () => {
      // Arrange
      const exactComment = 'Este comentario es muy aburrido';

      // Act
      const result = await csvService.findBestRoast(exactComment);

      // Assert
      expect(result).toBe(
        '¿Aburrido? Tu comentario tiene menos chispa que una bombilla fundida 💡'
      );
    });

    test('debe encontrar coincidencia por palabras clave', async () => {
      // Arrange
      const similarComment = 'Esta película no me gusta nada';

      // Act
      const result = await csvService.findBestRoast(similarComment);

      // Assert
      expect(result).toBe(
        'Tu crítica cinematográfica tiene la profundidad de un charco después de la lluvia 🎬'
      );
    });

    test('debe devolver roast aleatorio si no hay coincidencias', async () => {
      // Arrange
      const unrelatedComment = 'xyz random text 123';

      // Act
      const result = await csvService.findBestRoast(unrelatedComment);

      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('debe manejar comentarios vacíos', async () => {
      // Act & Assert
      const result = await csvService.findBestRoast('');
      expect(result).toBeDefined();
    });

    test('debe lanzar error si no hay roasts disponibles', async () => {
      // Arrange
      jest.spyOn(csvService, 'loadRoasts').mockResolvedValue([]);

      // Act & Assert
      await expect(csvService.findBestRoast('test')).rejects.toThrow('No roasts available in CSV');
    });
  });

  describe('addRoast', () => {
    test('debe añadir nuevo roast al CSV', async () => {
      // Arrange
      const mockData = getMockCsvData();
      csvService.roasts = mockData; // Set directly instead of mocking loadRoasts

      const newComment = 'New comment';
      const newRoast = 'New roast';
      const mockCsvLine = '"New comment","New roast"';

      Papa.unparse.mockReturnValue(mockCsvLine);
      mockFs.appendFile.mockResolvedValue(undefined);

      // Act
      const result = await csvService.addRoast(newComment, newRoast);

      // Assert
      expect(result).toBe(true);
      expect(csvService.roasts).toContainEqual({ comment: newComment, roast: newRoast });
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        csvService.csvFilePath,
        '\n' + mockCsvLine,
        'utf8'
      );
    });

    test('debe manejar errores al escribir archivo', async () => {
      // Arrange
      csvService.roasts = []; // Set directly
      Papa.unparse.mockReturnValue('"test","test"');
      mockFs.appendFile.mockRejectedValue(new Error('Write error'));

      // Act & Assert
      await expect(csvService.addRoast('test', 'test')).rejects.toThrow('Write error');
    });
  });

  describe('getStats', () => {
    test('debe devolver estadísticas correctas', async () => {
      // Arrange
      const mockData = getMockCsvData();
      jest.spyOn(csvService, 'loadRoasts').mockResolvedValue(mockData);
      csvService.lastLoadTime = 12345;

      // Act
      const stats = await csvService.getStats();

      // Assert
      expect(stats).toEqual({
        totalRoasts: mockData.length,
        lastUpdated: 12345,
        cacheExpiry: csvService.cacheExpiry,
        csvPath: csvService.csvFilePath
      });
    });

    test('debe manejar errores y devolver objeto de error', async () => {
      // Arrange
      jest.spyOn(csvService, 'loadRoasts').mockRejectedValue(new Error('Load error'));

      // Act
      const stats = await csvService.getStats();

      // Assert
      expect(stats).toEqual({ error: 'Load error' });
    });
  });

  describe('Cache behavior', () => {
    test('debe respetar el tiempo de expiración del cache', async () => {
      // Arrange
      const mockData = getMockCsvData();
      csvService.roasts = mockData;
      csvService.lastLoadTime = Date.now() - 6 * 60 * 1000; // 6 minutos atrás (expirado)

      jest.spyOn(csvService, 'ensureCsvExists').mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('comment,roast\n"new","new"');
      Papa.parse.mockReturnValue({
        data: [{ comment: 'new', roast: 'new' }],
        errors: []
      });

      // Act
      await csvService.loadRoasts();

      // Assert
      expect(mockFs.readFile).toHaveBeenCalled(); // Cache expirado, debe recargar
    });
  });
});
