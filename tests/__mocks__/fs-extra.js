/**
 * Mock completo para fs-extra
 * Simula operaciones de sistema de archivos en memoria para tests
 */

// Estado en memoria para simular sistema de archivos
const mockFileSystem = new Map();

const mockFsExtra = {
  // Métodos async que retornan promesas
  access: jest.fn().mockImplementation(async (path) => {
    if (!mockFileSystem.has(path)) {
      throw new Error(`ENOENT: no such file or directory, access '${path}'`);
    }
    return undefined;
  }),

  readFile: jest.fn().mockImplementation(async (path, encoding) => {
    if (!mockFileSystem.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return mockFileSystem.get(path);
  }),

  writeFile: jest.fn().mockImplementation(async (path, data, encoding) => {
    mockFileSystem.set(path, data);
    return undefined;
  }),

  appendFile: jest.fn().mockImplementation(async (path, data, encoding) => {
    const existing = mockFileSystem.get(path) || '';
    mockFileSystem.set(path, existing + data);
    return undefined;
  }),

  mkdir: jest.fn().mockResolvedValue(undefined),
  
  ensureFile: jest.fn().mockResolvedValue(undefined),
  
  pathExists: jest.fn().mockImplementation(async (path) => {
    return mockFileSystem.has(path);
  }),

  readJson: jest.fn().mockImplementation(async (path) => {
    if (!mockFileSystem.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    const content = mockFileSystem.get(path);
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in file ${path}`);
    }
  }),

  writeJson: jest.fn().mockImplementation(async (path, data, options) => {
    const content = JSON.stringify(data, null, options?.spaces || 2);
    mockFileSystem.set(path, content);
    return undefined;
  }),

  // Métodos de utilidad para tests
  __mockFileSystem: mockFileSystem,
  
  __setMockFile: (path, content) => {
    mockFileSystem.set(path, content);
  },
  
  __clearMockFileSystem: () => {
    mockFileSystem.clear();
  },
  
  __getMockFile: (path) => {
    return mockFileSystem.get(path);
  }
};

module.exports = mockFsExtra;