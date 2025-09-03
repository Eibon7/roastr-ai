import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';
import Register from '../Register';
import ResetPassword from '../ResetPassword';
import authService from '../../../services/authService';

// Mock the auth service
jest.mock('../../../services/authService', () => ({
  signIn: jest.fn(),
  register: jest.fn(),
  sendRecoveryEmail: jest.fn(),
}));

// Mock the auth context
const mockAuthContext = {
  isAuthenticated: false,
  user: null,
  loading: false,
};

jest.mock('../../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuthContext,
}));

const renderComponent = (Component, initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Component />
    </MemoryRouter>
  );
};

describe('Auth Navigation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthContext.isAuthenticated = false;
  });

  test('login component renders correctly', () => {
    renderComponent(Login);

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
  });

  test('register component renders correctly', () => {
    renderComponent(Register);

    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  test('reset password component renders correctly', () => {
    renderComponent(ResetPassword);

    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
  });

  test('all auth pages have consistent gradient styling', () => {
    // Test login page
    renderComponent(Login);
    const loginButton = screen.getByRole('button', { name: 'Log in' });
    expect(loginButton).toHaveClass('bg-gradient-to-r', 'from-red-500', 'to-orange-500');

    // Test register page
    renderComponent(Register);
    const registerButton = screen.getByRole('button', { name: 'Register' });
    expect(registerButton).toHaveClass('bg-gradient-to-r', 'from-red-500', 'to-orange-500');

    // Test reset password page
    renderComponent(ResetPassword);
    const resetButton = screen.getByRole('button', { name: 'Send reset link' });
    expect(resetButton).toHaveClass('bg-gradient-to-r', 'from-red-500', 'to-orange-500');
  });

  test('form validation works across all pages', () => {
    // Test login page
    renderComponent(Login);
    const loginUsernameInput = screen.getByLabelText('Username');
    const loginPasswordInput = screen.getByLabelText('Password');
    expect(loginUsernameInput).toHaveAttribute('required');
    expect(loginPasswordInput).toHaveAttribute('required');
    expect(loginUsernameInput).toHaveAttribute('type', 'email');

    // Test register page
    renderComponent(Register);
    const registerUsernameInput = screen.getByLabelText('Username');
    const registerPasswordInput = screen.getByLabelText('Password');
    expect(registerUsernameInput).toHaveAttribute('required');
    expect(registerPasswordInput).toHaveAttribute('required');
    expect(registerUsernameInput).toHaveAttribute('type', 'email');

    // Test reset password page
    renderComponent(ResetPassword);
    const resetEmailInput = screen.getByLabelText('Email address');
    expect(resetEmailInput).toHaveAttribute('required');
    expect(resetEmailInput).toHaveAttribute('type', 'email');
  });
});
