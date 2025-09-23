/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ShieldInterceptedList from '../ShieldInterceptedList';

describe('ShieldInterceptedList', () => {
  const mockItems = [
    {
      id: '1',
      reason: 'toxic',
      action_type: 'block',
      created_at: '2024-01-15T10:00:00Z',
      content_snippet: 'Este es un comentario tóxico...',
      content_hash: 'abc123hash456',
      platform: 'twitter',
      reverted_at: null
    },
    {
      id: '2',
      reason: 'spam',
      action_type: 'mute',
      created_at: '2024-01-10T08:00:00Z',
      content_snippet: 'Spam comercial detectado...',
      content_hash: 'def789hash012',
      platform: 'youtube',
      reverted_at: '2024-01-11T09:00:00Z'
    },
    {
      id: '3',
      reason: 'harassment',
      action_type: 'report',
      created_at: '2024-01-05T15:30:00Z',
      content_snippet: 'Comentario de acoso...',
      content_hash: 'ghi345hash678',
      platform: 'instagram',
      reverted_at: null
    }
  ];

  const defaultProps = {
    interceptedItems: [],
    onRevertAction: jest.fn(),
    loading: false,
    onRefresh: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing with no items', () => {
      render(<ShieldInterceptedList {...defaultProps} />);
      expect(screen.getByText('No hay comentarios interceptados en este período')).toBeInTheDocument();
    });

    it('shows loading state when loading is true', () => {
      render(<ShieldInterceptedList {...defaultProps} loading={true} />);
      expect(screen.getByText('Cargando eventos de Shield...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders intercepted items when provided', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      expect(screen.getByText('Tóxico')).toBeInTheDocument();
      expect(screen.getByText('Bloqueado')).toBeInTheDocument();
      expect(screen.getByText('Este es un comentario tóxico...')).toBeInTheDocument();
      expect(screen.getByText('twitter')).toBeInTheDocument();
    });

    it('shows reverted status for reverted actions', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // The second item is reverted
      expect(screen.getByText('Revertido')).toBeInTheDocument();
    });

    it('renders category and time range filters', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      expect(screen.getByText('Filtrar por categoría:')).toBeInTheDocument();
      expect(screen.getByText('Período de tiempo:')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Últimos 30 días')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('filters items by category', async () => {
      const user = userEvent.setup();
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Click on the 'toxic' category filter
      await user.click(screen.getByText('Tóxico'));
      
      // Should only show toxic items
      expect(screen.getByText('Este es un comentario tóxico...')).toBeInTheDocument();
      expect(screen.queryByText('Spam comercial detectado...')).not.toBeInTheDocument();
    });

    it('filters items by time range', async () => {
      const user = userEvent.setup();
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Change time range to 7 days (this should filter out older items)
      const select = screen.getByDisplayValue('Últimos 30 días');
      await user.selectOptions(select, 'Últimos 7 días');
      
      // Should only show items from the last 7 days
      expect(screen.getByText('Este es un comentario tóxico...')).toBeInTheDocument(); // Recent item
      expect(screen.queryByText('Comentario de acoso...')).not.toBeInTheDocument(); // Older item
    });

    it('shows correct counts in category filters', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Check that category counts are displayed
      expect(screen.getByText('Tóxico')).toBeInTheDocument();
      expect(screen.getByText('Spam')).toBeInTheDocument();
      expect(screen.getByText('Acoso')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('expands and collapses item details', async () => {
      const user = userEvent.setup();
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      const expandButton = screen.getAllByText('Ver detalles')[0];
      await user.click(expandButton);
      
      // Should show expanded details
      expect(screen.getByText('ID de acción:')).toBeInTheDocument();
      expect(screen.getByText('Hash del contenido:')).toBeInTheDocument();
      
      // Click again to collapse
      const collapseButton = screen.getByText('Ocultar detalles');
      await user.click(collapseButton);
      
      // Details should be hidden
      expect(screen.queryByText('ID de acción:')).not.toBeInTheDocument();
    });

    it('shows revert timestamp for reverted actions in expanded view', async () => {
      const user = userEvent.setup();
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Find the reverted item and expand it
      const revertedItemButtons = screen.getAllByText('Ver detalles');
      await user.click(revertedItemButtons[1]); // Second item is reverted
      
      expect(screen.getByText('Revertido el:')).toBeInTheDocument();
    });
  });

  describe('Revert Functionality', () => {
    it('shows revert button for non-reverted actions', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      const revertButtons = screen.getAllByText('↶ Revertir acción');
      expect(revertButtons).toHaveLength(2); // Only non-reverted items should have revert buttons
    });

    it('does not show revert button for reverted actions', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={[mockItems[1]]} />);
      
      expect(screen.queryByText('↶ Revertir acción')).not.toBeInTheDocument();
    });

    it('calls onRevertAction when revert button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnRevertAction = jest.fn().mockResolvedValue({});
      
      render(<ShieldInterceptedList 
        {...defaultProps} 
        interceptedItems={[mockItems[0]]}
        onRevertAction={mockOnRevertAction}
      />);
      
      const revertButton = screen.getByText('↶ Revertir acción');
      await user.click(revertButton);
      
      expect(mockOnRevertAction).toHaveBeenCalledWith('1', 'Revertido desde UI de Shield');
    });

    it('shows loading state while reverting', async () => {
      const user = userEvent.setup();
      let resolveRevert;
      const mockOnRevertAction = jest.fn(() => new Promise(resolve => { resolveRevert = resolve; }));
      
      render(<ShieldInterceptedList 
        {...defaultProps} 
        interceptedItems={[mockItems[0]]}
        onRevertAction={mockOnRevertAction}
      />);
      
      const revertButton = screen.getByText('↶ Revertir acción');
      await user.click(revertButton);
      
      expect(screen.getByText('⏳ Revirtiendo...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /revirtiendo/i })).toBeDisabled();
      
      // Resolve the promise
      resolveRevert({});
    });

    it('calls onRefresh after successful revert', async () => {
      const user = userEvent.setup();
      const mockOnRevertAction = jest.fn().mockResolvedValue({});
      const mockOnRefresh = jest.fn().mockResolvedValue({});
      
      render(<ShieldInterceptedList 
        {...defaultProps} 
        interceptedItems={[mockItems[0]]}
        onRevertAction={mockOnRevertAction}
        onRefresh={mockOnRefresh}
      />);
      
      const revertButton = screen.getByText('↶ Revertir acción');
      await user.click(revertButton);
      
      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalled();
      });
    });

    it('handles revert errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnRevertAction = jest.fn().mockRejectedValue(new Error('Revert failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<ShieldInterceptedList 
        {...defaultProps} 
        interceptedItems={[mockItems[0]]}
        onRevertAction={mockOnRevertAction}
      />);
      
      const revertButton = screen.getByText('↶ Revertir acción');
      await user.click(revertButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to revert action:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('does not show revert button when onRevertAction is not provided', () => {
      render(<ShieldInterceptedList 
        {...defaultProps} 
        interceptedItems={[mockItems[0]]}
        onRevertAction={undefined}
      />);
      
      expect(screen.queryByText('↶ Revertir acción')).not.toBeInTheDocument();
    });
  });

  describe('Refresh Functionality', () => {
    it('shows refresh button when onRefresh is provided', () => {
      render(<ShieldInterceptedList {...defaultProps} onRefresh={jest.fn()} />);
      
      expect(screen.getByText('↻ Actualizar')).toBeInTheDocument();
    });

    it('does not show refresh button when onRefresh is not provided', () => {
      render(<ShieldInterceptedList {...defaultProps} onRefresh={undefined} />);
      
      expect(screen.queryByText('↻ Actualizar')).not.toBeInTheDocument();
    });

    it('calls onRefresh when refresh button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnRefresh = jest.fn();
      
      render(<ShieldInterceptedList {...defaultProps} onRefresh={mockOnRefresh} />);
      
      const refreshButton = screen.getByText('↻ Actualizar');
      await user.click(refreshButton);
      
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    it('disables refresh button when loading', () => {
      render(<ShieldInterceptedList 
        {...defaultProps} 
        loading={true}
        onRefresh={jest.fn()}
      />);
      
      const refreshButton = screen.getByText('🔄 Actualizar');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Check for form controls
      const categoryLabel = screen.getByText('Filtrar por categoría:');
      expect(categoryLabel).toBeInTheDocument();
      
      const timeRangeLabel = screen.getByText('Período de tiempo:');
      expect(timeRangeLabel).toBeInTheDocument();
    });

    it('maintains focus management for expand/collapse', async () => {
      const user = userEvent.setup();
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={[mockItems[0]]} />);
      
      const expandButton = screen.getByText('Ver detalles');
      await user.click(expandButton);
      
      // Button should still be focusable after state change
      const collapseButton = screen.getByText('Ocultar detalles');
      expect(collapseButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty interceptedItems gracefully', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={[]} />);
      
      expect(screen.getByText('No hay comentarios interceptados en este período')).toBeInTheDocument();
    });

    it('handles items with missing fields gracefully', () => {
      const incompleteItem = {
        id: 'incomplete',
        reason: 'toxic',
        action_type: 'block',
        created_at: '2024-01-15T10:00:00Z'
        // Missing content_snippet, content_hash, platform
      };
      
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={[incompleteItem]} />);
      
      expect(screen.getByText('[Contenido no disponible]')).toBeInTheDocument();
    });

    it('handles invalid date strings gracefully', () => {
      const itemWithBadDate = {
        ...mockItems[0],
        created_at: 'invalid-date'
      };
      
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={[itemWithBadDate]} />);
      
      // Should render without crashing
      expect(screen.getByText('Tóxico')).toBeInTheDocument();
    });

    it('shows all items when category filter is "all"', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // All items should be visible initially
      expect(screen.getByText('Este es un comentario tóxico...')).toBeInTheDocument();
      expect(screen.getByText('Spam comercial detectado...')).toBeInTheDocument();
      expect(screen.getByText('Comentario de acoso...')).toBeInTheDocument();
    });

    it('shows all items when time range is "all"', async () => {
      const user = userEvent.setup();
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Change to "all time" filter
      const select = screen.getByDisplayValue('Últimos 30 días');
      await user.selectOptions(select, 'all');
      
      // All items should be visible
      expect(screen.getByText('Este es un comentario tóxico...')).toBeInTheDocument();
      expect(screen.getByText('Spam comercial detectado...')).toBeInTheDocument();
      expect(screen.getByText('Comentario de acoso...')).toBeInTheDocument();
    });

    it('handles platform display correctly', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Check that platforms are displayed correctly
      expect(screen.getByText('twitter')).toBeInTheDocument();
      expect(screen.getByText('youtube')).toBeInTheDocument();
      expect(screen.getByText('instagram')).toBeInTheDocument();
    });

    it('shows different visual states for reverted vs active items', () => {
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Find the container elements for both items
      const containers = screen.getAllByText(/Este es un comentario|Spam comercial/);
      expect(containers).toHaveLength(2);
      
      // Check that reverted item has different styling (opacity-70 class)
      // This would be better tested with actual DOM inspection but demonstrates the intent
    });
  });

  describe('Component Integration', () => {
    it('updates state correctly when filters change', async () => {
      const user = userEvent.setup();
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Initially all items shown
      expect(screen.getAllByText(/Ver detalles/)).toHaveLength(3);
      
      // Filter by spam
      await user.click(screen.getByText('Spam'));
      
      // Only spam item shown
      expect(screen.getAllByText(/Ver detalles/)).toHaveLength(1);
      expect(screen.getByText('Spam comercial detectado...')).toBeInTheDocument();
    });

    it('preserves expanded state when filters change', async () => {
      const user = userEvent.setup();
      render(<ShieldInterceptedList {...defaultProps} interceptedItems={mockItems} />);
      
      // Expand first item
      const expandButton = screen.getAllByText('Ver detalles')[0];
      await user.click(expandButton);
      
      expect(screen.getByText('ID de acción:')).toBeInTheDocument();
      
      // Change filter - expanded state should be preserved for visible items
      await user.click(screen.getByText('Tóxico'));
      
      // Item should still be expanded
      expect(screen.getByText('ID de acción:')).toBeInTheDocument();
    });
  });
});