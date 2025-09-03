import React from 'react';
import { render, screen } from '@testing-library/react';

// Simple mock for router
const MockRouter = ({ children }) => <div>{children}</div>;
const MockLink = ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>;

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  Link: MockLink,
}));

// Mock auth service
jest.mock('../../../services/authService', () => ({
  sendRecoveryEmail: jest.fn(),
}));

const ResetPassword = require('../ResetPassword').default;

const renderResetPassword = () => {
  return render(
    <MockRouter>
      <ResetPassword />
    </MockRouter>
  );
};

describe('ResetPassword Component', () => {
  test('renders reset password form correctly', () => {
    renderResetPassword();

    expect(screen.getByText('Roastr.AI')).toBeInTheDocument();
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
  });

  test('renders navigation links', () => {
    renderResetPassword();

    const loginLink = screen.getByRole('link', { name: '← Back to login' });
    const registerLink = screen.getByRole('link', { name: 'Sign up' });

    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  test('displays help section', () => {
    renderResetPassword();

    expect(screen.getByText('Need help?')).toBeInTheDocument();
    expect(screen.getByText(/If you're having trouble resetting your password/)).toBeInTheDocument();

    const supportLink = screen.getByRole('link', { name: 'support@roastr.ai' });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute('href', 'mailto:support@roastr.ai');
  });

  test('has proper form validation attributes', () => {
    renderResetPassword();

    const emailInput = screen.getByLabelText('Email address');

    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('required');
  });
});
