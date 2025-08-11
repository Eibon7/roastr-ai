import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogsTableCard from '../LogsTableCard';

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const MockIcon = (props) => <div data-testid="mock-icon" {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

describe('LogsTableCard', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  const mockLogs = [
    {
      id: '1',
      timestamp: '2025-01-09T15:30:00Z',
      level: 'info',
      service: 'api',
      message: 'User logged in successfully'
    },
    {
      id: '2',
      timestamp: '2025-01-09T15:31:00Z',
      level: 'warn',
      service: 'integrations',
      message: 'Twitter API rate limit approaching'
    },
    {
      id: '3',
      timestamp: '2025-01-09T15:32:00Z',
      level: 'error',
      service: 'roast-generator',
      message: 'OpenAI API call failed with timeout'
    }
  ];

  test('renders loading state initially', () => {
    render(<LogsTableCard />);
    expect(screen.getByText('System Logs')).toBeInTheDocument();
    // Check for skeleton loading elements by class
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  test('renders logs data after successful API call', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLogs,
    });

    render(<LogsTableCard />);

    await waitFor(() => {
      expect(screen.getByText('3 entries')).toBeInTheDocument();
      expect(screen.getByText('User logged in successfully')).toBeInTheDocument();
      expect(screen.getByText('Twitter API rate limit approaching')).toBeInTheDocument();
      expect(screen.getByText('OpenAI API call failed with timeout')).toBeInTheDocument();
    });
  });

  test('filters logs by level', async () => {
    const user = userEvent.setup();
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLogs,
    });

    render(<LogsTableCard />);

    await waitFor(() => {
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });

    // Click on the filter dropdown by finding the button trigger
    const filterTrigger = screen.getAllByRole('button').find(btn => 
      btn.textContent.includes('All Levels') || btn.className.includes('SelectTrigger')
    ) || screen.getAllByRole('button')[1]; // Fallback to second button if not found
    await user.click(filterTrigger);

    // Wait for dropdown to open and select 'error' filter
    await waitFor(() => {
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });
    
    const errorOption = screen.getByText('Errors');
    await user.click(errorOption);

    await waitFor(() => {
      expect(screen.getByText('1 entries')).toBeInTheDocument();
      expect(screen.getByText('OpenAI API call failed with timeout')).toBeInTheDocument();
      expect(screen.queryByText('User logged in successfully')).not.toBeInTheDocument();
    });
  });

  test('filters logs by search term', async () => {
    const user = userEvent.setup();
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLogs,
    });

    render(<LogsTableCard />);

    await waitFor(() => {
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search logs...');
    await user.type(searchInput, 'Twitter');

    await waitFor(() => {
      expect(screen.getByText('1 entries')).toBeInTheDocument();
      expect(screen.getByText('Twitter API rate limit approaching')).toBeInTheDocument();
      expect(screen.queryByText('User logged in successfully')).not.toBeInTheDocument();
    });
  });

  test('combines level filter and search term', async () => {
    const user = userEvent.setup();
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLogs,
    });

    render(<LogsTableCard />);

    await waitFor(() => {
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });

    // Set search term
    const searchInput = screen.getByPlaceholderText('Search logs...');
    await user.type(searchInput, 'API');

    // Wait for search to filter
    await waitFor(() => {
      expect(screen.getByText('2 entries')).toBeInTheDocument();
    });

    // Set level filter to 'error'
    const filterTrigger = screen.getAllByRole('button').find(btn => 
      btn.textContent.includes('All Levels') || btn.className.includes('SelectTrigger')
    ) || screen.getAllByRole('button')[1]; // Fallback to second button if not found
    await user.click(filterTrigger);

    await waitFor(() => {
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });
    
    const errorOption = screen.getByText('Errors');
    await user.click(errorOption);

    await waitFor(() => {
      expect(screen.getByText('1 entries')).toBeInTheDocument();
      expect(screen.getByText('OpenAI API call failed with timeout')).toBeInTheDocument();
    });
  });

  test('shows empty state when no logs match filters', async () => {
    const user = userEvent.setup();
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLogs,
    });

    render(<LogsTableCard />);

    await waitFor(() => {
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search logs...');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('0 entries')).toBeInTheDocument();
      expect(screen.getByText('No logs match your filters')).toBeInTheDocument();
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });
  });

  test('clears filters when clear button is clicked', async () => {
    const user = userEvent.setup();
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLogs,
    });

    render(<LogsTableCard />);

    await waitFor(() => {
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });

    // Apply search filter
    const searchInput = screen.getByPlaceholderText('Search logs...');
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No logs match your filters')).toBeInTheDocument();
    });

    // Click clear filters
    const clearButton = screen.getByText('Clear filters');
    await user.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('3 entries')).toBeInTheDocument();
      expect(searchInput.value).toBe('');
    });
  });

  test('displays correct badge variants for log levels', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockLogs,
    });

    render(<LogsTableCard />);

    await waitFor(() => {
      expect(screen.getByText('info')).toBeInTheDocument();
      expect(screen.getByText('warn')).toBeInTheDocument();
      expect(screen.getByText('error')).toBeInTheDocument();
    });
  });

  test('shows pagination info when more than 25 logs', async () => {
    const manyLogs = Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      timestamp: '2025-01-09T15:30:00Z',
      level: 'info',
      service: 'test',
      message: `Log entry ${i + 1}`
    }));

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => manyLogs,
    });

    render(<LogsTableCard />);

    await waitFor(() => {
      expect(screen.getByText('Showing 25 of 30 entries')).toBeInTheDocument();
    });
  });

  test('calls logs API with correct parameters', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<LogsTableCard />);

    expect(fetch).toHaveBeenCalledWith('/api/logs?limit=50');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('handles API error gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('API Error'));

    render(<LogsTableCard />);

    await waitFor(() => {
      expect(screen.getByText('0 entries')).toBeInTheDocument();
    });
  });
});