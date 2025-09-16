/**
 * Virtual Scrolling Table Component for Admin Users List
 * Issue #261 - Implement virtual scrolling for lists exceeding 1000 records
 * 
 * Custom implementation without external dependencies to keep bundle size small
 * Optimized for performance with large datasets
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

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
  const [isVisible, setIsVisible] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(56); // Dynamic header height
  const containerRef = useRef(null);
  const headerRef = useRef(null); // Ref for header measurement
  const scrollTimeoutRef = useRef(null);
  const lastScrollTop = useRef(0);
  const observerRef = useRef(null);
  const resizeObserverRef = useRef(null); // For header height changes

  // Handle scroll events with optimized throttling for better performance
  const handleScroll = useCallback((e) => {
    // Skip scroll handling if component is not visible
    if (!isVisible) return;

    const newScrollTop = e.target.scrollTop;
    
    // Skip updates if scroll position hasn't changed significantly (improved threshold)
    if (Math.abs(newScrollTop - lastScrollTop.current) < rowHeight / 2) {
      return;
    }

    lastScrollTop.current = newScrollTop;
    
    // Clear existing animation frame
    if (scrollTimeoutRef.current) {
      cancelAnimationFrame(scrollTimeoutRef.current);
    }

    // Use requestAnimationFrame with timestamp for smooth scrolling
    scrollTimeoutRef.current = requestAnimationFrame((timestamp) => {
      // Additional performance check - only update if enough time has passed
      if (timestamp - (handleScroll.lastUpdate || 0) > 16) { // ~60fps
        setScrollTop(newScrollTop);
        handleScroll.lastUpdate = timestamp;
      }
    });
  }, [rowHeight, isVisible]);

  // Set up intersection observer to track visibility
  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Set up ResizeObserver to dynamically measure header height
  useEffect(() => {
    if (!headerRef.current) return;

    // Measure initial header height
    const measureHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.getBoundingClientRect().height;
        setHeaderHeight(height);
      }
    };

    // Initial measurement
    measureHeaderHeight();

    // Set up ResizeObserver for dynamic changes
    if (window.ResizeObserver) {
      resizeObserverRef.current = new ResizeObserver(measureHeaderHeight);
      resizeObserverRef.current.observe(headerRef.current);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [data.length]); // Re-measure when data changes

  // Memoize virtual scrolling calculations for performance (must be before any conditional returns)
  const virtualScrollData = useMemo(() => {
    const totalHeight = data.length * rowHeight;
    const viewportHeight = visibleRows * rowHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const endIndex = Math.min(
      data.length,
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer
    );
    const visibleData = data.slice(startIndex, endIndex);
    const offsetY = startIndex * rowHeight;

    return {
      totalHeight,
      viewportHeight,
      startIndex,
      endIndex,
      visibleData,
      offsetY
    };
  }, [data, rowHeight, visibleRows, scrollTop, buffer]); // Include full data array as dependency

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
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

  const { totalHeight, viewportHeight, startIndex, endIndex, visibleData, offsetY } = virtualScrollData;

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

      {/* Virtual scroll container */}
      <div 
        ref={containerRef}
        className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg"
        style={{ 
          height: `${viewportHeight}px`,
          overflowAnchor: 'none' // Prevent scroll anchoring
        }}
        onScroll={handleScroll}
      >
        {/* Total height container for scrollbar */}
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          {/* Fixed header - Dynamic height measurement */}
          <div 
            ref={headerRef}
            className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-700"
            style={{ height: 'auto' }}
          >
            <table className="min-w-full table-fixed">
              {renderHeader && renderHeader()}
            </table>
          </div>

          {/* Virtual rows container - Dynamic header compensation */}
          <div 
            style={{ 
              transform: `translate3d(0, ${offsetY + headerHeight}px, 0)`, // Dynamic header height compensation
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              willChange: 'transform' // Optimize for frequent transforms
            }}
          >
            <table className="min-w-full">
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {visibleData.map((item, index) => {
                  const globalIndex = startIndex + index;
                  // Optimized key generation for better React reconciliation
                  const itemKey = item.id || `${globalIndex}-${item.email || item.name || index}`;
                  
                  return React.cloneElement(
                    renderRow(item, globalIndex),
                    { 
                      key: itemKey,
                      'data-index': globalIndex // For debugging and testing
                    }
                  );
                })}
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

// PropTypes for type validation
VirtualScrollTable.propTypes = {
  data: PropTypes.array.isRequired,
  rowHeight: PropTypes.number,
  visibleRows: PropTypes.number,
  buffer: PropTypes.number,
  renderRow: PropTypes.func.isRequired,
  renderHeader: PropTypes.func,
  className: PropTypes.string,
  threshold: PropTypes.number
};

VirtualScrollTable.defaultProps = {
  rowHeight: 64,
  visibleRows: 15,
  buffer: 5,
  className: '',
  threshold: 1000,
  renderHeader: null
};

export default VirtualScrollTable;