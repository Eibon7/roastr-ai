# 🧪 Tests de Roastr.ai

Esta carpeta contiene todos los tests unitarios y de integración para Roastr.ai, implementados con Jest.

## 📁 Estructura

```
tests/
├── unit/                    # Tests unitarios (sin dependencias externas)
│   ├── roastGeneratorReal.test.js   # Tests del generador de roasts OpenAI
│   ├── csvRoastService.test.js      # Tests del servicio CSV
│   └── twitterService.test.js       # Tests del bot de Twitter
├── integration/             # Tests de integración (APIs completas)
│   └── api.test.js         # Tests de endpoints HTTP
├── helpers/                 # Utilidades compartidas
│   └── testUtils.js        # Mocks y helpers reutilizables
├── setup.js                # Configuración global de tests
└── README.md               # Esta documentación
```

## 🚀 Ejecutar Tests

### Comandos Disponibles

```bash
# Ejecutar todos los tests una vez
npm test

# Ejecutar tests en modo watch (re-ejecuta cuando cambian archivos)
npm run test:watch

# Ejecutar tests con reporte de cobertura
npm run test:coverage
```

### Opciones Avanzadas

```bash
# Ejecutar solo tests unitarios
npx jest tests/unit

# Ejecutar solo tests de integración
npx jest tests/integration

# Ejecutar un archivo específico
npx jest tests/unit/roastGeneratorReal.test.js

# Ejecutar tests con patrón específico
npx jest --testNamePattern="debe generar roast"

# Ejecutar tests en modo verbose (salida detallada)
npx jest --verbose
```

## 📊 Cobertura de Tests

### Objetivos de Cobertura
- **Funciones**: >90%
- **Líneas**: >85%
- **Branches**: >80%
- **Statements**: >85%

### Ver Reporte de Cobertura
Después de ejecutar `npm run test:coverage`:

```bash
# Ver reporte en terminal
cat coverage/lcov-report/index.html

# Abrir reporte HTML detallado
open coverage/lcov-report/index.html  # macOS
xdg-open coverage/lcov-report/index.html  # Linux
```

## 🧪 Tipos de Tests

### Tests Unitarios (`/unit`)

**Características:**
- Prueban componentes individuales de forma aislada
- Usan mocks para todas las dependencias externas
- Son rápidos y determinísticos
- No requieren conexión a internet ni APIs reales

**Cobertura actual:**
- ✅ `RoastGeneratorReal`: Generación de roasts con diferentes tonos
- ✅ `CsvRoastService`: Búsqueda inteligente en CSV, cache, CRUD
- ✅ `TwitterRoastBot`: Rate limiting, error handling, tweet processing

### Tests de Integración (`/integration`)

**Características:**
- Prueban el comportamiento end-to-end de las APIs
- Simulan requests HTTP reales
- Validan la integración entre componentes
- Usan mocks para servicios externos (OpenAI, Twitter)

**Cobertura actual:**
- ✅ `POST /roast`: Generación con diferentes tonos y validación
- ✅ `POST /csv-roast`: Búsqueda en CSV y manejo de errores
- ✅ `GET /csv-stats`: Estadísticas del servicio CSV
- ✅ `POST /csv-add`: Añadir nuevos roasts al CSV

## 🛠️ Añadir Nuevos Tests

### 1. Tests Unitarios

```javascript
// tests/unit/nuevoServicio.test.js
const NuevoServicio = require('../../src/services/nuevoServicio');
const { setMockEnvVars, cleanupMocks } = require('../helpers/testUtils');

describe('NuevoServicio', () => {
  let servicio;

  beforeAll(() => {
    setMockEnvVars();
  });

  beforeEach(() => {
    cleanupMocks();
    servicio = new NuevoServicio();
  });

  afterEach(() => {
    cleanupMocks();
  });

  test('debe funcionar correctamente', () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = servicio.metodo(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
});
```

### 2. Tests de Integración

```javascript
// tests/integration/nuevoEndpoint.test.js
const request = require('supertest');
const app = require('../../src/app'); // Importar la app Express

describe('POST /nuevo-endpoint', () => {
  test('debe responder correctamente', async () => {
    const response = await request(app)
      .post('/nuevo-endpoint')
      .send({ data: 'test' })
      .expect(200);

    expect(response.body).toHaveProperty('result');
  });
});
```

