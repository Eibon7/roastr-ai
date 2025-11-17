/**
 * Tests for AutoApprovalSettings Component
 * Issue #405
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutoApprovalSettings from '../AutoApprovalSettings';
import { AuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';

// Mock dependencies
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  organization_id: 'test-org-id'
};

const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true
};

const renderWithAuth = (component) => {
  return render(
    <AuthContext.Provider value={mockAuthContext}>
      {component}
    </AuthContext.Provider>
  );
};

describe('AutoApprovalSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    });

    renderWithAuth(<AutoApprovalSettings />);
    
    expect(screen.getByText(/Auto-Approval Settings/)).toBeInTheDocument();
  });

  it('loads and displays organization settings', async () => {
    const mockOrgData = {
      id: 'test-org-id',
      plan: 'pro',
      settings: {
        auto_approval: true,
        auto_publish: false,
        shield_enabled: true,
        max_toxicity_score: 0.7,
        require_security_validation: true
      }
    };

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockOrgData, error: null })
        })
      })
    });

    renderWithAuth(<AutoApprovalSettings />);

    await waitFor(() => {
      expect(screen.getByText('Pro Plan')).toBeInTheDocument();
      expect(screen.getByLabelText(/Enable Auto-Approval/)).toBeChecked();
      expect(screen.getByLabelText(/Enable Auto-Publish/)).not.toBeChecked();
      expect(screen.getByLabelText(/Require Security Validation/)).toBeChecked();
    });
  });

  it('shows plan limitation for starter_trial plan', async () => {
    const mockOrgData = {
      id: 'test-org-id',
      plan: 'starter_trial',
      settings: {
        auto_approval: false
      }
    };

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockOrgData, error: null })
        })
      })
    });

    renderWithAuth(<AutoApprovalSettings />);

    await waitFor(() => {
      expect(screen.getByText('Free Plan')).toBeInTheDocument();
      expect(screen.getByText(/Auto-approval is available for Starter, Pro, and Plus plans/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Enable Auto-Approval/)).toBeDisabled();
    });
  });

  it('toggles auto-approval setting', async () => {
    const mockOrgData = {
      id: 'test-org-id',
      plan: 'pro',
      settings: {
        auto_approval: false,
        auto_publish: false
      }
    };

    const updateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null })
    });

    supabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockOrgData, error: null })
          })
        })
      })
      .mockReturnValueOnce({
        update: updateMock
      });

    renderWithAuth(<AutoApprovalSettings />);

    await waitFor(() => {
      const toggle = screen.getByLabelText(/Enable Auto-Approval/);
      expect(toggle).not.toBeChecked();
      
      fireEvent.click(toggle);
    });

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        settings: expect.objectContaining({
          auto_approval: true,
          auto_publish: false
        }),
        updated_at: expect.any(String)
      });
    });
  });

  it('auto-enables auto-approval when enabling auto-publish', async () => {
    const mockOrgData = {
      id: 'test-org-id',
      plan: 'pro',
      settings: {
        auto_approval: false,
        auto_publish: false
      }
    };

    const updateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null })
    });

    supabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockOrgData, error: null })
          })
        })
      })
      .mockReturnValue({
        update: updateMock
      });

    renderWithAuth(<AutoApprovalSettings />);

    // Wait for initial load, then enable auto-approval first
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText(/Enable Auto-Approval/));
    });

    // Then enable auto-publish
    await waitFor(() => {
      fireEvent.click(screen.getByLabelText(/Enable Auto-Publish/));
    });

    await waitFor(() => {
      expect(updateMock).toHaveBeenLastCalledWith({
        settings: expect.objectContaining({
          auto_approval: true,
          auto_publish: true
        }),
        updated_at: expect.any(String)
      });
    });
  });

  it('displays rate limits when auto-approval is enabled', async () => {
    const mockOrgData = {
      id: 'test-org-id',
      plan: 'pro',
      settings: {
        auto_approval: true
      }
    };

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockOrgData, error: null })
        })
      })
    });

    renderWithAuth(<AutoApprovalSettings />);

    await waitFor(() => {
      expect(screen.getByText(/50 per hour/)).toBeInTheDocument();
      expect(screen.getByText(/200 per day/)).toBeInTheDocument();
    });
  });

  it('handles loading error gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ 
            data: null, 
            error: new Error('Database error') 
          })
        })
      })
    });

    renderWithAuth(<AutoApprovalSettings />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Error loading auto-approval settings:',
        expect.any(Error)
      );
    });

    consoleError.mockRestore();
  });
});