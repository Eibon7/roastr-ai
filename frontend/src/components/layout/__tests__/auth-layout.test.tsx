import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthLayout } from '../auth-layout';

describe('AuthLayout', () => {
  it('renders children content', () => {
    render(
      <AuthLayout title="Test Title">
        <div>Test Content</div>
      </AuthLayout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('displays the title', () => {
    render(
      <AuthLayout title="Login Page">
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders with default title', () => {
    render(
      <AuthLayout>
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.getByText('Roastr.ai')).toBeInTheDocument();
  });
});
