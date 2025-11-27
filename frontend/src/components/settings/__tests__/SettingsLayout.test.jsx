import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import SettingsLayout from '../SettingsLayout';

// Mock Outlet
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Outlet: () => <div data-testid="outlet">Outlet Content</div>
}));

describe('SettingsLayout', () => {
  it('renders header with title and description', () => {
    render(
      <BrowserRouter>
        <SettingsLayout />
      </BrowserRouter>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage your account, preferences, and billing')).toBeInTheDocument();
  });

  it('renders all three tabs', () => {
    render(
      <BrowserRouter>
        <SettingsLayout />
      </BrowserRouter>
    );

    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('redirects /app/settings to /app/settings/account', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/app/settings']}>
        <SettingsLayout />
      </MemoryRouter>
    );

    // Should redirect to account
    expect(window.location.pathname).toBe('/app/settings/account');
  });

  it('extracts active tab from URL path', () => {
    render(
      <MemoryRouter initialEntries={['/app/settings/preferences']}>
        <SettingsLayout />
      </MemoryRouter>
    );

    // Preferences tab should be active
    const preferencesTab = screen.getByText('Preferences').closest('button');
    expect(preferencesTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders Outlet for child routes', () => {
    render(
      <BrowserRouter>
        <SettingsLayout />
      </BrowserRouter>
    );

    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });
});
