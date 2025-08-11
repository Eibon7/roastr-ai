import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import IntegrationsCard from '../IntegrationsCard';

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const MockIcon = (props) => <div data-testid="mock-icon" {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

describe('IntegrationsCard', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders loading state initially', () => {
    render(<IntegrationsCard />);
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton')).toHaveLength(4);
  });

  test('renders integrations data after successful API call', async () => {
    const mockIntegrations = [
      {
        name: 'twitter',
        displayName: 'Twitter',
        icon: '🐦',
        status: 'connected',
        username: 'testuser'
      },
      {
        name: 'youtube',
        displayName: 'YouTube',
        icon: '📺',
        status: 'connected',
        username: 'testchannel'
      },
      {
        name: 'instagram',
        displayName: 'Instagram',
        icon: '📷',
        status: 'disconnected',
        description: 'Connect your account'
      }
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntegrations,
    });

    render(<IntegrationsCard />);

    await waitFor(() => {
      expect(screen.getByText('2/3')).toBeInTheDocument();
      expect(screen.getByText('Twitter')).toBeInTheDocument();
      expect(screen.getByText('YouTube')).toBeInTheDocument();
      expect(screen.getByText('Instagram')).toBeInTheDocument();
      expect(screen.getAllByText('Connected')).toHaveLength(2);
      expect(screen.getByText('Available')).toBeInTheDocument();
    });
  });

  test('shows connected integrations section when there are connected platforms', async () => {
    const mockIntegrations = [
      {
        name: 'twitter',
        displayName: 'Twitter',
        icon: '🐦',
        status: 'connected'
      }
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntegrations,
    });

    render(<IntegrationsCard />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  test('shows available integrations section when there are disconnected platforms', async () => {
    const mockIntegrations = [
      {
        name: 'facebook',
        displayName: 'Facebook',
        icon: '📘',
        status: 'disconnected'
      }
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntegrations,
    });

    render(<IntegrationsCard />);

    await waitFor(() => {
      expect(screen.getByText('Available')).toBeInTheDocument();
    });
  });

  test('limits available integrations display to 3 items', async () => {
    const mockIntegrations = Array.from({ length: 6 }, (_, i) => ({
      name: `platform${i}`,
      displayName: `Platform ${i}`,
      icon: '📱',
      status: 'disconnected'
    }));

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntegrations,
    });

    render(<IntegrationsCard />);

    await waitFor(() => {
      expect(screen.getByText('+3 more available')).toBeInTheDocument();
    });
  });

  test('handles API error gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('API Error'));

    render(<IntegrationsCard />);

    await waitFor(() => {
      expect(screen.getByText('0/0')).toBeInTheDocument();
    });
  });

  test('calls integrations API endpoint on mount', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<IntegrationsCard />);

    expect(fetch).toHaveBeenCalledWith('/api/integrations');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});