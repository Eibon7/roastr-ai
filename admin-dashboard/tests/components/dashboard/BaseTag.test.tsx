import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseTag } from '@/components/dashboard/BaseTag';

describe('BaseTag (migrated to shadcn Badge)', () => {
  it('renders label', () => {
    render(
      <BaseTag
        label="CRITICAL"
        color="#FF0000"
      />
    );
    
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('applies custom color', () => {
    render(
      <BaseTag
        label="TEST"
        color="#00FF00"
      />
    );
    
    const badge = screen.getByText('TEST');
    expect(badge).toHaveStyle({ borderColor: '#00FF00' });
    expect(badge).toHaveStyle({ backgroundColor: '#00FF00' });
  });

  it('applies transparent background when isTransparent is true', () => {
    render(
      <BaseTag
        label="TRANSPARENT"
        color="#0000FF"
        isTransparent={true}
      />
    );
    
    const badge = screen.getByText('TRANSPARENT');
    // Transparent background should be set
    expect(badge).toHaveStyle({ borderColor: '#0000FF' });
    expect(badge).toHaveStyle({ color: '#0000FF' }); // Text color should match border when transparent
  });

  it('applies custom text color', () => {
    render(
      <BaseTag
        label="CUSTOM TEXT"
        color="#FF0000"
        textColor="#FFFFFF"
      />
    );
    
    const badge = screen.getByText('CUSTOM TEXT');
    expect(badge).toHaveStyle({ color: '#FFFFFF' });
  });

  it('applies title attribute', () => {
    render(
      <BaseTag
        label="TEST"
        color="#000000"
        title="Test tooltip"
      />
    );
    
    const badge = screen.getByText('TEST');
    expect(badge).toHaveAttribute('title', 'Test tooltip');
  });

  it('applies default title if not provided', () => {
    render(
      <BaseTag
        label="DEFAULT"
        color="#000000"
      />
    );
    
    const badge = screen.getByText('DEFAULT');
    expect(badge).toHaveAttribute('title', 'DEFAULT');
  });
});

