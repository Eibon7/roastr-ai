import { render, screen } from '@testing-library/react';
import { ShieldStatus } from '../../../components/roastr/ShieldStatus';

describe('ShieldStatus', () => {
  it('muestra severidad y porcentaje', () => {
    render(
      <ShieldStatus
        status="monitored"
        severity="high"
        score={0.76}
        actions={['mute']}
        lastActionAt="ayer"
      />
    );

    expect(screen.getByText(/Estado Shield/i)).toBeInTheDocument();
    expect(screen.getByText(/76%/i)).toBeInTheDocument();
    expect(screen.getByText(/mute/i)).toBeInTheDocument();
  });
});
