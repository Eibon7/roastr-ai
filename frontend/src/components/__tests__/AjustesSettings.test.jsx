import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AjustesSettings from '../AjustesSettings';
import { apiClient } from '../../lib/api';

// Mock the apiClient
jest.mock('../../lib/api');

// Mock the notification function
const mockOnNotification = jest.fn();

describe('AjustesSettings Theme Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle undefined theme and options from API gracefully', async () => {
    // Mock API responses where theme/options are undefined
    apiClient.get.mockImplementation((url) => {
      if (url === '/user/settings/roastr-persona') {
        return Promise.resolve({
          data: { success: true, data: { bio: 'test bio' } }
        });
      }
      if (url === '/user/settings/theme') {
        return Promise.resolve({
          data: { 
            success: true, 
            data: { 
              theme: undefined, // This should not crash the component
              options: undefined // This should not crash the component
            } 
          }
        });
      }
      if (url === '/user/settings/transparency-mode') {
        return Promise.resolve({
          data: { success: true, data: { bio: 'transparency bio' } }
        });
      }
      return Promise.resolve({ data: { success: false } });
    });

    // Render the component
    const { container } = render(
      <AjustesSettings onNotification={mockOnNotification} />
    );

    // Wait for the component to load
    await waitFor(() => {
      // The component should not crash and should render without errors
      expect(container).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify no errors were thrown during rendering
    expect(mockOnNotification).not.toHaveBeenCalledWith(
      expect.stringContaining('Error'),
      'error'
    );
  });

  test('should handle API success with null theme and options', async () => {
    // Mock API responses where theme/options are null
    apiClient.get.mockImplementation((url) => {
      if (url === '/user/settings/roastr-persona') {
        return Promise.resolve({
          data: { success: true, data: { bio: 'test bio' } }
        });
      }
      if (url === '/user/settings/theme') {
        return Promise.resolve({
          data: { 
            success: true, 
            data: { 
              theme: null, // This should not crash the component
              options: null // This should not crash the component
            } 
          }
        });
      }
      if (url === '/user/settings/transparency-mode') {
        return Promise.resolve({
          data: { success: true, data: { bio: 'transparency bio' } }
        });
      }
      return Promise.resolve({ data: { success: false } });
    });

    // Render the component
    const { container } = render(
      <AjustesSettings onNotification={mockOnNotification} />
    );

    // Wait for the component to load
    await waitFor(() => {
      expect(container).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify no errors were thrown during rendering
    expect(mockOnNotification).not.toHaveBeenCalledWith(
      expect.stringContaining('Error'),
      'error'
    );
  });
});
