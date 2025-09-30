/**
 * Enhanced ToastContext Tests
 * Tests for CodeRabbit Round 5 security enhancements
 * Issue #405 - Auto-Approval Flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastProvider, useToast } from '../../../frontend/src/contexts/ToastContext';

// Test component to use toast functionality
const TestComponent = () => {
  const { toast } = useToast();

  return (
    <div>
      <button 
        onClick={() => toast.show('Basic toast')} 
        data-testid="basic-toast"
      >
        Basic Toast
      </button>
      <button 
        onClick={() => toast.show({ content: 'Content toast', type: 'success' })} 
        data-testid="content-toast"
      >
        Content Toast
      </button>
      <button 
        onClick={() => toast.success('Success message')} 
        data-testid="success-toast"
      >
        Success Toast
      </button>
      <button 
        onClick={() => toast.error('Error message', { duration: 1000 })} 
        data-testid="error-toast"
      >
        Error Toast
      </button>
      <button 
        onClick={() => toast.action(
          'Action toast', 
          'Click me', 
          () => console.log('Action clicked'),
          { type: 'warning' }
        )} 
        data-testid="action-toast"
      >
        Action Toast
      </button>
      <button 
        onClick={() => toast.show({ 
          content: '<script>alert("xss")</script>Malicious content', 
          type: 'info' 
        })} 
        data-testid="xss-toast"
      >
        XSS Test Toast
      </button>
    </div>
  );
};

const renderWithProvider = (component) => {
  return render(
    <ToastProvider>
      {component}
    </ToastProvider>
  );
};

describe('Enhanced ToastContext', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Basic Toast functionality', () => {
    test('should show basic string toast', async () => {
      renderWithProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('basic-toast'));
      
      expect(screen.getByText('Basic toast')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    test('should show toast with content property', async () => {
      renderWithProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('content-toast'));
      
      expect(screen.getByText('Content toast')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument(); // Success icon
    });

    test('should auto-remove toast after duration', async () => {
      renderWithProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('error-toast'));
      
      expect(screen.getByText('Error message')).toBeInTheDocument();
      
      // Fast-forward time by 1000ms (duration set in test)
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('Error message')).not.toBeInTheDocument();
      });
    });

    test('should manually remove toast when close button clicked', async () => {
      renderWithProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('success-toast'));
      
      expect(screen.getByText('Success message')).toBeInTheDocument();
      
      const closeButton = screen.getByRole('button', { name: /cerrar notificación/i });
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });
  });

  describe('Enhanced Features', () => {
    test('should support action toasts with callback', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      renderWithProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('action-toast'));
      
      expect(screen.getByText('Action toast')).toBeInTheDocument();
      expect(screen.getByText('Click me')).toBeInTheDocument();
      
      const actionButton = screen.getByRole('button', { name: /acción: click me/i });
      fireEvent.click(actionButton);
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Action clicked');
      
      consoleLogSpy.mockRestore();
    });

    test('should display correct type styling and icons', async () => {
      renderWithProvider(<TestComponent />);
      
      // Test success toast
      fireEvent.click(screen.getByTestId('success-toast'));
      const successToast = screen.getByRole('alert');
      expect(successToast).toHaveClass('bg-green-600');
      expect(screen.getByText('✓')).toBeInTheDocument();
      
      // Clear and test error toast
      const closeButton = screen.getByRole('button', { name: /cerrar notificación/i });
      fireEvent.click(closeButton);
      
      fireEvent.click(screen.getByTestId('error-toast'));
      const errorToast = screen.getByRole('alert');
      expect(errorToast).toHaveClass('bg-red-600');
      expect(screen.getByText('✗')).toBeInTheDocument();
    });

    test('should support accessibility features', async () => {
      renderWithProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('basic-toast'));
      
      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('aria-live', 'polite');
      expect(toast).toHaveAttribute('aria-atomic', 'true');
      
      const closeButton = screen.getByRole('button', { name: /cerrar notificación/i });
      expect(closeButton).toHaveAttribute('aria-label', 'Cerrar notificación');
    });
  });

  describe('Security Features', () => {
    test('should sanitize XSS content', async () => {
      renderWithProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('xss-toast'));
      
      // Should show sanitized content, not execute script
      expect(screen.getByText(/&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;Malicious content/)).toBeInTheDocument();
      
      // Script should not have executed
      expect(window.alert).not.toHaveBeenCalled();
    });

    test('should handle various XSS attack vectors', async () => {
      const { toast } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      }).result.current;

      const maliciousInputs = [
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("xss")',
        '<svg onload="alert(1)">',
        '"><script>alert("xss")</script>',
        "'; DROP TABLE users; --"
      ];

      maliciousInputs.forEach(input => {
        act(() => {
          toast.show({ content: input });
        });
      });

      // All should be rendered as safe text
      maliciousInputs.forEach(input => {
        const sanitized = input.replace(/[<>'"&]/g, (char) => {
          const entities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
          return entities[char] || char;
        });
        expect(screen.getByText(new RegExp(sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
      });
    });
  });

  describe('Memory Management', () => {
    test('should clean up timers on manual removal', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      renderWithProvider(<TestComponent />);
      
      fireEvent.click(screen.getByTestId('success-toast'));
      
      const closeButton = screen.getByRole('button', { name: /cerrar notificación/i });
      fireEvent.click(closeButton);
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
    });

    test('should handle rapid toast creation without memory leaks', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      renderWithProvider(<TestComponent />);
      
      // Rapidly create and remove toasts
      for (let i = 0; i < 10; i++) {
        fireEvent.click(screen.getByTestId('basic-toast'));
        const closeButtons = screen.getAllByRole('button', { name: /cerrar notificación/i });
        if (closeButtons.length > 0) {
          fireEvent.click(closeButtons[0]);
        }
      }
      
      // Should have appropriate cleanup calls
      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain backward compatibility with message property', async () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      });

      act(() => {
        result.current.toast.show({ message: 'Legacy message', type: 'info' });
      });

      expect(screen.getByText('Legacy message')).toBeInTheDocument();
    });

    test('should prioritize content over message when both provided', async () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      });

      act(() => {
        result.current.toast.show({ 
          content: 'New content', 
          message: 'Legacy message', 
          type: 'info' 
        });
      });

      expect(screen.getByText('New content')).toBeInTheDocument();
      expect(screen.queryByText('Legacy message')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should handle action callback errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      });

      act(() => {
        result.current.toast.action(
          'Error toast',
          'Error action',
          () => { throw new Error('Callback error'); }
        );
      });

      const actionButton = screen.getByRole('button', { name: /acción: error action/i });
      fireEvent.click(actionButton);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Toast action callback error:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });

    test('should handle non-string content gracefully', async () => {
      const { result } = renderHook(() => useToast(), {
        wrapper: ToastProvider
      });

      act(() => {
        result.current.toast.show({ content: null });
        result.current.toast.show({ content: undefined });
        result.current.toast.show({ content: 123 });
        result.current.toast.show({ content: {} });
      });

      expect(screen.getByText('')).toBeInTheDocument(); // null converted to empty string
      expect(screen.getByText('123')).toBeInTheDocument(); // number converted to string
      expect(screen.getByText('[object Object]')).toBeInTheDocument(); // object converted to string
    });
  });
});

// Import renderHook for hook testing
import { renderHook, act } from '@testing-library/react';