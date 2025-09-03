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
  register: jest.fn(),
}));

const Register = require('../Register').default;

const renderRegister = () => {
  return render(
    <MockRouter>
      <Register />
    </MockRouter>
  );
};

describe('Register Component', () => {
  test('renders registration form correctly', () => {
    renderRegister();

    expect(screen.getByText('Roastr.AI')).toBeInTheDocument();
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  test('renders navigation link to login', () => {
    renderRegister();

    const loginLink = screen.getByRole('link', { name: 'Sign in' });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  test('displays benefits section', () => {
    renderRegister();

    expect(screen.getByText('Why join Roastr.ai?')).toBeInTheDocument();
    expect(screen.getByText('Generate intelligent roasts automatically')).toBeInTheDocument();
    expect(screen.getByText('Connect multiple social media accounts')).toBeInTheDocument();
    expect(screen.getByText('Advanced moderation with Shield')).toBeInTheDocument();
    expect(screen.getByText('Free plan with 100 responses/month')).toBeInTheDocument();
  });

  test('has proper form validation attributes', () => {
    renderRegister();

    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');

    expect(usernameInput).toHaveAttribute('type', 'email');
    expect(usernameInput).toHaveAttribute('required');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('required');
  });
});
