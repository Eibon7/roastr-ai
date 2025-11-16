import { render, screen } from '@testing-library/react';
import SettingsSection from '../../../components/roastr/SettingsSection';

describe('SettingsSection', () => {
  it('renderiza título, descripción y contenido', () => {
    render(
      <SettingsSection
        title="Sección"
        description="Descripción breve"
        actions={<button type="button">Acción</button>}
        footer={<span>Notas</span>}
      >
        <p>Contenido interno</p>
      </SettingsSection>
    );

    expect(screen.getByText('Sección')).toBeInTheDocument();
    expect(screen.getByText('Descripción breve')).toBeInTheDocument();
    expect(screen.getByText('Contenido interno')).toBeInTheDocument();
    expect(screen.getByText('Acción')).toBeInTheDocument();
  });
});

