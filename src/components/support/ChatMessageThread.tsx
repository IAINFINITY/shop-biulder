import { useEffect, useRef, type ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare } from "lucide-react";

import type { SupportMessage } from "@/lib/supportChat";
import { cn } from "@/lib/utils";

/**
 * O fio de mensagens.
 *
 * Replica o chat de `pamela_crm`: mensagens agrupadas por dia com etiqueta
 * ("Hoje", "Ontem", "12 de ago"), balao a direita para quem escreve e a esquerda
 * para o outro lado, hora dentro do balao. O que existia aqui era uma lista
 * corrida sem separacao de dia — em conversa que dura semanas nao da para saber
 * se a resposta veio hoje ou em marco.
 *
 * Este chat e **interno**: cliente falando com consultor pela propria
 * plataforma. Por isso nao vem nada da referencia que era de WhatsApp — sem
 * recibo de entrega, sem encaminhamento, sem midia.
 */

// So http(s) e www. Nao aceitar esquema arbitrario e o que impede um
// `javascript:` ou `data:` escrito por um cliente virar link clicavel — o corpo
// da mensagem e texto de terceiro, nao conteudo nosso.
const URL_NO_TEXTO = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

// Pontuacao que costuma encostar no fim da URL na escrita normal ("veja
// https://x.com/y.") e nao faz parte dela.
const PONTUACAO_FINAL = /[.,;:!?)\]}>'"]+$/;

function separarPontuacaoFinal(bruto: string): [string, string] {
  let url = bruto;
  let cauda = "";

  for (;;) {
    const encontrado = url.match(PONTUACAO_FINAL);
    if (!encontrado) break;
    // ")" so sai se sobrar fechamento: com parenteses equilibrados ele pertence
    // a URL (caso classico: .../Laser_(dispositivo) ).
    if (encontrado[0] === ")" && (url.match(/\(/g)?.length ?? 0) >= (url.match(/\)/g)?.length ?? 0)) break;
    url = url.slice(0, -encontrado[0].length);
    cauda = encontrado[0] + cauda;
  }

  return [url, cauda];
}

/**
 * Transforma URLs do corpo em links clicaveis.
 *
 * Devolve nos React em vez de HTML: nada de `dangerouslySetInnerHTML` com texto
 * digitado por outra pessoa. `noopener` e obrigatorio — sem ele a pagina aberta
 * ganha acesso a `window.opener` e pode redirecionar esta aba.
 */
function Linkificado({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  let ultimoIndice = 0;

  for (const encontrado of texto.matchAll(URL_NO_TEXTO)) {
    const bruto = encontrado[0];
    const inicio = encontrado.index ?? 0;
    const [url, cauda] = separarPontuacaoFinal(bruto);
    if (!url) continue;

    if (inicio > ultimoIndice) partes.push(texto.slice(ultimoIndice, inicio));
    partes.push(
      <a
        key={`${inicio}-${url}`}
        href={url.startsWith("www.") ? `https://${url}` : url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all font-medium underline underline-offset-2 hover:text-primary"
      >
        {url}
      </a>,
    );
    if (cauda) partes.push(cauda);
    ultimoIndice = inicio + bruto.length;
  }

  if (ultimoIndice < texto.length) partes.push(texto.slice(ultimoIndice));
  return <>{partes}</>;
}

function agruparPorDia(mensagens: SupportMessage[]) {
  const grupos: { dia: string; mensagens: SupportMessage[] }[] = [];
  for (const mensagem of mensagens) {
    const dia = format(new Date(mensagem.created_at), "yyyy-MM-dd");
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === dia) ultimo.mensagens.push(mensagem);
    else grupos.push({ dia, mensagens: [mensagem] });
  }
  return grupos;
}

function rotuloDoDia(dia: string) {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const ontem = format(new Date(Date.now() - 86_400_000), "yyyy-MM-dd");
  if (dia === hoje) return "Hoje";
  if (dia === ontem) return "Ontem";
  return format(new Date(`${dia}T12:00:00`), "dd 'de' MMM", { locale: ptBR });
}

export function ChatMessageThread({
  mensagens,
  meuPapel,
  carregando = false,
  vazioTitulo = "Nenhuma mensagem ainda",
  vazioDescricao = "Escreva abaixo para começar a conversa.",
}: {
  mensagens: SupportMessage[];
  /** Define qual lado e "meu": o balao vai para a direita. */
  meuPapel: "customer" | "admin";
  carregando?: boolean;
  vazioTitulo?: string;
  vazioDescricao?: string;
}) {
  const rolagemRef = useRef<HTMLDivElement>(null);
  const ultimaId = mensagens[mensagens.length - 1]?.id ?? null;

  // Vai para o fim quando chega mensagem, nao a cada render: depender do array
  // inteiro faria a rolagem saltar em qualquer atualizacao do cache.
  useEffect(() => {
    const elemento = rolagemRef.current;
    if (elemento) elemento.scrollTop = elemento.scrollHeight;
  }, [ultimaId]);

  if (carregando) {
    return (
      <div className="flex-1 space-y-3 overflow-hidden p-4">
        <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-muted" />
        <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-muted" />
        <div className="h-20 w-3/5 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (mensagens.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
        <h3 className="text-lg font-medium text-muted-foreground">{vazioTitulo}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{vazioDescricao}</p>
      </div>
    );
  }

  return (
    <div ref={rolagemRef} className="min-h-0 flex-1 overflow-y-auto bg-background p-4">
      <div className="flex w-full flex-col gap-1">
        {agruparPorDia(mensagens).map((grupo) => (
          <div key={grupo.dia}>
            <div className="flex items-center justify-center py-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
                {rotuloDoDia(grupo.dia)}
              </span>
            </div>

            {grupo.mensagens.map((mensagem) => {
              const meu = mensagem.sender_role === meuPapel;
              return (
                <div key={mensagem.id} className={cn("flex", meu ? "justify-end" : "justify-start")}>
                  <div className="mb-1 max-w-[75%]">
                    <div
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-sm shadow-sm",
                        meu
                          ? "border-primary/20 bg-primary/10 text-foreground"
                          : "border-border bg-card text-foreground",
                      )}
                    >
                      {/* Quem falou so aparece no que vem do outro lado: repetir
                          o proprio nome em cada balao e ruido. */}
                      {!meu && mensagem.sender_user_name ? (
                        <p className="mb-1 text-[0.6875rem] font-semibold text-primary">
                          {mensagem.sender_user_name}
                        </p>
                      ) : null}

                      <p className="whitespace-pre-wrap break-words">
                        <Linkificado texto={mensagem.body} />
                      </p>

                      <div className="mt-1 flex items-center justify-end gap-1 text-muted-foreground">
                        <span className="text-[0.625rem]">
                          {format(new Date(mensagem.created_at), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
