import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Compose from '../Compose';

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const MockIcon = (props) => <div data-testid="mock-icon" {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

describe('Compose', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders compose page header', () => {
    render(<Compose />);

    expect(screen.getByRole('heading', { name: /compose roast/i })).toBeInTheDocument();
    expect(
      screen.getByText('Generate and send AI-powered roasts to your social media platforms')
    ).toBeInTheDocument();
  });

  test('renders input form elements', () => {
    render(<Compose />);

    expect(screen.getByLabelText(/message to roast/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter the message you want to generate a roast for/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate preview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
  });

  test('updates character count as user types', async () => {
    const user = userEvent.setup();
    render(<Compose />);

    const textarea = screen.getByLabelText(/message to roast/i);

    expect(screen.getByText('0/500 characters')).toBeInTheDocument();

    await user.type(textarea, 'Hello world');

    expect(screen.getByText('11/500 characters')).toBeInTheDocument();
  });

  test('disables generate preview button when message is empty', () => {
    render(<Compose />);

    const generateButton = screen.getByRole('button', { name: /generate preview/i });
    expect(generateButton).toBeDisabled();
  });

  test('enables generate preview button when message is entered', async () => {
    const user = userEvent.setup();
    render(<Compose />);

    const textarea = screen.getByLabelText(/message to roast/i);
    const generateButton = screen.getByRole('button', { name: /generate preview/i });

    await user.type(textarea, 'Test message');

    expect(generateButton).toBeEnabled();
  });

  test('generates roast preview on button click', async () => {
    const user = userEvent.setup();

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roast: 'This is a generated roast response' })
    });

    render(<Compose />);

    const textarea = screen.getByLabelText(/message to roast/i);
    const generateButton = screen.getByRole('button', { name: /generate preview/i });

    await user.type(textarea, 'Test message for roasting');
    await user.click(generateButton);

    expect(fetch).toHaveBeenCalledWith('/api/roast/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Test message for roasting' })
    });

    await waitFor(() => {
      expect(screen.getByText('This is a generated roast response')).toBeInTheDocument();
      expect(screen.getByText('Ready to send')).toBeInTheDocument();
    });
  });

  test('shows loading state during preview generation', async () => {
    const user = userEvent.setup();

    // Mock a delayed response
    fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ roast: 'Generated roast' })
              }),
            100
          );
        })
    );

    render(<Compose />);

    const textarea = screen.getByLabelText(/message to roast/i);
    const generateButton = screen.getByRole('button', { name: /generate preview/i });

    await user.type(textarea, 'Test message');
    await user.click(generateButton);

    // Should show loading spinner
    expect(screen.getByRole('button', { name: /generate preview/i })).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Generated roast')).toBeInTheDocument();
    });
  });

  test('shows platform selection after generating preview', async () => {
    const user = userEvent.setup();

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roast: 'Generated roast' })
    });

    render(<Compose />);

    const textarea = screen.getByLabelText(/message to roast/i);
    const generateButton = screen.getByRole('button', { name: /generate preview/i });

    await user.type(textarea, 'Test message');
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('Send to platforms:')).toBeInTheDocument();
      expect(screen.getByText('🐦 Twitter')).toBeInTheDocument();
      expect(screen.getByText('📘 Facebook')).toBeInTheDocument();
      expect(screen.getByText('📷 Instagram')).toBeInTheDocument();
    });
  });

  test('enables send button after generating preview', async () => {
    const user = userEvent.setup();

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roast: 'Generated roast' })
    });

    render(<Compose />);

    const textarea = screen.getByLabelText(/message to roast/i);
    const generateButton = screen.getByRole('button', { name: /generate preview/i });

    await user.type(textarea, 'Test message');
    await user.click(generateButton);

    await waitFor(() => {
      const sendButton = screen.getByRole('button', { name: /send roast/i });
      expect(sendButton).toBeEnabled();
    });
  });

  test('clears form after sending roast', async () => {
    const user = userEvent.setup();

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ roast: 'Generated roast' })
    });

    render(<Compose />);

    const textarea = screen.getByLabelText(/message to roast/i);
    const generateButton = screen.getByRole('button', { name: /generate preview/i });

    await user.type(textarea, 'Test message');
    await user.click(generateButton);

    await waitFor(() => {
      const sendButton = screen.getByRole('button', { name: /send roast/i });
      expect(sendButton).toBeEnabled();
    });

    const sendButton = screen.getByRole('button', { name: /send roast/i });
    await user.click(sendButton);

    await waitFor(() => {
      expect(textarea).toHaveValue('');
      expect(screen.queryByText('Generated roast')).not.toBeInTheDocument();
    });
  });

  test('shows empty state when no preview is generated', () => {
    render(<Compose />);

    expect(screen.getByText('Generate a preview to see your roast')).toBeInTheDocument();
  });

  test('renders recent roasts section', () => {
    render(<Compose />);

    expect(screen.getByText('Recent Roasts')).toBeInTheDocument();
    expect(screen.getByText('Mock roast response #1')).toBeInTheDocument();
    expect(screen.getByText('Mock roast response #2')).toBeInTheDocument();
    expect(screen.getByText('Mock roast response #3')).toBeInTheDocument();
  });

  test('handles API error during preview generation', async () => {
    const user = userEvent.setup();

    fetch.mockRejectedValueOnce(new Error('API Error'));

    render(<Compose />);

    const textarea = screen.getByLabelText(/message to roast/i);
    const generateButton = screen.getByRole('button', { name: /generate preview/i });

    await user.type(textarea, 'Test message');
    await user.click(generateButton);

    await waitFor(() => {
      // Should stop loading and not show any preview
      expect(generateButton).toBeEnabled();
      expect(screen.queryByText('Ready to send')).not.toBeInTheDocument();
    });
  });

  test('respects character limit', async () => {
    const user = userEvent.setup();
    render(<Compose />);

    const textarea = screen.getByLabelText(/message to roast/i);
    const longMessage = 'a'.repeat(501);

    // Simulate typing beyond limit (browser would typically prevent this)
    fireEvent.change(textarea, { target: { value: longMessage } });

    expect(textarea.value).toHaveLength(501);
    expect(screen.getByText('501/500 characters')).toBeInTheDocument();
  });
});
