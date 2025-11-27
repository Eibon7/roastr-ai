import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AccountSettingsForm from '../AccountSettingsForm';
import { useAuth } from '../../../contexts/AuthContext';
import { apiClient } from '../../../lib/api';
import { toast } from 'sonner';

// Mocks
jest.mock('../../../contexts/AuthContext');
jest.mock('../../../lib/api');
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

describe('AccountSettingsForm', () => {
  const mockUser = {
    email: 'test@example.com',
    id: 'user-123'
  };

  beforeEach(() => {
    useAuth.mockReturnValue({
      userData: mockUser
    });
    apiClient.post = jest.fn().mockResolvedValue({});
  });

  it('renders email address (read-only)', () => {
    render(
      <BrowserRouter>
        <AccountSettingsForm />
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveValue('test@example.com');
    expect(emailInput).toBeDisabled();
  });

  it('renders password change form', () => {
    render(
      <BrowserRouter>
        <AccountSettingsForm />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByText(/change password/i)).toBeInTheDocument();
  });

  it('renders GDPR data export button', () => {
    render(
      <BrowserRouter>
        <AccountSettingsForm />
      </BrowserRouter>
    );

    expect(screen.getByText(/request data export/i)).toBeInTheDocument();
  });

  it('renders account deletion section', () => {
    render(
      <BrowserRouter>
        <AccountSettingsForm />
      </BrowserRouter>
    );

    expect(screen.getByText(/delete account/i)).toBeInTheDocument();
  });

  it('validates password requirements', async () => {
    render(
      <BrowserRouter>
        <AccountSettingsForm />
      </BrowserRouter>
    );

    const newPasswordInput = screen.getByLabelText(/new password/i);
    fireEvent.change(newPasswordInput, { target: { value: 'weak' } });

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('handles password change successfully', async () => {
    apiClient.post.mockResolvedValue({});

    render(
      <BrowserRouter>
        <AccountSettingsForm />
      </BrowserRouter>
    );

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);
    const changeButton = screen.getByText(/change password/i);

    fireEvent.change(currentPasswordInput, { target: { value: 'CurrentPass123!' } });
    fireEvent.change(newPasswordInput, { target: { value: 'NewPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123!' } });

    fireEvent.click(changeButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'CurrentPass123!',
        newPassword: 'NewPass123!'
      });
      expect(toast.success).toHaveBeenCalledWith('Password changed successfully');
    });
  });

  it('handles data export', async () => {
    apiClient.post.mockResolvedValue({});

    render(
      <BrowserRouter>
        <AccountSettingsForm />
      </BrowserRouter>
    );

    const exportButton = screen.getByText(/request data export/i);
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/auth/export-data');
      expect(toast.success).toHaveBeenCalled();
    });
  });
});

