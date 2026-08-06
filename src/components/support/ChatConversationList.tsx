import { useMemo, useState } from "react";
import { formatDistanceToNowStrict, isToday } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { SupportConversation } from "@/lib/supportChat";
import { cn } from "@/lib/utils";

function iniciais(valor: string | null | undefined) {
  const limpo = (valor ?? "").trim();
  if (!limpo) return "?";
  const partes = limpo.split(/\s+/).slice(0, 2);
  return partes.map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Hora para hoje, distancia curta para o resto — o que a lista precisa e "quao recente". */
function quando(iso: string) {
  const data = new Date(iso);
  if (isToday(data)) return format(data, "HH:mm");
  return formatDistanceToNowStrict(data, { locale: ptBR, addSuffix: false });
}

/**
 * A coluna de conversas do atendimento.
 *
 * Mesma estrutura da referencia: busca no topo e uma fila de linhas com
 * iniciais, nome, previa da ultima mensagem e horario. A previa e o que permite
 * escolher de qual conversa cuidar sem abrir uma por uma.
 */
export function ChatConversationList({
  conversas,
  selecionadaId,
  onSelecionar,
  carregando = false,
}: {
  conversas: SupportConversation[];
  selecionadaId: string | null;
  onSelecionar: (conversa: SupportConversation) => void;
  carregando?: boolean;
}) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo
      ? conversas.filter((conversa) =>
          [conversa.customer_name, conversa.customer_company, conversa.customer_cnpj, conversa.subject]
            .some((campo) => (campo ?? "").toLowerCase().includes(termo)),
        )
      : conversas;

    // Quem escreveu vem antes de quem so passou pela tela.
    //
    // A conversa nasce quando o cliente abre a secao Mensagens, mesmo sem enviar
    // nada — entao a caixa se enche de linhas vazias que parecem atendimento
    // pendente. Elas continuam na lista (o admin pode querer puxar assunto), mas
    // atras de quem de fato mandou mensagem.
    const temMensagem = (conversa: SupportConversation) =>
      Boolean(conversa.last_message_preview?.trim());

    return [...base].sort((a, b) => {
      const diferenca = Number(temMensagem(b)) - Number(temMensagem(a));
      if (diferenca !== 0) return diferenca;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }, [busca, conversas]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar cliente..."
            aria-label="Buscar conversa"
            className="h-10 rounded-full pl-9"
          />
        </div>
      </div>

      {carregando ? (
        <div className="space-y-2 p-3">
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      ) : filtradas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {conversas.length === 0 ? "Nenhuma conversa ainda." : "Nada encontrado para essa busca."}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtradas.map((conversa) => {
            const ativa = conversa.id === selecionadaId;
            return (
              <button
                key={conversa.id}
                type="button"
                onClick={() => onSelecionar(conversa)}
                aria-current={ativa ? "true" : undefined}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors",
                  ativa ? "bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    ativa ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  {iniciais(conversa.customer_name)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {conversa.customer_name || "Cliente"}
                    </span>
                    <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                      {quando(conversa.last_message_at)}
                    </span>
                  </span>

                  {conversa.customer_company ? (
                    <span className="block truncate text-[0.6875rem] text-muted-foreground">
                      {conversa.customer_company}
                    </span>
                  ) : null}

                  <span
                    className={cn(
                      "mt-0.5 block truncate text-xs",
                      conversa.last_message_preview ? "text-muted-foreground" : "italic text-muted-foreground/60",
                    )}
                  >
                    {conversa.last_message_preview || "Ainda não escreveu"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
