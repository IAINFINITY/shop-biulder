import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict, isToday } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, MessageSquare, Search, X } from "lucide-react";

import {
  contarPorEstado,
  duracaoCurta,
  estadoDaConversa,
  horasEsperando,
  iniciaisDoCliente,
  organizarCaixa,
  ROTULO_DO_FILTRO,
  urgenciaDaEspera,
  type FiltroDaCaixa,
} from "@/lib/caixaDeMensagens";
import type { SupportConversation } from "@/lib/supportChat";
import { cn } from "@/lib/utils";

/** Hora para hoje, distancia curta para o resto — o que a lista precisa e "quao recente". */
function quando(iso: string) {
  const data = new Date(iso);
  if (isToday(data)) return format(data, "HH:mm");
  return formatDistanceToNowStrict(data, { locale: ptBR, addSuffix: false });
}

/**
 * Ha quanto tempo espera, e quao atrasada esta a resposta.
 *
 * ⚠️ Um chip de 10px na mesma linha da previa, e nao uma faixa propria: com
 * 967 conversas na tela da referencia, cada linha extra custa uma conversa a
 * menos visivel. A cor carrega a urgencia; o texto carrega o numero.
 *
 * O vermelho e reservado para o dia inteiro sem resposta. A referencia avisa —
 * e tem razao — que pintar tudo de vermelho treina a equipe a ignorar a cor.
 */
function MarcaDeEspera({ conversa }: { conversa: SupportConversation }) {
  const urgencia = urgenciaDaEspera(conversa);
  if (!urgencia) return null;

  const horas = horasEsperando(conversa);
  const cor =
    urgencia === "urgente"
      ? "bg-destructive/10 text-destructive"
      : urgencia === "atencao"
        ? // `text-warm`, e nao `text-warm-foreground`: o *-foreground e branco,
          // feito para ficar SOBRE o warm solido. Aqui o fundo e o warm a 15%,
          // entao a letra branca sumiria.
          "bg-warm/15 text-warm"
        : "bg-primary/10 text-primary";

  return (
    <span
      title={`O cliente está aguardando resposta${horas != null ? ` há ${duracaoCurta(horas)}` : ""}`}
      className={cn("flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold", cor)}
    >
      <Clock className="h-3 w-3" />
      {horas != null ? duracaoCurta(horas) : null}
    </span>
  );
}

/**
 * As abas da caixa, na ordem em que se le.
 *
 * "Todas" primeiro porque e o conjunto, e as outras sao recortes dele — ler
 * "Esperando · Todas" sugere que Todas e mais um recorte ao lado do primeiro.
 * A aba que **abre** continua sendo Esperando quando ha fila; ordem e abertura
 * sao decisoes separadas.
 *
 * `sem_mensagem` fica de fora: nao e trabalho, e ruido.
 */
const ABAS: FiltroDaCaixa[] = ["todas", "esperando", "respondida", "finalizada"];

/**
 * A coluna de conversas do atendimento.
 *
 * ## O que mudou em 31/08/2026
 *
 * A lista era so busca e ordem de data: um cliente que escreveu e ficou sem
 * resposta tinha a mesma aparencia de um ja atendido. Agora **quem espera vem
 * primeiro**, com ha quanto tempo espera e a cor do atraso, e a aba "Esperando"
 * abre sozinha quando ha fila.
 *
 * ## Densidade
 *
 * O respiro veio do CRM de referencia: icone **fora** do campo de busca e campo
 * sem moldura, `divide-y` no lugar de borda por item.
 *
 * ⚠️ **A linha nao copia o `py-2.5` de la.** A linha da referencia tem duas
 * linhas de texto (nome+hora, previa); esta tem tres, porque num B2B a empresa
 * e a identidade do cliente e nao da para omitir. Copiar o padding sem copiar a
 * contagem de linhas foi exatamente o que deixou tudo grudado — mesma altura,
 * 50% mais conteudo. Dai `py-3` e `space-y-1` entre as linhas.
 *
 * O criterio de "esperando" esta em `caixaDeMensagens.ts`, com o porque de nao
 * ser lido/nao lido.
 */
