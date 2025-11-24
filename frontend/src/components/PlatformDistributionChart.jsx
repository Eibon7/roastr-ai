/**
 * PlatformDistributionChart Component
 *
 * Displays the distribution of analyzed content across different social media platforms
 * Issue #369 - SPEC 9 - Style Profile Extraction
 *
 * Features:
 * - Platform source distribution
 * - Visual percentage bars
 * - Platform-specific colors and icons
 * - Responsive layout
 */

import React from 'react';

const PlatformDistributionChart = ({ sources, language = 'es' }) => {
  if (!sources || Object.keys(sources).length === 0) return null;

  // Platform configuration with icons and colors
  const platformConfig = {
    twitter: { name: 'Twitter', icon: '🐦', color: 'bg-blue-500' },
    youtube: { name: 'YouTube', icon: '📺', color: 'bg-red-500' },
    instagram: { name: 'Instagram', icon: '📷', color: 'bg-pink-500' },
    facebook: { name: 'Facebook', icon: '📘', color: 'bg-blue-600' },
    discord: { name: 'Discord', icon: '💬', color: 'bg-indigo-500' },
    reddit: { name: 'Reddit', icon: '🔶', color: 'bg-orange-500' },
    tiktok: { name: 'TikTok', icon: '🎵', color: 'bg-gray-900' },
    twitch: { name: 'Twitch', icon: '🎮', color: 'bg-purple-600' },
    bluesky: { name: 'Bluesky', icon: '🦋', color: 'bg-sky-500' }
  };

  // Calculate total and percentages
  const totalItems = Object.values(sources).reduce((sum, count) => sum + count, 0);

  const platformData = Object.entries(sources)
    .map(([platform, count]) => ({
      platform,
      count,
      percentage: Math.round((count / totalItems) * 100),
      config: platformConfig[platform] || {
        name: platform,
        icon: '📱',
        color: 'bg-gray-500'
      }
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900 dark:text-white">
        📊 {language === 'es' ? 'Distribución por plataforma' : 'Platform Distribution'}
      </h4>

      {/* Total Items Display */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            📈 {language === 'es' ? 'Total de elementos' : 'Total items'}
          </span>
          <span className="font-bold text-lg text-gray-900 dark:text-white">
            {totalItems.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="space-y-3">
        {platformData.map(({ platform, count, percentage, config }) => (
          <div key={platform} className="space-y-2">
            {/* Platform Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{config.icon}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {config.name}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {count.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{percentage}%</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className={`${config.color} h-2 rounded-full transition-all duration-700 ease-out`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
        <h5 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          📋 {language === 'es' ? 'Resumen' : 'Summary'}
        </h5>
        <div className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
          <div className="flex justify-between">
            <span>{language === 'es' ? 'Plataformas analizadas:' : 'Platforms analyzed:'}</span>
            <span className="font-medium">{platformData.length}</span>
          </div>
          <div className="flex justify-between">
            <span>{language === 'es' ? 'Plataforma principal:' : 'Primary platform:'}</span>
            <span className="font-medium flex items-center space-x-1">
              <span>{platformData[0]?.config.icon}</span>
              <span>{platformData[0]?.config.name}</span>
            </span>
          </div>
          {platformData.length > 1 && (
            <div className="flex justify-between">
              <span>{language === 'es' ? 'Diversidad:' : 'Diversity:'}</span>
              <span className="font-medium">
                {platformData.length >= 3
                  ? language === 'es'
                    ? 'Alta'
                    : 'High'
                  : language === 'es'
                    ? 'Media'
                    : 'Medium'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Interpretation */}
      {platformData.length > 1 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
          <h5 className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
            💡 {language === 'es' ? 'Interpretación' : 'Interpretation'}
          </h5>
          <p className="text-sm text-green-800 dark:text-green-300">
            {language === 'es' ? (
              <>
                Tu perfil se basa principalmente en contenido de{' '}
                <strong>{platformData[0]?.config.name}</strong>({platformData[0]?.percentage}%), lo
                que proporciona una perspectiva
                {platformData.length >= 3 ? ' diversa' : ' equilibrada'} de tu estilo de
                comunicación.
              </>
            ) : (
              <>
                Your profile is primarily based on <strong>{platformData[0]?.config.name}</strong>
                content ({platformData[0]?.percentage}%), providing a
                {platformData.length >= 3 ? ' diverse' : ' balanced'} perspective of your
                communication style.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default PlatformDistributionChart;