## 🧰 Utilidades Disponibles

### TestUtils Helpers

```javascript
const {
  createMockOpenAIResponse,    // Mock respuesta de OpenAI
  getMockRoastByTone,          // Mock roast por tono
  createMockTwitterUser,       // Mock usuario de Twitter
  createMockTweet,             // Mock tweet
  getMockCsvData,              // Datos CSV de prueba
  getValidTestData,            // Datos válidos para endpoints
  setMockEnvVars,              // Configurar env vars para tests
  cleanupMocks,                // Limpiar mocks después de tests
  delay,                       // Utility para delays async
  generateTestId,              // Generar IDs únicos para tests
  validateApiResponse          // Validar estructura de respuesta
} = require('./helpers/testUtils');
```

### Patterns Recomendados

```javascript
// 1. Usar Arrange-Act-Assert pattern
test('descripción del test', () => {
  // Arrange: configurar datos y mocks
  const input = 'test';
  mock.mockReturnValue('expected');
  
  // Act: ejecutar la función a testear
  const result = functionUnderTest(input);
  
  // Assert: verificar el resultado
  expect(result).toBe('expected');
});

// 2. Describir lo que hace, no cómo lo hace
test('debe generar roast sarcástico', () => { /* ... */ });
// ❌ test('debe llamar a openai.chat.completions.create', () => { /* ... */ });

// 3. Usar nombres descriptivos para variables
test('debe rechazar message vacío', () => {
  const emptyMessage = '';
  // ❌ const msg = '';
});
```

## 🐛 Debugging Tests

### Tests que Fallan

```bash
# Ejecutar solo el test que falla
npx jest --testNamePattern="nombre del test que falla"

# Ver salida completa de errores
npx jest --verbose --no-coverage

# Ejecutar test específico con más detalle
npx jest tests/unit/archivo.test.js --verbose
```

### Debugging con Console

```javascript
test('debug test', () => {
  console.log('Debug info:', data); // Se verá en la salida
  expect(result).toBe(expected);
});
```

### Debugging Mocks

```javascript
test('verificar mock calls', () => {
  // Ver todas las llamadas a un mock
  console.log(mockFunction.mock.calls);
  
  // Ver argumentos de la primera llamada
  console.log(mockFunction.mock.calls[0]);
  
  // Verificar cuántas veces se llamó
  expect(mockFunction).toHaveBeenCalledTimes(1);
});
```

## 📋 Checklist para Nuevos Features

Cuando añadas una nueva funcionalidad:

- [ ] ✅ Crear tests unitarios para la lógica core
- [ ] ✅ Crear tests de integración si es un endpoint
- [ ] ✅ Mockear todas las dependencias externas
- [ ] ✅ Probar casos edge (valores vacíos, nulls, errores)
- [ ] ✅ Verificar cobertura de código >85%
- [ ] ✅ Documentar casos de uso especiales
- [ ] ✅ Ejecutar `npm test` antes de hacer commit

## 🔄 Integración Continua

Los tests se ejecutan automáticamente en:
- ✅ Cada commit (pre-commit hook)
- ✅ Pull requests hacia main
- ✅ Deploy a staging

### Configuración CI/CD
```yaml
# .github/workflows/test.yml (ejemplo)
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## 🚨 Troubleshooting

### Problemas Comunes

1. **"Cannot find module"**
   ```bash
   # Verificar que todas las dependencias estén instaladas
   npm install
   ```

2. **"Timeout"**
   ```javascript
   // Aumentar timeout para tests lentos
   jest.setTimeout(15000); // 15 segundos
   ```

3. **"Mock is not a function"**
   ```javascript
   // Verificar que el mock esté correctamente configurado
   mockFunction.mockImplementation(() => 'result');
   ```

4. **"Memory leak detected"**
   ```javascript
   // Limpiar mocks después de cada test
   afterEach(() => {
     jest.clearAllMocks();
   });
   ```

---

Para más información sobre Jest: https://jestjs.io/docs/getting-started