export function ChatConversationList({
  conversas,
  selecionadaId,
  onSelecionar,
  carregando = false,
  acaoNovaConversa,
}: {
  conversas: SupportConversation[];
  selecionadaId: string | null;
  onSelecionar: (conversa: SupportConversation) => void;
  carregando?: boolean;
  /** O botao de comecar uma conversa. Vem de fora porque so o admin tem. */
  acaoNovaConversa?: React.ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const campoDeBusca = useRef<HTMLInputElement | null>(null);
  const contagem = useMemo(() => contarPorEstado(conversas), [conversas]);

  // Abre na fila quando ha fila. Entrar em "Todas" com tres pessoas esperando
  // obriga a procurar o que a tela ja sabe — e a aba lembra da escolha depois,
  // porque quem trocou de aba trocou por um motivo.
  const [filtroEscolhido, setFiltroEscolhido] = useState<FiltroDaCaixa | null>(null);
  const filtro = filtroEscolhido ?? (contagem.esperando > 0 ? "esperando" : "todas");

  const filtradas = useMemo(() => organizarCaixa(conversas, { filtro, busca }), [conversas, filtro, busca]);

  // "/" cai no campo de busca, como em toda ferramenta que se usa o dia todo.
  // O guarda de `tagName` existe para nao roubar a barra de quem esta digitando
  // uma mensagem — que e o campo ao lado.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement | null;
      const digitando = alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || alvo?.isContentEditable;
      if (evento.key === "/" && !digitando) {
        evento.preventDefault();
        campoDeBusca.current?.focus();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card text-foreground">
      {/* ⚠️ **A zona de controles é `bg-muted/40`; a lista é branca.**

          A referência separa as faixas com `bg-background` no cabeçalho e
          `bg-card` na lista. Copiar isso aqui não separaria nada: neste projeto
          `--background` e `--card` são **a mesma cor** (`0 0% 100%`, branco
          puro). Era por isso que busca, abas e lista viravam uma massa só — três
          fios de 1px sobre branco não são separação, são sugestão de separação.

          `muted` (220 14% 95%) é o cinza que o projeto já usa para "isto é
          controle, não é conteúdo", e a mudança de tom faz o trabalho que a
          borda sozinha não fazia. */}
      <div className="shrink-0 border-b border-border bg-muted/40">
        {/* Faixa 1: o que é esta coluna, e o gesto de começar do zero.
            "Nova conversa" estava espremida ao lado do X da busca, onde ninguém
            procura por ela — é um gesto de criação, e criação mora no topo. */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
          <span className="truncate text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Conversas
          </span>
          {acaoNovaConversa}
        </div>

        {/* Faixa 2: busca. Ícone fora do campo e campo sem moldura — dentro de
            uma faixa que já é uma caixa, mais uma borda só repete a linha. */}
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={campoDeBusca}
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Escape") {
                setBusca("");
                evento.currentTarget.blur();
              }
            }}
            placeholder="Buscar cliente, CNPJ ou assunto…"
            aria-label="Buscar conversa"
            className="h-7 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                campoDeBusca.current?.focus();
              }}
              aria-label="Limpar busca"
              className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Faixa 3: pílulas, e a ativa é preenchida.
            Cheguei a trocar por abas sublinhadas para elas pesarem menos que a
            lista. Foi longe demais: sem o círculo em volta, a aba escolhida
            virava só um texto de cor diferente, e não dava para saber onde se
            estava sem procurar. Numa barra de filtro, saber o filtro ativo é a
            função — o peso visual é o preço, não o defeito. */}
        {/* ⚠️ Rola na horizontal; **nao quebra linha, e a barra fica a vista**.
            Com `flex-wrap`, a lista estreita jogava "Finalizadas" para uma
            segunda linha e a faixa mudava de altura conforme a largura
            arrastada — a lista inteira pulava para baixo no meio do gesto.

            Cheguei a esconder a barra de rolagem daqui por achar que ela
            custava mais altura do que valia. Custa mesmo, e vale assim: ela e
            **o unico aviso de que ha filtro fora da tela**. Sem ela, quem tem a
            coluna estreita nunca descobre que "Finalizadas" existe — o corte da
            ultima pilula sozinho nao se le como "tem mais coisa aqui". E o que
            a referencia faz: `overflow-x-auto` e nada por cima. */}
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {ABAS.map((aba) => {
            const ativa = aba === filtro;
            const total = contagem[aba];
            const urgente = aba === "esperando" && total > 0;

            return (
              <button
                key={aba}
                type="button"
                onClick={() => setFiltroEscolhido(aba)}
                aria-pressed={ativa}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  ativa
                    ? "border-primary bg-primary text-primary-foreground"
                    : urgente
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                      : "border-border bg-background text-muted-foreground hover:bg-background hover:text-foreground",
                )}
              >
                {ROTULO_DO_FILTRO[aba]}
                {/* ⚠️ Zero **some**, nao vira "0". Uma fileira de zeros e ruido, e
                    o que se quer ver ali e justamente o que nao esta zerado. */}
                {total ? (
                  <span
                    className={cn(
                      "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold tabular-nums",
                      ativa ? "bg-primary-foreground/25" : urgente ? "bg-primary/20" : "bg-muted",
                    )}
                  >
                    {total > 999 ? "999+" : total}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {carregando ? (
        <div className="space-y-2 p-3">
          <div className="h-14 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-14 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-14 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
          {filtro === "esperando" && !busca.trim() ? (
            <CheckCircle2 className="h-8 w-8 text-success" />
          ) : (
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
          )}
          <p className="text-sm text-muted-foreground">
            {conversas.length === 0
              ? "Nenhuma conversa ainda."
              : busca.trim()
                ? "Nada encontrado para essa busca."
                : filtro === "esperando"
                  ? "Ninguém esperando resposta."
                  : "Nenhuma conversa aqui."}
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {filtradas.map((conversa) => {
            const ativa = conversa.id === selecionadaId;
            const estado = estadoDaConversa(conversa);
            const esperando = estado === "esperando";

            return (
              <li key={conversa.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelecionar(conversa)}
                  aria-current={ativa ? "true" : undefined}
                  className={cn(
                    /* ⚠️ `py-3`, e nao o `py-2.5` da referencia.
                        La a linha tem **duas** linhas de texto: nome+hora e
                        previa. Aqui tem tres — a empresa entra no meio, e num
                        B2B ela e a identidade do cliente, nao enfeite. Copiar o
                        padding sem copiar a contagem de linhas foi o que deixou
                        tudo grudado: mesma altura, 50% mais conteudo. */
                    "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
                    ativa ? "bg-muted" : "hover:bg-muted/70",
                  )}
                >
                  {/* A faixa na borda marca a fila sem competir com a selecao. */}
                  {esperando ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" /> : null}

                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      ativa
                        ? "bg-primary text-primary-foreground"
                        : esperando
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-foreground",
                    )}
                  >
                    {iniciaisDoCliente(conversa.customer_name)}
                  </span>

                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm text-foreground",
                          esperando ? "font-semibold" : "font-medium",
                        )}
                      >
                        {conversa.customer_name || "Cliente"}
                      </span>
                      <span className="shrink-0 text-[0.625rem] tabular-nums text-muted-foreground">
                        {quando(conversa.last_message_at)}
                      </span>
                    </span>

                    {conversa.customer_company ? (
                      <span className="block truncate text-[0.6875rem] leading-4 text-muted-foreground">
                        {conversa.customer_company}
                      </span>
                    ) : null}

                    {/* A marca e a previa dividem a linha: a marca e a
                        informacao, a previa e o contexto — e quem cede espaco e
                        o contexto. */}
                    <span className="flex items-center gap-1.5">
                      {estado === "finalizada" ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-success" aria-label="Atendimento finalizado" />
                      ) : null}
                      <MarcaDeEspera conversa={conversa} />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-xs",
                          esperando
                            ? "font-medium text-foreground"
                            : conversa.last_message_preview
                              ? "text-muted-foreground"
                              : "italic text-muted-foreground/60",
                        )}
                      >
                        {conversa.last_message_preview || "Ainda não escreveu"}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
