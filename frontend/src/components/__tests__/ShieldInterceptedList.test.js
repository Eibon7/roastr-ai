/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShieldInterceptedList from '../ShieldInterceptedList';

// Mock Supabase
const mockSupabaseQuery = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
};

const mockSupabase = {
  from: jest.fn(() => mockSupabaseQuery),
};

jest.mock('../lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Shield: ({ className, ...props }) => <div data-testid="shield-icon" className={className} {...props} />,
  Clock: ({ className, ...props }) => <div data-testid="clock-icon" className={className} {...props} />,
  AlertTriangle: ({ className, ...props }) => <div data-testid="alert-triangle-icon" className={className} {...props} />,
  CheckCircle: ({ className, ...props }) => <div data-testid="check-circle-icon" className={className} {...props} />,
  XCircle: ({ className, ...props }) => <div data-testid="x-circle-icon" className={className} {...props} />,
  RotateCcw: ({ className, ...props }) => <div data-testid="rotate-ccw-icon" className={className} {...props} />,
  Calendar: ({ className, ...props }) => <div data-testid="calendar-icon" className={className} {...props} />,
  Filter: ({ className, ...props }) => <div data-testid="filter-icon" className={className} {...props} />,
  RefreshCw: ({ className, ...props }) => <div data-testid="refresh-cw-icon" className={className} {...props} />,
  AlertCircle: ({ className, ...props }) => <div data-testid="alert-circle-icon" className={className} {...props} />,
  Info: ({ className, ...props }) => <div data-testid="info-icon" className={className} {...props} />,
}));

// Mock data
const mockShieldActions = [
  {
    id: '1',
    action_type: 'block',
    content: 'Test offensive content',
    platform: 'twitter',
    reason: 'toxic',
    created_at: '2024-01-15T10:00:00Z',
    reverted_at: null,
    metadata: {},
  },
  {
    id: '2',
    action_type: 'mute',
    content: 'Another problematic comment',
    platform: 'youtube',
    reason: 'harassment',
    created_at: '2024-01-14T15:30:00Z',
    reverted_at: '2024-01-14T16:00:00Z',
    metadata: { reverted: true },
  },
];

