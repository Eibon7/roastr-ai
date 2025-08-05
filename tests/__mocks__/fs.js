/**
 * Mock para el módulo fs nativo de Node.js
 * Usado por csvRoastService que usa fs.promises
 */

// Estado en memoria compartido con fs-extra
const mockFileSystem = new Map();

const mockFs = {
  promises: {
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
    
    stat: jest.fn().mockImplementation(async (path) => {
      if (!mockFileSystem.has(path)) {
        throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
      }
      return {
        isFile: () => true,
        isDirectory: () => false,
        size: mockFileSystem.get(path)?.length || 0,
        mtime: new Date()
      };
    })
  },

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

module.exports = mockFs;