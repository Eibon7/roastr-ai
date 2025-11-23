/**
 * StyleAnalysisChart Component
 *
 * Displays style analysis metrics in a visual chart format
 * Issue #369 - SPEC 9 - Style Profile Extraction
 *
 * Features:
 * - Tone distribution visualization
 * - Writing style metrics
 * - Interactive chart elements
 * - Responsive design
 */

import React from 'react';

const StyleAnalysisChart = ({ metadata, language = 'es' }) => {
  if (!metadata) return null;

  const { dominantTone, styleType, avgLength, emojiUsage, questionRate, exclamationRate } =
    metadata;

  // Tone labels by language
  const toneLabels = {
    es: {
      casual: 'Casual',
      formal: 'Formal',
      humorous: 'Divertido',
      sarcastic: 'Sarcástico',
      friendly: 'Amigable'
    },
    en: {
      casual: 'Casual',
      formal: 'Formal',
      humorous: 'Humorous',
      sarcastic: 'Sarcastic',
      friendly: 'Friendly'
    }
  };

  const styleLabels = {
    es: {
      short: 'Conciso',
      medium: 'Equilibrado',
      long: 'Detallado'
    },
    en: {
      short: 'Concise',
      medium: 'Balanced',
      long: 'Detailed'
    }
  };

  const currentToneLabels = toneLabels[language] || toneLabels.es;
  const currentStyleLabels = styleLabels[language] || styleLabels.es;

  // Style type color mapping
  const styleColors = {
    short: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-blue-100 text-blue-800 border-blue-200',
    long: 'bg-purple-100 text-purple-800 border-purple-200'
  };

  const toneColors = {
    casual: 'bg-orange-100 text-orange-800',
    formal: 'bg-gray-100 text-gray-800',
    humorous: 'bg-yellow-100 text-yellow-800',
    sarcastic: 'bg-red-100 text-red-800',
    friendly: 'bg-green-100 text-green-800'
  };

  // Calculate engagement metrics
  const engagementMetrics = [
    {
      label: language === 'es' ? 'Uso de emojis' : 'Emoji usage',
      value: emojiUsage || 0,
      max: 2,
      color: 'bg-yellow-500',
      icon: '😊'
    },
    {
      label: language === 'es' ? 'Frecuencia de preguntas' : 'Question frequency',
      value: questionRate || 0,
      max: 100,
      color: 'bg-blue-500',
      icon: '❓',
      suffix: '%'
    },
    {
      label: language === 'es' ? 'Frecuencia de exclamaciones' : 'Exclamation frequency',
      value: exclamationRate || 0,
      max: 100,
      color: 'bg-red-500',
      icon: '❗',
      suffix: '%'
    }
  ];

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900 dark:text-white">
        📊 {language === 'es' ? 'Análisis de estilo' : 'Style Analysis'}
      </h4>

      {/* Primary Style Indicators */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {language === 'es' ? 'Tono dominante' : 'Dominant tone'}
          </div>
          <div
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${toneColors[dominantTone] || 'bg-gray-100 text-gray-800'}`}
          >
            {currentToneLabels[dominantTone] || dominantTone}
          </div>
        </div>

        <div className="text-center">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {language === 'es' ? 'Estilo de escritura' : 'Writing style'}
          </div>
          <div
            className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${styleColors[styleType] || 'bg-gray-100 text-gray-800 border-gray-200'}`}
          >
            {currentStyleLabels[styleType] || styleType}
          </div>
        </div>
      </div>

      {/* Average Length */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            📏 {language === 'es' ? 'Longitud promedio' : 'Average length'}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {avgLength} {language === 'es' ? 'caracteres' : 'characters'}
          </span>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="space-y-3">
        {engagementMetrics.map((metric, index) => {
          const percentage = Math.min((metric.value / metric.max) * 100, 100);

          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                  <span>{metric.icon}</span>
                  <span>{metric.label}</span>
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {metric.value.toFixed(metric.suffix ? 0 : 2)}
                  {metric.suffix || ''}
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className={`${metric.color} h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Style Interpretation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
        <h5 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
          🎯 {language === 'es' ? 'Interpretación' : 'Interpretation'}
        </h5>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          {language === 'es' ? (
            <>
              Tu estilo es principalmente <strong>{currentToneLabels[dominantTone]}</strong> con
              mensajes <strong>{currentStyleLabels[styleType]}</strong>.
              {emojiUsage > 0.5 && ' Usas emojis frecuentemente para expresarte.'}
              {questionRate > 20 && ' Tiendes a hacer muchas preguntas.'}
              {exclamationRate > 30 && ' Tu comunicación es muy expresiva.'}
            </>
          ) : (
            <>
              Your style is primarily <strong>{currentToneLabels[dominantTone]}</strong> with
              <strong>{currentStyleLabels[styleType]}</strong> messages.
              {emojiUsage > 0.5 && ' You frequently use emojis to express yourself.'}
              {questionRate > 20 && ' You tend to ask many questions.'}
              {exclamationRate > 30 && ' Your communication is very expressive.'}
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default StyleAnalysisChart;
