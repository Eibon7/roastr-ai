/**
 * Virtual Scrolling Table Component for Admin Users List
 * Issue #261 - Implement virtual scrolling for lists exceeding 1000 records
 * 
 * Custom implementation without external dependencies to keep bundle size small
 * Optimized for performance with large datasets
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * VirtualScrollTable Component
 * @param {Array} data - Array of items to display
 * @param {number} rowHeight - Height of each row in pixels
 * @param {number} visibleRows - Number of rows to render at once
 * @param {number} buffer - Extra rows to render above/below viewport
 * @param {Function} renderRow - Function to render each row
 * @param {Function} renderHeader - Function to render table header
 * @param {string} className - Additional CSS classes
 * @param {number} threshold - Minimum records to activate virtual scrolling
 */
const VirtualScrollTable = ({
  data = [],
  rowHeight = 64,
  visibleRows = 15,
  buffer = 5,
  renderRow,
  renderHeader,
  className = '',
  threshold = 1000
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Handle scroll events with throttling for better performance
  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    
    // Immediate update for smooth scrolling
    setScrollTop(newScrollTop);
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce for expensive operations if needed
    scrollTimeoutRef.current = setTimeout(() => {
      // Any additional expensive operations can go here
    }, 100);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // If data is below threshold, render normally without virtualization
  if (data.length < threshold) {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          {renderHeader && renderHeader()}
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((item, index) => renderRow(item, index))}
          </tbody>
        </table>
      </div>
    );
  }

  // Calculate virtual scrolling parameters
  const totalHeight = data.length * rowHeight;
  const viewportHeight = visibleRows * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
  const endIndex = Math.min(
    data.length,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer
  );
  const visibleData = data.slice(startIndex, endIndex);
  const offsetY = startIndex * rowHeight;

  return (
    <div className={className}>
      {/* Virtual scrolling notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              Virtual scrolling activado: mostrando {data.length.toLocaleString()} registros. 
              Solo se renderizan los elementos visibles para mejorar el rendimiento.
            </p>
          </div>
        </div>
      </div>

      {/* Fixed header outside scroll container */}
      <div className="border border-gray-200 dark:border-gray-700 border-b-0 rounded-t-lg bg-gray-50 dark:bg-gray-700">
        <table className="min-w-full">
          {renderHeader && renderHeader()}
        </table>
      </div>

      {/* Virtual scroll container */}
      <div 
        ref={containerRef}
        className="overflow-auto border border-gray-200 dark:border-gray-700 border-t-0 rounded-b-lg"
        style={{ height: `${viewportHeight}px` }}
        onScroll={handleScroll}
      >
        {/* Total height container for scrollbar */}
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          {/* Virtual rows container */}
          <div 
            style={{ 
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0
            }}
          >
            <table className="min-w-full">
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {visibleData.map((item, index) => 
                  renderRow(item, startIndex + index)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Scroll position indicator */}
      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
        Mostrando elementos {startIndex + 1} - {Math.min(endIndex, data.length)} de {data.length.toLocaleString()}
      </div>
    </div>
  );
};

export default VirtualScrollTable;