import { fireEvent, render, screen } from '@testing-library/react';
import { RoastrReply } from '../../../components/roastr/RoastrReply';

describe('RoastrReply', () => {
  it('renderiza el texto y ejecuta acciones', () => {
    const onCopy = jest.fn();
    const onSend = jest.fn();

    render(
      <RoastrReply
        title="Vista previa"
        reply="Respuesta generada"
        status="draft"
        toneLabel="Tono sarcástico"
        actions={<span>meta</span>}
        onCopy={onCopy}
        onSend={onSend}
      />
    );

    expect(screen.getByText('Respuesta generada')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/copiar/i));
    const publishButtons = screen.getAllByText(/publicar/i);
    fireEvent.click(publishButtons[publishButtons.length - 1]);
    expect(onCopy).toHaveBeenCalled();
    expect(onSend).toHaveBeenCalled();
  });
});

