import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusCard } from '@/components/dashboard/StatusCard';

describe('StatusCard (migrated to shadcn)', () => {
  it('renders label and value', () => {
    render(<StatusCard label="Health Score" value={87} status="healthy" />);

    expect(screen.getByText('Health Score')).toBeInTheDocument();
    expect(screen.getByText('87.0')).toBeInTheDocument();
  });

  it('renders with max value', () => {
    render(<StatusCard label="Active Users" value={42} max={100} status="healthy" />);

    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('42/100')).toBeInTheDocument();
  });

  it('renders with unit', () => {
    render(<StatusCard label="CPU Usage" value={75.5} unit="%" status="warning" />);

    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('75.5')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('applies healthy status styling', () => {
    const { container } = render(<StatusCard label="Test" value={100} status="healthy" />);

    // Check for green color class
    const valueElement = screen.getByText('100.0');
    expect(valueElement).toHaveClass('text-green-500');
  });

  it('applies warning status styling', () => {
    const { container } = render(<StatusCard label="Test" value={50} status="warning" />);

    // Check for yellow color class
    const valueElement = screen.getByText('50.0');
    expect(valueElement).toHaveClass('text-yellow-500');
  });

  it('applies critical status styling', () => {
    const { container } = render(<StatusCard label="Test" value={10} status="critical" />);

    // Check for red color class
    const valueElement = screen.getByText('10.0');
    expect(valueElement).toHaveClass('text-red-500');
  });
});
