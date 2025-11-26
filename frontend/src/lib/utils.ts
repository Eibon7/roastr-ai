/**
 * Utility functions for Roastr.ai frontend
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS classes intelligently
 *
 * Combines clsx (for conditional classes) with tailwind-merge (for deduplication).
 * This ensures that Tailwind classes are properly merged without conflicts.
 *
 * @param inputs - Array of class values (strings, objects, arrays, etc.)
 * @returns Merged class string optimized for Tailwind CSS
 *
 * @example
 * ```tsx
 * cn('px-4 py-2', isActive && 'bg-blue-500', 'px-6')
 * // Returns: 'py-2 bg-blue-500 px-6' (px-4 is overridden by px-6)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
