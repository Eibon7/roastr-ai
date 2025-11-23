import { render, screen } from '@testing-library/react';
import UsageMeter from '../../../components/roastr/UsageMeter';

describe('UsageMeter', () => {
  it('muestra valores utilizados y restantes', () => {
    render(
      <UsageMeter
        title="Análisis"
        used={25}
        limit={100}
        unit="análisis"
        badge="PRO"
        trend="up"
        tone="analysis"
      />
    );

    expect(screen.getAllByText(/Análisis/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText('25')[0]).toBeInTheDocument();
    expect(screen.getByText(/Restantes: 75 análisis/i)).toBeInTheDocument();
  });
});
