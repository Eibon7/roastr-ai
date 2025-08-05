const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');

class CsvRoastService {
  constructor() {
    this.csvFilePath = path.join(__dirname, '../../data/roasts.csv');
    this.debug = process.env.DEBUG === 'true';
    this.roasts = [];
    this.lastLoadTime = null;
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
  }

  debugLog(message, ...args) {
    if (this.debug) {
      console.log(`[CSV-DEBUG] ${new Date().toISOString()}: ${message}`, ...args);
    }
  }

  async ensureCsvExists() {
    try {
      await fs.access(this.csvFilePath);
      this.debugLog('✅ CSV file exists at:', this.csvFilePath);
    } catch (error) {
      console.log('📝 CSV file not found, creating sample file...');
      
      const sampleData = [
        ['comment', 'roast'],
        ['Este comentario es muy aburrido', '¿Aburrido? Tu comentario tiene menos chispa que una bombilla fundida 💡'],
        ['No me gusta esta película', 'Tu crítica cinematográfica tiene la profundidad de un charco después de la lluvia 🎬'],
        ['El clima está horrible hoy', 'El clima está mejor que tu actitud, al menos él tiene probabilidades de mejorar ☔'],
        ['Esta comida está mala', 'Tu paladar es más exigente que un crítico michelin con problemas digestivos 🍽️'],
        ['No entiendo este código', 'El código está más claro que tu futuro como programador 💻'],
        ['Este producto es caro', 'Tu concepto de "caro" es tan relativo como tu comprensión de la economía 💸'],
        ['No me funciona la aplicación', 'La aplicación funciona perfectamente... cuando no la usas tú 📱'],
        ['Este curso es muy difícil', 'El curso es tan difícil como explicarte por qué tienes que estudiar 📚'],
        ['No me gusta este diseño', 'Tu sentido del diseño es tan bueno como el de alguien que decora con papel tapiz de los 70s 🎨'],
        ['Esta música es ruidosa', 'Para ti, cualquier sonido más complejo que el silencio es ruidoso 🎵']
      ];

      const csvContent = Papa.unparse(sampleData, {
        header: true,
        delimiter: ','
      });

      // Ensure data directory exists
      await fs.mkdir(path.dirname(this.csvFilePath), { recursive: true });
      await fs.writeFile(this.csvFilePath, csvContent, 'utf8');
      
      console.log('✅ Sample CSV file created with 10 roasts');
      this.debugLog('Sample CSV created at:', this.csvFilePath);
    }
  }

  async loadRoasts() {
    try {
      const now = Date.now();
      
      // Check if cache is still valid
      if (this.roasts.length > 0 && this.lastLoadTime && (now - this.lastLoadTime) < this.cacheExpiry) {
        this.debugLog('📦 Using cached roasts');
        return this.roasts;
      }

      this.debugLog('🔄 Loading roasts from CSV...');
      
      // Ensure CSV file exists
      await this.ensureCsvExists();
      
      // Read CSV file
      const csvContent = await fs.readFile(this.csvFilePath, 'utf8');
      
      // Parse CSV
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        delimiter: ','
      });

      if (parsed.errors.length > 0) {
        console.warn('⚠️ CSV parsing warnings:', parsed.errors);
      }

      // Validate required columns
      const requiredColumns = ['comment', 'roast'];
      const columns = Object.keys(parsed.data[0] || {});
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required CSV columns: ${missingColumns.join(', ')}`);
      }

      // Filter out empty rows and validate data
      this.roasts = parsed.data.filter(row => 
        row.comment && row.comment.trim() && 
        row.roast && row.roast.trim()
      );

      this.lastLoadTime = now;
      
      console.log(`✅ Loaded ${this.roasts.length} roasts from CSV`);
      this.debugLog('Sample roasts loaded:', this.roasts.slice(0, 2));
      
      return this.roasts;
    } catch (error) {
      console.error('❌ Error loading CSV roasts:', error.message);
      throw error;
    }
  }

  async findBestRoast(inputComment) {
    try {
      const roasts = await this.loadRoasts();
      
      if (roasts.length === 0) {
        throw new Error('No roasts available in CSV');
      }

      this.debugLog(`🔍 Finding best roast for: "${inputComment.substring(0, 50)}..."`);
      
      // Simple keyword matching algorithm
      const inputLower = inputComment.toLowerCase();
      const inputWords = inputLower.split(' ').filter(word => word.length > 2);
      
      let bestMatch = null;
      let bestScore = 0;
      
      for (const roast of roasts) {
        const commentLower = roast.comment.toLowerCase();
        const commentWords = commentLower.split(' ').filter(word => word.length > 2);
        
        // Calculate similarity score
        let score = 0;
        
        // Exact match gets highest score
        if (commentLower === inputLower) {
          score = 1000;
        } else if (commentLower.includes(inputLower) || inputLower.includes(commentLower)) {
          score = 100;
        } else {
          // Word matching score
          for (const inputWord of inputWords) {
            for (const commentWord of commentWords) {
              if (inputWord === commentWord) {
                score += 10;
              } else if (inputWord.includes(commentWord) || commentWord.includes(inputWord)) {
                score += 5;
              }
            }
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = roast;
        }
      }
      
      // If no good match found, return a random roast
      if (bestScore === 0) {
        bestMatch = roasts[Math.floor(Math.random() * roasts.length)];
        this.debugLog('🎲 No keyword matches, returning random roast');
      } else {
        this.debugLog(`🎯 Found match with score ${bestScore}: "${bestMatch.comment.substring(0, 30)}..."`);
      }
      
      return bestMatch.roast;
    } catch (error) {
      console.error('❌ Error finding best roast:', error.message);
      throw error;
    }
  }

  async addRoast(comment, roast) {
    try {
      // Load existing roasts to ensure we have current data
      await this.loadRoasts();
      
      // Add new roast to memory cache
      this.roasts.push({ comment, roast });
      
      // Append to CSV file
      const newRow = Papa.unparse([{ comment, roast }], {
        header: false,
        delimiter: ','
      });
      
      await fs.appendFile(this.csvFilePath, '\n' + newRow, 'utf8');
      
      console.log('✅ New roast added to CSV');
      this.debugLog('Added roast:', { comment: comment.substring(0, 30) + '...', roast: roast.substring(0, 30) + '...' });
      
      return true;
    } catch (error) {
      console.error('❌ Error adding roast to CSV:', error.message);
      throw error;
    }
  }

  async getStats() {
    try {
      const roasts = await this.loadRoasts();
      return {
        totalRoasts: roasts.length,
        lastUpdated: this.lastLoadTime,
        cacheExpiry: this.cacheExpiry,
        csvPath: this.csvFilePath
      };
    } catch (error) {
      console.error('❌ Error getting CSV stats:', error.message);
      return { error: error.message };
    }
  }
}

module.exports = CsvRoastService;