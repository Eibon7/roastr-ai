/**
 * Style Profile Generator Service
 * Generates user style profiles based on their social media content
 */

class StyleProfileGenerator {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('🎨 Initializing Style Profile Generator');
    this.isInitialized = true;
  }

  /**
   * Detect languages in content with minimum thresholds
   */
  detectLanguages(content) {
    const langCount = {};
    const totalCount = content.length;

    content.forEach((item) => {
      if (langCount[item.lang]) {
        langCount[item.lang]++;
      } else {
        langCount[item.lang] = 1;
      }
    });

    // Filter languages that meet criteria
    const qualifiedLanguages = [];

    Object.entries(langCount).forEach(([lang, count]) => {
      const percentage = count / totalCount;

      // Include if >= 25% and >= 50 items, OR if it's dominant (>75%)
      if ((percentage >= 0.25 && count >= 50) || percentage >= 0.75) {
        qualifiedLanguages.push({
          lang,
          count,
          percentage: Math.round(percentage * 100)
        });
      }
    });

    // If no languages qualify, default to the most common one
    if (qualifiedLanguages.length === 0 && Object.keys(langCount).length > 0) {
      const mostCommon = Object.entries(langCount).sort(([, a], [, b]) => b - a)[0];

      qualifiedLanguages.push({
        lang: mostCommon[0],
        count: mostCommon[1],
        percentage: Math.round((mostCommon[1] / totalCount) * 100)
      });
    }

    return qualifiedLanguages.sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze content patterns for a specific language
   */
  analyzeLanguageContent(content, targetLang) {
    const langContent = content.filter((item) => item.lang === targetLang);

    if (langContent.length === 0) {
      return null;
    }

    // Analyze patterns
    const analysis = {
      totalItems: langContent.length,
      platforms: {},
      avgLength: 0,
      commonWords: [],
      toneIndicators: {
        casual: 0,
        formal: 0,
        humorous: 0,
        sarcastic: 0,
        friendly: 0
      },
      emojiUsage: 0,
      questionFrequency: 0,
      exclamationFrequency: 0
    };

    let totalLength = 0;
    const wordCounts = {};

    langContent.forEach((item) => {
      // Platform distribution
      if (analysis.platforms[item.platform]) {
        analysis.platforms[item.platform]++;
      } else {
        analysis.platforms[item.platform] = 1;
      }

      // Text analysis
      if (!item.text || typeof item.text !== 'string') {
        return; // Skip items without valid text
      }
      const text = item.text.toLowerCase();
      totalLength += text.length;

      // Count emojis
      const emojiRegex =
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
      const emojis = text.match(emojiRegex);
      if (emojis) {
        analysis.emojiUsage += emojis.length;
      }

      // Count questions and exclamations
      if (text.includes('?')) analysis.questionFrequency++;
      if (text.includes('!')) analysis.exclamationFrequency++;

      // Word frequency (simple analysis)
      const words = text.split(/\s+/).filter((word) => word.length > 3);
      words.forEach((word) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });

      // Tone analysis (simple heuristics)
      if (text.includes('jaja') || text.includes('haha') || text.includes('lol')) {
        analysis.toneIndicators.humorous++;
      }
      if (text.includes('gracias') || text.includes('thanks') || text.includes('please')) {
        analysis.toneIndicators.friendly++;
      }
      if (text.includes('obviamente') || text.includes('obviously') || text.includes('claro')) {
        analysis.toneIndicators.sarcastic++;
      }
    });

    analysis.avgLength = Math.round(totalLength / langContent.length);

    // Get most common words
    analysis.commonWords = Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return analysis;
  }

  /**
   * Generate style profile for a specific language
   */
  generateLanguageProfile(analysis, lang) {
    const templates = {
      es: {
        tones: {
          casual: ['relajado', 'informal', 'cercano'],
          formal: ['profesional', 'estructurado', 'cortés'],
          humorous: ['divertido', 'bromista', 'jovial'],
          sarcastic: ['sarcástico', 'irónico', 'mordaz'],
          friendly: ['amigable', 'cálido', 'empático']
        },
        styles: {
          short: 'Prefiere mensajes concisos y directos',
          medium: 'Usa un estilo equilibrado entre brevedad y detalle',
          long: 'Tiende a explicar con detalle sus puntos'
        },
        examples: [
          'No me parece correcto eso que dices, creo que deberías reconsiderarlo.',
          'Excelente punto! Me parece muy acertada tu observación al respecto.'
        ]
      },
      en: {
        tones: {
          casual: ['relaxed', 'informal', 'conversational'],
          formal: ['professional', 'structured', 'polite'],
          humorous: ['funny', 'witty', 'playful'],
          sarcastic: ['sarcastic', 'ironic', 'sharp'],
          friendly: ['friendly', 'warm', 'supportive']
        },
        styles: {
          short: 'Prefers concise and direct messages',
          medium: 'Uses a balanced style between brevity and detail',
          long: 'Tends to explain points in detail'
        },
        examples: [
          "I don't think that's quite right, you might want to reconsider that.",
          'Excellent point! I think your observation is very insightful.'
        ]
      },
      pt: {
        tones: {
          casual: ['descontraído', 'informal', 'próximo'],
          formal: ['profissional', 'estruturado', 'cortês'],
          humorous: ['divertido', 'brincalhão', 'alegre'],
          sarcastic: ['sarcástico', 'irônico', 'mordaz'],
          friendly: ['amigável', 'caloroso', 'empático']
        },
        styles: {
          short: 'Prefere mensagens concisas e diretas',
          medium: 'Usa um estilo equilibrado entre brevidade e detalhe',
          long: 'Tende a explicar com detalhes seus pontos'
        },
        examples: [
          'Não me parece correto isso que você diz, acho que deveria reconsiderar.',
          'Excelente ponto! Acho muito acertada sua observação sobre isso.'
        ]
      }
    };

    const template = templates[lang] || templates.en;

    // Determine dominant tone
    const dominantTone = Object.entries(analysis.toneIndicators).sort(
      ([, a], [, b]) => b - a
    )[0][0];

    // Determine style based on average length
    let styleType = 'medium';
    if (analysis.avgLength < 50) styleType = 'short';
    if (analysis.avgLength > 150) styleType = 'long';

    // Build profile prompt
    const toneDescriptors = template.tones[dominantTone] || template.tones.casual;
    const styleDescription = template.styles[styleType];

    const prompt =
      `Eres un usuario ${toneDescriptors.join(', ')} que ${styleDescription.toLowerCase()}. ` +
      `Usas emojis ${analysis.emojiUsage > analysis.totalItems * 0.3 ? 'frecuentemente' : 'ocasionalmente'}. ` +
      `Haces preguntas ${analysis.questionFrequency > analysis.totalItems * 0.2 ? 'a menudo' : 'raramente'} ` +
      `y tiendes a ${analysis.exclamationFrequency > analysis.totalItems * 0.3 ? 'expresar entusiasmo' : 'mantener un tono neutro'}. ` +
      `Tus palabras frecuentes incluyen: ${analysis.commonWords
        .slice(0, 5)
        .map((w) => w.word)
        .join(', ')}. ` +
      `DO: Mantén el tono ${dominantTone}, usa ejemplos concretos. ` +
      `DON'T: Cambies el registro, seas demasiado formal si eres casual o viceversa.`;

    return {
      lang,
      prompt: prompt.substring(0, 1200), // Limit to 1200 chars
      sources: analysis.platforms,
      createdAt: new Date().toISOString(),
      metadata: {
        totalItems: analysis.totalItems,
        avgLength: analysis.avgLength,
        dominantTone,
        styleType,
        emojiUsage: Math.round((analysis.emojiUsage / analysis.totalItems) * 100) / 100,
        questionRate: Math.round((analysis.questionFrequency / analysis.totalItems) * 100),
        exclamationRate: Math.round((analysis.exclamationFrequency / analysis.totalItems) * 100)
      },
      examples: template.examples
    };
  }

  /**
   * Generate style profile from user content
   */
  async generateStyleProfile(userId, contentByPlatform, options = {}) {
    await this.initialize();

    const { maxItemsPerPlatform = 300 } = options;

    console.log(`🎨 Generating style profile for user ${userId}`);

    // Collect all content
    const allContent = [];
    const sources = {};

    Object.entries(contentByPlatform).forEach(([platform, content]) => {
      const limitedContent = content.slice(0, maxItemsPerPlatform);
      allContent.push(...limitedContent);
      sources[platform] = limitedContent.length;
    });

    if (allContent.length === 0) {
      throw new Error('No content available for style profile generation');
    }

    console.log(
      `📊 Analyzing ${allContent.length} items across ${Object.keys(sources).length} platforms`
    );

    // Detect languages
    const detectedLanguages = this.detectLanguages(allContent);
    console.log(
      `🌍 Detected languages:`,
      detectedLanguages.map((l) => `${l.lang} (${l.count} items)`)
    );

    // Generate profile for each qualified language
    const profiles = [];

    for (const langInfo of detectedLanguages) {
      const analysis = this.analyzeLanguageContent(allContent, langInfo.lang);

      if (analysis && analysis.totalItems >= 50) {
        const profile = this.generateLanguageProfile(analysis, langInfo.lang);
        profiles.push(profile);

        console.log(`✨ Generated ${langInfo.lang} profile from ${analysis.totalItems} items`);
      }
    }

    if (profiles.length === 0) {
      throw new Error(
        'Insufficient content to generate style profile (minimum 50 items per language)'
      );
    }

    return {
      profiles,
      totalItems: allContent.length,
      sources,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Get style profile statistics
   */
  getProfileStats(profiles) {
    const stats = {
      languageCount: profiles.length,
      languages: profiles.map((p) => p.lang),
      totalSources: 0,
      avgItemsPerLanguage: 0,
      createdAt: profiles[0]?.createdAt
    };

    let totalItems = 0;
    const allSources = new Set();

    profiles.forEach((profile) => {
      totalItems += profile.metadata.totalItems;
      Object.keys(profile.sources).forEach((source) => allSources.add(source));
    });

    stats.totalSources = allSources.size;
    stats.avgItemsPerLanguage = profiles.length > 0 ? Math.round(totalItems / profiles.length) : 0;

    return stats;
  }
}

module.exports = StyleProfileGenerator;
