import { render, screen } from '@testing-library/react';
import { RoastrComment } from '../../../components/roastr/RoastrComment';

describe('RoastrComment', () => {
  it('muestra autor, contenido y acciones', () => {
    const actionsText = 'Responder';
    render(
      <RoastrComment
        author="Jane Doe"
        handle="@janedoe"
        platform="Twitter"
        timestamp="hoy"
        content="Contenido de prueba"
        sentiment="negative"
        toxicityScore={0.92}
        tags={['spam']}
        actions={<span>{actionsText}</span>}
      />
    );

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Contenido de prueba')).toBeInTheDocument();
    expect(screen.getByText(actionsText)).toBeInTheDocument();
    expect(screen.getByText(/spam/i)).toBeInTheDocument();
  });
});
