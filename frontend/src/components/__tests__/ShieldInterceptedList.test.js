/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShieldInterceptedList from '../ShieldInterceptedList';

// Mock data with recent dates to avoid filtering issues
const RECENT_DATE = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
const PAST_DATE = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

const mockShieldActions = [
  {
    id: '1',
    action_type: 'block',
    content_snippet: 'Test offensive content',
    platform: 'twitter',
    reason: 'toxic',
    created_at: RECENT_DATE,
    reverted_at: null,
    content_hash: 'abc123def456'
  },
  {
    id: '2',
    action_type: 'mute',
    content_snippet: 'Another problematic comment',
    platform: 'youtube',
    reason: 'harassment',
    created_at: PAST_DATE,
    reverted_at: RECENT_DATE,
    content_hash: 'def456ghi789'
  }
];

describe('ShieldInterceptedList', () => {
  // Mock callback functions
  const mockOnRevertAction = jest.fn();
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnRevertAction.mockClear();
    mockOnRefresh.mockClear();
  });

  describe('Component Rendering', () => {
    test('should render empty state when no intercepted items', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={[]}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      expect(
        screen.getByText('No hay comentarios interceptados en este período')
      ).toBeInTheDocument();
      expect(screen.getByText('🛡️')).toBeInTheDocument();
    });

    test('should render loading state with proper ARIA attributes', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={[]}
          onRevertAction={mockOnRevertAction}
          loading={true}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Cargando eventos de Shield...')).toBeInTheDocument();

      // Check accessibility attributes
      const loadingStatus = screen.getByRole('status');
      expect(loadingStatus).toBeInTheDocument();
      expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
      expect(loadingStatus).toHaveAttribute('aria-busy', 'true');
    });

    test('should render intercepted items when provided', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Test offensive content')).toBeInTheDocument();
      expect(screen.getByText('Another problematic comment')).toBeInTheDocument();
      expect(screen.getAllByText('Tóxico')[0]).toBeInTheDocument(); // Multiple instances: filter button and item badge
      expect(screen.getAllByText('Acoso')[0]).toBeInTheDocument(); // Multiple instances: filter button and item badge
      expect(screen.getByText('Bloqueado')).toBeInTheDocument();
      expect(screen.getByText('Silenciado')).toBeInTheDocument();
    });

    test('should show reverted status for reverted actions', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Revertido')).toBeInTheDocument();
    });
  });

  describe('Filtering Functionality', () => {
    test('should filter by category', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      // Initially shows all items
      expect(screen.getByText('Test offensive content')).toBeInTheDocument();
      expect(screen.getByText('Another problematic comment')).toBeInTheDocument();

      // Filter by toxic category - use the filter button (first one)
      const toxicButton = screen.getAllByText('Tóxico')[0]; // Get the filter button, not the badge
      fireEvent.click(toxicButton);

      // Should show only toxic items
      expect(screen.getByText('Test offensive content')).toBeInTheDocument();
      expect(screen.queryByText('Another problematic comment')).not.toBeInTheDocument();
    });

    test('should filter by time range', () => {
      // Create items with different dates
      const currentDate = new Date();
      const oneDayAgo = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
      const eightDaysAgo = new Date(currentDate.getTime() - 8 * 24 * 60 * 60 * 1000);

      const testItems = [
        {
          ...mockShieldActions[0],
          created_at: oneDayAgo.toISOString()
        },
        {
          ...mockShieldActions[1],
          id: '3',
          content_snippet: 'Old content',
          created_at: eightDaysAgo.toISOString()
        }
      ];

      render(
        <ShieldInterceptedList
          interceptedItems={testItems}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      // Change to 7 days filter
      const timeSelect = screen.getByDisplayValue('Últimos 30 días');
      fireEvent.change(timeSelect, { target: { value: '7d' } });

      // Should show only recent items
      expect(screen.getByText('Test offensive content')).toBeInTheDocument();
      expect(screen.queryByText('Old content')).not.toBeInTheDocument();
    });

    test('should show filtered empty state message for specific category', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      // Filter by a category that doesn't exist in our mock data
      const spamButton = screen.getByText('Spam');
      fireEvent.click(spamButton);

      expect(
        screen.getByText('No hay comentarios de tipo "Spam" en este período')
      ).toBeInTheDocument();
    });
  });

  describe('Revert Functionality', () => {
    test('should show revert button for non-reverted actions only', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      const revertButtons = screen.getAllByText('↶ Revertir acción');
      expect(revertButtons).toHaveLength(1); // Only one non-reverted action
    });

    test('should call onRevertAction when revert button is clicked', async () => {
      mockOnRevertAction.mockResolvedValue();

      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      const revertButton = screen.getByText('↶ Revertir acción');
      fireEvent.click(revertButton);

      await waitFor(() => {
        expect(mockOnRevertAction).toHaveBeenCalledWith('1', 'Revertido desde UI de Shield');
      });
    });

    test('should show loading state during revert operation', async () => {
      let resolveRevert;
      mockOnRevertAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRevert = resolve;
          })
      );

      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      const revertButton = screen.getByText('↶ Revertir acción');
      fireEvent.click(revertButton);

      // Should show loading state
      expect(screen.getByText('⏳ Revirtiendo...')).toBeInTheDocument();

      // Resolve the promise
      resolveRevert();

      await waitFor(() => {
        expect(screen.queryByText('⏳ Revirtiendo...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    test('should call onRefresh when refresh button is clicked', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      const refreshButton = screen.getByText('↻ Actualizar');
      fireEvent.click(refreshButton);

      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });

    test('should disable refresh button when loading', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={true}
          onRefresh={mockOnRefresh}
        />
      );

      const refreshButton = screen.getByText('🔄 Actualizar');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Expandable Details', () => {
    test('should expand and collapse item details', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      // Initially details should be hidden
      expect(screen.queryByText('ID de acción:')).not.toBeInTheDocument();

      // Click to expand details
      const detailsButton = screen.getAllByText('Ver detalles')[0];
      fireEvent.click(detailsButton);

      // Details should be visible
      expect(screen.getByText('ID de acción:')).toBeInTheDocument();
      expect(screen.getByText('Hash del contenido:')).toBeInTheDocument();

      // Click to collapse
      const hideButton = screen.getByText('Ocultar detalles');
      fireEvent.click(hideButton);

      // Details should be hidden again
      expect(screen.queryByText('ID de acción:')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper form labels and controls', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Filtrar por categoría:')).toBeInTheDocument();
      expect(screen.getByText('Período de tiempo:')).toBeInTheDocument();

      const timeSelect = screen.getByDisplayValue('Últimos 30 días');
      expect(timeSelect).toBeInTheDocument();
      expect(timeSelect.tagName).toBe('SELECT');
    });

    test('should have accessible button text and labels', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('↻ Actualizar')).toBeInTheDocument();
      expect(screen.getAllByText('Ver detalles')[0]).toBeInTheDocument(); // Multiple instances due to multiple items
    });
  });

  describe('Date Formatting', () => {
    test('should format dates consistently', () => {
      render(
        <ShieldInterceptedList
          interceptedItems={mockShieldActions}
          onRevertAction={mockOnRevertAction}
          loading={false}
          onRefresh={mockOnRefresh}
        />
      );

      // The component formats dates using Spanish locale
      // Look for specific date pattern - dates are formatted as dd/mm, hh:mm
      const dateElements = screen.getAllByText(/\d{1,2}\/\d{1,2}, \d{1,2}:\d{2}/);
      expect(dateElements.length).toBeGreaterThan(0);
    });
  });
});