describe('ShieldInterceptedList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful response for feature flag check
    mockSupabaseQuery.single.mockResolvedValue({
      data: { enabled: true },
      error: null,
    });
    
    // Default successful response for shield actions
    mockSupabaseQuery.range.mockResolvedValue({
      data: mockShieldActions,
      error: null,
      count: 2,
    });
  });

  describe('Component Rendering', () => {
    test('should render Shield UI header when feature flag is enabled', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Shield - Contenido Interceptado')).toBeInTheDocument();
      });
    });

    test('should render disabled state when feature flag is disabled', async () => {
      mockSupabaseQuery.single.mockResolvedValue({
        data: { enabled: false },
        error: null,
      });

      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Próximamente')).toBeInTheDocument();
        expect(screen.getByText(/La interfaz de Shield está actualmente en desarrollo/)).toBeInTheDocument();
      });
    });

    test('should render loading state initially', () => {
      render(<ShieldInterceptedList />);
      
      // Should show loading skeletons
      expect(screen.getAllByTestId('refresh-cw-icon')).toHaveLength(1);
    });
  });

  describe('Data Fetching', () => {
    test('should fetch and display shield actions', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test offensive content')).toBeInTheDocument();
        expect(screen.getByText('Another problematic comment')).toBeInTheDocument();
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('shield_actions');
      expect(mockSupabaseQuery.select).toHaveBeenCalled();
      expect(mockSupabaseQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    test('should handle API errors gracefully', async () => {
      mockSupabaseQuery.range.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
        count: 0,
      });

      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
      });
    });

    test('should show empty state when no data is available', async () => {
      mockSupabaseQuery.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText('No hay contenido interceptado')).toBeInTheDocument();
        expect(screen.getByText('Aún no se ha interceptado ningún contenido.')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering Functionality', () => {
    test('should apply time range filter', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Últimos 30 días')).toBeInTheDocument();
      });

      // Change time range filter
      const timeRangeSelect = screen.getByDisplayValue('Últimos 30 días');
      
      await act(async () => {
        fireEvent.change(timeRangeSelect, { target: { value: '7d' } });
      });

      expect(timeRangeSelect.value).toBe('7d');
    });

    test('should apply category filter', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Todas las categorías')).toBeInTheDocument();
      });

      // Change category filter
      const categorySelect = screen.getByDisplayValue('Todas las categorías');
      
      await act(async () => {
        fireEvent.change(categorySelect, { target: { value: 'toxic' } });
      });

      expect(categorySelect.value).toBe('toxic');
    });

    test('should reset to first page when filters change', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test offensive content')).toBeInTheDocument();
      });

      // Change filter
      const categorySelect = screen.getByDisplayValue('Todas las categorías');
      
      await act(async () => {
        fireEvent.change(categorySelect, { target: { value: 'spam' } });
      });

      // Should reset to page 1 and make new query
      expect(mockSupabaseQuery.range).toHaveBeenCalledWith(0, 19); // First page (0-19)
    });
  });

  describe('Revert Functionality', () => {
    test('should show revert button for non-reverted actions', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        const revertButtons = screen.getAllByText('Revertir');
        expect(revertButtons).toHaveLength(1); // Only one non-reverted action
      });
    });

    test('should show reverted status for reverted actions', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Revertido el/)).toBeInTheDocument();
      });
    });

    test('should open confirmation dialog when revert button is clicked', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        const revertButton = screen.getByText('Revertir');
        expect(revertButton).toBeInTheDocument();
      });

      const revertButton = screen.getByText('Revertir');
      
      await act(async () => {
        fireEvent.click(revertButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Confirmar reversión')).toBeInTheDocument();
        expect(screen.getByText(/¿Estás seguro de que quieres revertir esta acción de Shield?/)).toBeInTheDocument();
      });
    });

    test('should cancel revert when cancel button is clicked', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      // Open dialog
      await waitFor(() => {
        const revertButton = screen.getByText('Revertir');
        fireEvent.click(revertButton);
      });

      // Cancel
      await waitFor(() => {
        const cancelButton = screen.getByText('Cancelar');
        expect(cancelButton).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancelar');
      
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('Confirmar reversión')).not.toBeInTheDocument();
      });
    });

    test('should perform revert when confirmed', async () => {
      // Mock successful update
      mockSupabaseQuery.update.mockResolvedValue({
        data: {},
        error: null,
      });

      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      // Open dialog
      await waitFor(() => {
        const revertButton = screen.getByText('Revertir');
        fireEvent.click(revertButton);
      });

      // Confirm revert
      await waitFor(() => {
        const confirmButtons = screen.getAllByText('Revertir');
        const confirmButton = confirmButtons.find(btn => btn.closest('.bg-yellow-600'));
        expect(confirmButton).toBeInTheDocument();
      });

      const confirmButtons = screen.getAllByText('Revertir');
      const confirmButton = confirmButtons.find(btn => btn.closest('.bg-yellow-600'));
      
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockSupabaseQuery.update).toHaveBeenCalled();
      });
    });
  });

  describe('Pagination', () => {
    test('should show pagination when there are multiple pages', async () => {
      // Mock response with more items
      mockSupabaseQuery.range.mockResolvedValue({
        data: mockShieldActions,
        error: null,
        count: 50, // More than items per page (20)
      });

      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
        expect(screen.getByText('Siguiente')).toBeInTheDocument();
      });
    });

    test('should navigate between pages', async () => {
      // Mock response with more items
      mockSupabaseQuery.range.mockResolvedValue({
        data: mockShieldActions,
        error: null,
        count: 50,
      });

      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        const nextButton = screen.getByText('Siguiente');
        expect(nextButton).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Siguiente');
      
      await act(async () => {
        fireEvent.click(nextButton);
      });

      // Should request next page
      expect(mockSupabaseQuery.range).toHaveBeenCalledWith(20, 39); // Second page (20-39)
    });
  });

  describe('Refresh Functionality', () => {
    test('should refresh data when refresh button is clicked', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        const refreshButton = screen.getByText('Actualizar');
        expect(refreshButton).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('Actualizar');
      
      await act(async () => {
        fireEvent.click(refreshButton);
      });

      // Should make additional query call
      expect(mockSupabase.from).toHaveBeenCalledTimes(3); // Feature flag + initial load + refresh
    });
  });

  describe('Action Type Display', () => {
    test('should display correct action types and colors', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Bloqueado')).toBeInTheDocument();
        expect(screen.getByText('Silenciado')).toBeInTheDocument();
      });
    });

    test('should display platform information', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText('twitter')).toBeInTheDocument();
        expect(screen.getByText('youtube')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle feature flag check errors gracefully', async () => {
      mockSupabaseQuery.single.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      // Should default to enabled and continue loading
      await waitFor(() => {
        expect(screen.getByText('Shield - Contenido Interceptado')).toBeInTheDocument();
      });
    });

    test('should handle revert errors', async () => {
      mockSupabaseQuery.update.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      // Open and confirm revert dialog
      await waitFor(() => {
        const revertButton = screen.getByText('Revertir');
        fireEvent.click(revertButton);
      });

      await waitFor(() => {
        const confirmButtons = screen.getAllByText('Revertir');
        const confirmButton = confirmButtons.find(btn => btn.closest('.bg-yellow-600'));
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Error al revertir la acción: Update failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        const refreshButton = screen.getByText('Actualizar');
        expect(refreshButton).toBeInTheDocument();
      });

      // Check for proper semantic elements
      expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    });

    test('should have proper form labels', async () => {
      await act(async () => {
        render(<ShieldInterceptedList />);
      });

      await waitFor(() => {
        expect(screen.getByText('Período de tiempo')).toBeInTheDocument();
        expect(screen.getByText('Categoría')).toBeInTheDocument();
      });
    });
  });
});