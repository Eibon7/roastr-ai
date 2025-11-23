import React from 'react';
import { Button } from '../ui/button';
import { AlertCircle } from 'lucide-react';

const colorMap = {
  danger: {
    bg: 'bg-red-50 border-red-200 text-red-700',
    icon: 'text-red-600'
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    icon: 'text-yellow-600'
  }
};

export function ErrorMessage({ title = 'Error', message, onRetry, variant = 'danger' }) {
  const colors = colorMap[variant] || colorMap.danger;

  return (
    <div className={`border p-4 rounded-2xl flex items-start space-x-3 ${colors.bg}`}>
      <AlertCircle className={`h-5 w-5 ${colors.icon}`} />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm mt-1 text-current">{message}</p>
        {onRetry && (
          <Button className="mt-3 px-4 py-2" variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </div>
    </div>
  );
}
