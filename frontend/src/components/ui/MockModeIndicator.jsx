import React from 'react';
import { Badge } from './badge';
import { isMockModeEnabled } from '../../lib/mockMode';

const MockModeIndicator = ({ 
  size = 'sm', 
  className = '', 
  showOnMobile = false,
  tooltip = 'Using mock data - no external APIs required'
}) => {
  if (!isMockModeEnabled()) {
    return null;
  }

  return (
    <div className={`${className} ${!showOnMobile ? 'hidden sm:block' : ''}`}>
      <Badge 
        variant="outline" 
        className={`
          bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100
          ${size === 'xs' ? 'text-xs px-1.5 py-0.5' : ''}
          ${size === 'sm' ? 'text-xs px-2 py-1' : ''}
        `}
        title={tooltip}
      >
        Mock data
      </Badge>
    </div>
  );
};

export default MockModeIndicator;