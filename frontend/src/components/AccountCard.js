/**
 * AccountCard Component
 *
 * Displays connected social media account with status and monthly roasts count
 */

import React from 'react';
import { NETWORK_ICONS, NETWORK_COLORS } from '../mocks/social';

const AccountCard = ({ account, onClick }) => {
  const isActive = account.status === 'active';
  const networkIcon = NETWORK_ICONS[account.network] || '📱';
  const networkColor = NETWORK_COLORS[account.network] || 'bg-gray-600 text-white';

  const formatRoastCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all cursor-pointer hover:border-primary-300 dark:hover:border-primary-600"
    >
      <div className="flex items-start justify-between">
        {/* Network Icon & Info */}
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-lg ${networkColor} flex items-center justify-center text-lg font-bold`}
          >
            {networkIcon}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {account.handle}
              </h3>

              {/* Status Dot */}
              <div className="flex items-center">
                <div
                  className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <span
                  className={`ml-1 text-xs font-medium ${
                    isActive
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-1">
              {account.network === 'twitter' ? 'X' : account.network}
            </p>
          </div>
        </div>

        {/* Monthly Roasts Count */}
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {formatRoastCount(account.monthlyRoasts)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">roasts/mes</div>
        </div>
      </div>

      {/* Additional Info */}
      {account.settings && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Shield: {account.settings.shieldEnabled ? 'Activo' : 'Inactivo'}</span>
            <span>Auto-aprobación: {account.settings.autoApprove ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountCard;
