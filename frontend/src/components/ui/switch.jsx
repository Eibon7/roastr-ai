import React from 'react';

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onClick={() => onCheckedChange && onCheckedChange(!checked)}
      disabled={disabled}
      className={`
        relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        ${checked ? 'bg-green-500 shadow-lg' : 'bg-gray-300 dark:bg-gray-600'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
        ${className}
      `}
      {...props}
    >
      <span
        className={`
          inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-all duration-300
          ${checked ? 'translate-x-7 scale-95' : 'translate-x-1 scale-100'}
          ${!disabled && 'hover:scale-105'}
        `}
        style={{
          boxShadow: checked ? '0 2px 8px rgba(0, 0, 0, 0.2)' : '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}
      />
    </button>
  );
}
