import React from 'react';

/**
 * Skeleton placeholder for loading states.
 * Accepts rows and column size to fit cards/sections.
 */
export function SkeletonLoader({ rows = 3, height = 80, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="w-full rounded-2xl bg-gradient-to-r from-slate-200/70 via-slate-200/30 to-slate-200/70 dark:from-slate-700/80 dark:via-slate-700/40 dark:to-slate-700/80 animate-pulse"
          style={{ height }}
        />
      ))}
    </div>
  );
}

