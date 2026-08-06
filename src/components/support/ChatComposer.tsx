import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, SendHorizonal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Teto do campo antes de ele passar a rolar, em pixels. */
const ALTURA_MAXIMA = 160;

/**
 * A caixa de escrever.
 *
 * Segue o `ChatInput` da referencia: barra presa no rodape do fio, campo que
 * cresce com o texto, Enter envia e Shift+Enter quebra linha.
 *
 * O campo cresce por medicao, e nao com `rows` fixo: mensagem de tres linhas
 * numa caixa de uma linha esconde o que a pessoa acabou de escrever, que e
 * justamente quando ela quer reler antes de mandar.
 */
export function ChatComposer({
  onEnviar,
  desabilitado = false,
  placeholder = "Escreva sua mensagem...",
  onDigitando,
}: {
  onEnviar: (texto: string) => Promise<void> | void;
  desabilitado?: boolean;
  placeholder?: string;
  onDigitando?: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const ajustarAltura = useCallback(() => {
    const campo = campoRef.current;
    if (!campo) return;
    // Zera antes de medir: `scrollHeight` nunca encolhe sozinho, entao sem isto
    // o campo so cresceria, mesmo apagando o texto.
    campo.style.height = "auto";
    campo.style.height = `${Math.min(ALTURA_MAXIMA, campo.scrollHeight)}px`;
  }, []);

  const enviar = useCallback(async () => {
    const corpo = texto.trim();
    if (!corpo || enviando || desabilitado) return;

    setEnviando(true);
    try {
      await onEnviar(corpo);
      setTexto("");
      // Devolve o campo ao tamanho de uma linha depois de limpar.
      requestAnimationFrame(() => {
        if (campoRef.current) campoRef.current.style.height = "auto";
        campoRef.current?.focus();
      });
    } finally {
      setEnviando(false);
    }
  }, [desabilitado, enviando, onEnviar, texto]);

  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    // `isComposing` protege teclado com acento morto e IME: durante a composicao
    // o Enter confirma o caractere, e enviar ali cortaria a palavra pela metade.
    if (evento.key === "Enter" && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      void enviar();
    }
  };

  const podeEnviar = texto.trim().length > 0 && !enviando && !desabilitado;

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 py-3 sm:px-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={campoRef}
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            ajustarAltura();
            onDigitando?.();
          }}
          onKeyDown={aoTeclar}
          rows={1}
          disabled={desabilitado}
          placeholder={placeholder}
          aria-label="Mensagem"
          className={cn(
            "min-h-11 w-full flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />

        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          disabled={!podeEnviar}
          onClick={() => void enviar()}
          aria-label="Enviar mensagem"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
        </Button>
      </div>

      <p className="mt-1.5 hidden px-1 text-[0.625rem] text-muted-foreground sm:block">
        Enter envia · Shift + Enter quebra linha
      </p>
    </div>
  );
}
