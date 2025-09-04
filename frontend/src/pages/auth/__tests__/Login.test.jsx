import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock auth context
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    loading: false,
  }),
}));

// Mock auth service
jest.mock('../../../services/authService', () => ({
  signIn: jest.fn(),
  sendRecoveryEmail: jest.fn(),
}));

const Login = require('../Login').default;

const renderLogin = () => {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('Login Component', () => {
  test('renders login form correctly', () => {
    renderLogin();

    expect(screen.getByText('Roastr.AI')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Keep me logged in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  test('renders navigation link to register', () => {
    renderLogin();

    const registerLink = screen.getByRole('link', { name: 'I don\'t have an account' });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  test('has proper form validation attributes', () => {
    renderLogin();

    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');

    expect(usernameInput).toHaveAttribute('type', 'email');
    expect(usernameInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('required');
  });

  test('shows error and recovery action when sign-in fails', async () => {
    const { signIn } = require('../../../services/authService');
    signIn.mockResolvedValueOnce({ success: false, message: 'Invalid credentials' });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Username'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send recovery email' })).toBeInTheDocument();
  });

  test('sends recovery email and shows success UI', async () => {
    const { signIn, sendRecoveryEmail } = require('../../../services/authService');
    signIn.mockResolvedValueOnce({ success: false, message: 'Invalid credentials' });
    sendRecoveryEmail.mockResolvedValueOnce({ success: true });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Username'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send recovery email' }));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  test('requires email before sending recovery email', async () => {
    const { signIn } = require('../../../services/authService');
    signIn.mockResolvedValueOnce({ success: false, message: 'Invalid credentials' });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send recovery email' }));
    expect(await screen.findByText('Please enter your email address first')).toBeInTheDocument();
  });
});
