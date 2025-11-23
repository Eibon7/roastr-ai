import { render, screen } from '@testing-library/react';
import { PageLayout } from '../../../components/roastr/PageLayout';

describe('PageLayout', () => {
  it('renders title and children correctly', () => {
    render(
      <PageLayout title="Test Title">
        <div>Test Content</div>
      </PageLayout>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <PageLayout title="Test Title" subtitle="Test Subtitle">
        <div>Content</div>
      </PageLayout>
    );

    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <PageLayout title="Test Title" description="Test Description">
        <div>Content</div>
      </PageLayout>
    );

    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('renders metrics when provided', () => {
    const metrics = [
      { label: 'Metric 1', value: '100' },
      { label: 'Metric 2', value: '200', helper: 'Helper text' }
    ];

    render(
      <PageLayout title="Test Title" metrics={metrics}>
        <div>Content</div>
      </PageLayout>
    );

    expect(screen.getByText('Metric 1')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Metric 2')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Helper text')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <PageLayout title="Test Title" actions={<button>Action Button</button>}>
        <div>Content</div>
      </PageLayout>
    );

    expect(screen.getByText('Action Button')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageLayout title="Test Title" className="custom-class">
        <div>Content</div>
      </PageLayout>
    );

    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-class');
  });

  it('applies contentClassName to content wrapper', () => {
    const { container } = render(
      <PageLayout title="Test Title" contentClassName="content-custom">
        <div>Content</div>
      </PageLayout>
    );

    const contentDiv = container.querySelector('.content-custom');
    expect(contentDiv).toBeInTheDocument();
  });
});
