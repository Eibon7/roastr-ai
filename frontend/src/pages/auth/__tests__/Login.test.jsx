import React from 'react';
import { render, screen } from '@testing-library/react';

// Simple mock for router
const MockRouter = ({ children }) => <div>{children}</div>;
const MockLink = ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>;

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: MockLink,
}));

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
    <MockRouter>
      <Login />
    </MockRouter>
  );
};

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
});
