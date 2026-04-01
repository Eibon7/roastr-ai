import { useRef, useState } from "react";

type ChatInputProps = {
  onSend?: (text: string) => void;
  loading?: boolean;
  placeholder?: string;
};

export function ChatInput({
  onSend,
  loading = false,
  placeholder = "Escribe un mensaje...",
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend?.(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    // Auto-resize textarea height
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  return (
    <div className="flex items-end gap-2 rounded-lg border border-input bg-background p-3">
      {/* Botón central: shrink-0 + self-start garantizan posición fija a la izquierda
          independientemente del estado (con texto, cargando, vacío). */}
      <button
        type="button"
        onClick={handleSend}
        disabled={!text.trim() || loading}
        aria-label="Enviar mensaje"
        className="shrink-0 self-start rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            <span>Enviando</span>
          </span>
        ) : (
          "Enviar"
        )}
      </button>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={loading}
        className="flex-1 resize-none overflow-hidden bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
