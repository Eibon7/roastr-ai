import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm } from '../auth-form';

describe('AuthForm', () => {
  it('renders form with children', () => {
    render(
      <AuthForm>
        <input type="text" />
      </AuthForm>
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays error message when error prop is provided', () => {
    render(
      <AuthForm error="Invalid credentials">
        <input type="text" />
      </AuthForm>
    );

    const errorElement = screen.getByRole('alert');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveTextContent('Invalid credentials');
  });

  it('does not display error message when error is null', () => {
    render(
      <AuthForm error={null}>
        <input type="text" />
      </AuthForm>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles form submission', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    const user = userEvent.setup();
    render(
      <AuthForm onSubmit={handleSubmit}>
        <button type="submit">Submit</button>
      </AuthForm>
    );

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(
      <AuthForm ref={ref}>
        <input type="text" />
      </AuthForm>
    );

    expect(ref).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <AuthForm className="custom-class">
        <input type="text" />
      </AuthForm>
    );

    const form = screen.getByRole('textbox').closest('form');
    expect(form).toHaveClass('custom-class');
  });

  it('passes through form props', () => {
    render(
      <AuthForm action="/submit" method="post">
        <input type="text" />
      </AuthForm>
    );

    const form = screen.getByRole('textbox').closest('form');
    expect(form).toHaveAttribute('action', '/submit');
    expect(form).toHaveAttribute('method', 'post');
  });
});


