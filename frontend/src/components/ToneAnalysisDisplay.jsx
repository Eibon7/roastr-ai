/**
 * ToneAnalysisDisplay Component
 * 
 * Displays detailed tone analysis and style examples
 * Issue #369 - SPEC 9 - Style Profile Extraction
 * 
 * Features:
 * - Tone breakdown visualization
 * - Style examples display
 * - Interactive tone exploration
 * - Language-specific content
 */

import React, { useState } from 'react';

const ToneAnalysisDisplay = ({ metadata, examples = [], language = 'es' }) => {
  const [selectedTone, setSelectedTone] = useState(null);

  if (!metadata) return null;

  const { dominantTone, styleType } = metadata;

  // Tone descriptions by language
  const toneDescriptions = {
    es: {
      casual: {
        title: 'Casual',
        description: 'Relajado, informal y cercano. Usa expresiones coloquiales y un lenguaje natural.',
        characteristics: ['Lenguaje informal', 'Expresiones coloquiales', 'Tono cercano', 'Comunicación natural']
      },
      formal: {
        title: 'Formal',
        description: 'Profesional, estructurado y cortés. Mantiene un registro elevado y respeta las normas.',
        characteristics: ['Lenguaje profesional', 'Estructura clara', 'Registro elevado', 'Cortesía constante']
      },
      humorous: {
        title: 'Divertido',
        description: 'Bromista, jovial y entretenido. Usa humor para conectar y alegrar las conversaciones.',
        characteristics: ['Uso de humor', 'Tono jovial', 'Bromas frecuentes', 'Conversación entretenida']
      },
      sarcastic: {
        title: 'Sarcástico',
        description: 'Irónico, mordaz y directo. Usa el sarcasmo como herramienta de comunicación.',
        characteristics: ['Ironía constante', 'Comentarios mordaces', 'Tono directo', 'Sarcasmo inteligente']
      },
      friendly: {
        title: 'Amigable',
        description: 'Cálido, empático y supportivo. Busca crear conexiones positivas con otros.',
        characteristics: ['Tono cálido', 'Empatía', 'Apoyo constante', 'Conexiones positivas']
      }
    },
    en: {
      casual: {
        title: 'Casual',
        description: 'Relaxed, informal and approachable. Uses colloquial expressions and natural language.',
        characteristics: ['Informal language', 'Colloquial expressions', 'Approachable tone', 'Natural communication']
      },
      formal: {
        title: 'Formal',
        description: 'Professional, structured and polite. Maintains elevated register and respects norms.',
        characteristics: ['Professional language', 'Clear structure', 'Elevated register', 'Consistent courtesy']
      },
      humorous: {
        title: 'Humorous',
        description: 'Playful, jovial and entertaining. Uses humor to connect and brighten conversations.',
        characteristics: ['Use of humor', 'Jovial tone', 'Frequent jokes', 'Entertaining conversation']
      },
      sarcastic: {
        title: 'Sarcastic',
        description: 'Ironic, sharp and direct. Uses sarcasm as a communication tool.',
        characteristics: ['Constant irony', 'Sharp comments', 'Direct tone', 'Intelligent sarcasm']
      },
      friendly: {
        title: 'Friendly',
        description: 'Warm, empathetic and supportive. Seeks to create positive connections with others.',
        characteristics: ['Warm tone', 'Empathy', 'Constant support', 'Positive connections']
      }
    }
  };

  const currentDescriptions = toneDescriptions[language] || toneDescriptions.es;

  // Style type descriptions
  const styleDescriptions = {
    es: {
      short: 'Prefiere mensajes concisos y directos, va al grano sin rodeos.',
      medium: 'Equilibra brevedad con detalle, proporciona contexto suficiente.',
      long: 'Explica con detalle, proporciona contexto amplio y ejemplos.'
    },
    en: {
      short: 'Prefers concise and direct messages, gets straight to the point.',
      medium: 'Balances brevity with detail, provides sufficient context.',
      long: 'Explains in detail, provides extensive context and examples.'
    }
  };

  const currentStyleDescriptions = styleDescriptions[language] || styleDescriptions.es;

  // Tone colors for visual consistency
  const toneColors = {
    casual: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', accent: 'bg-orange-500' },
    formal: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', accent: 'bg-gray-500' },
    humorous: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', accent: 'bg-yellow-500' },
    sarcastic: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', accent: 'bg-red-500' },
    friendly: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', accent: 'bg-green-500' }
  };

  const dominantToneInfo = currentDescriptions[dominantTone];
  const dominantToneColors = toneColors[dominantTone] || toneColors.casual;

  return (
    <div className="mt-6 space-y-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
        🎭 {language === 'es' ? 'Análisis de tono' : 'Tone Analysis'}
      </h4>

      {/* Dominant Tone Detailed Card */}
      <div className={`${dominantToneColors.bg} ${dominantToneColors.border} border rounded-lg p-6`}>
        <div className="flex items-center space-x-3 mb-4">
          <div className={`w-3 h-3 ${dominantToneColors.accent} rounded-full`}></div>
          <h5 className={`text-xl font-semibold ${dominantToneColors.text}`}>
            {dominantToneInfo?.title} - {language === 'es' ? 'Tono Dominante' : 'Dominant Tone'}
          </h5>
        </div>
        
        <p className={`${dominantToneColors.text} mb-4 leading-relaxed`}>
          {dominantToneInfo?.description}
        </p>

        {/* Characteristics */}
        <div className="grid grid-cols-2 gap-2">
          {dominantToneInfo?.characteristics.map((char, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div className={`w-2 h-2 ${dominantToneColors.accent} rounded-full`}></div>
              <span className={`text-sm ${dominantToneColors.text}`}>{char}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Writing Style Description */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
          ✍️ {language === 'es' ? 'Estilo de escritura' : 'Writing Style'}
        </h5>
        <p className="text-blue-800 dark:text-blue-300">
          {currentStyleDescriptions[styleType] || styleType}
        </p>
      </div>

      {/* Style Examples */}
      {examples && examples.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h5 className="font-medium text-gray-900 dark:text-white mb-4">
            💬 {language === 'es' ? 'Ejemplos de estilo' : 'Style Examples'}
          </h5>
          <div className="space-y-3">
            {examples.map((example, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border-l-4 border-blue-500">
                <p className="text-gray-700 dark:text-gray-300 italic">
                  "{example}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Tone Types Overview */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h5 className="font-medium text-gray-900 dark:text-white mb-4">
          🎯 {language === 'es' ? 'Explorar todos los tonos' : 'Explore All Tones'}
        </h5>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(currentDescriptions).map(([tone, info]) => {
            const colors = toneColors[tone] || toneColors.casual;
            const isSelected = selectedTone === tone;
            const isDominant = tone === dominantTone;
            
            return (
              <button
                key={tone}
                onClick={() => setSelectedTone(isSelected ? null : tone)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  isDominant ? `${colors.bg} ${colors.border} ${colors.text}` :
                  isSelected ? `${colors.bg} ${colors.border} ${colors.text}` :
                  'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <div className={`w-2 h-2 ${colors.accent} rounded-full`}></div>
                  <span className="font-medium text-sm">{info.title}</span>
                  {isDominant && <span className="text-xs">★</span>}
                </div>
                {(isSelected || isDominant) && (
                  <p className="text-xs leading-relaxed mt-2">
                    {info.description}
                  </p>
                )}
              </button>
            );
          })}
        </div>
        
        {selectedTone && selectedTone !== dominantTone && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h6 className="font-medium text-gray-900 dark:text-white mb-2">
              {currentDescriptions[selectedTone]?.title}
            </h6>
            <div className="grid grid-cols-2 gap-2">
              {currentDescriptions[selectedTone]?.characteristics.map((char, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{char}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToneAnalysisDisplay;