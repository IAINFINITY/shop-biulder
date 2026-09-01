import { ChevronRight, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";
import { CARTAO_CLICAVEL } from "@/lib/interacoes";
import type { Order, OrderTableLine } from "@/lib/orders";
import {
  classeDoStatus,
  EXPLICACAO_PARA_O_CLIENTE,
  normalizarStatusDoPedido,
  rotuloDoStatus,
} from "@/lib/statusDoPedido";

type ClientOrderCardProps = {
  order: Order;
  lines: OrderTableLine[];
  /** O mesmo número que a tela do pedido mostra. */
  numero: number;
  totalItems: number;
  totalValue: number;
  /** Abre o pedido em tela cheia. Sem isto o cartão é só leitura. */
  onAbrir?: () => void;
};

// Rotulo e cor do status vem de `statusDoPedido.ts`, compartilhado com o painel.
//
// Esta tela tinha as proprias copias, e elas discordavam: no painel "conclu"
// ficava verde, aqui nao. O mesmo pedido saia verde para o atendimento e cinza
// para o cliente. Agora a regra e uma so.

/** Quantas linhas o cartão mostra antes de resumir o resto. */
const LINHAS_VISIVEIS = 3;

export function ClientOrderCard({ order, lines, numero, totalItems, totalValue, onAbrir }: ClientOrderCardProps) {
  const createdAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(order.created_at));
  const statusLabel = rotuloDoStatus(order.status);
  const visibleLines = lines.slice(0, LINHAS_VISIVEIS);
  const remainingCount = Math.max(lines.length - visibleLines.length, 0);

  return (
    // `transition-shadow` sozinho mudava a sombra de 4% para 8% de preto — uma
    // diferença que só aparece em captura lado a lado. `CARTAO_CLICAVEL` é o
    // mesmo gesto dos cartões do painel: borda tingida, sombra e 1px de subida.
    <article
      onClick={onAbrir}
      /* O cartão inteiro abre o pedido: a área de clique é o cartão, e não um
         link escondido no canto. `role` e `tabIndex` só quando de fato abre —
         senão o leitor de tela anuncia um botão que não faz nada.

         ⚠️ E por isso não existe botão aqui dentro: botão dentro de
         role="button" é alvo aninhado, que o teclado percorre duas vezes e o
         leitor de tela anuncia como dois controles para uma ação só. O "Ver
         pedido" do rodapé é texto — quem clica nele clica no cartão. */
      {...(onAbrir
        ? {
            role: "button" as const,
            tabIndex: 0,
            onKeyDown: (evento: React.KeyboardEvent) => {
              if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                onAbrir();
              }
            },
          }
        : {})}
      className={cn(
        "group overflow-hidden rounded-[1.25rem] border border-border/70 bg-background/95 shadow-sm",
        onAbrir && CARTAO_CLICAVEL,
      )}
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {/* O pedido ganhou nome.
                O título era a data, e data não serve para pedir ajuda: duas
                compras do mesmo dia viravam "aquele pedido de terça". O `#N` é o
                mesmo número da tela do pedido, para as duas chamarem o pedido
                pelo mesmo nome. */}
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Pedido #{numero}
            </p>
            <p className="mt-1 truncate text-base font-semibold tracking-tight text-foreground">{createdAt}</p>
          </div>
          <Badge className={cn("rounded-full border px-3 py-1 text-[0.6875rem] font-medium", classeDoStatus(order.status))}>
            {statusLabel}
          </Badge>
        </div>

        {/* O que o estado significa, em uma frase.
            Era o buraco que gerou a reclamação de 31/08/2026: o selo dizia "Em
            andamento" e a pessoa não tinha como saber se precisava fazer algo. A
            regra do pagamento — combinado fora do site — só existia no aviso do
            catálogo, antes da compra, e sumia depois dela. */}
        <p className="mt-3 text-[0.8125rem] leading-6 text-muted-foreground">
          {EXPLICACAO_PARA_O_CLIENTE[normalizarStatusDoPedido(order.status)]}
        </p>

        {/* Três números, e os mesmos três da tela do pedido.
            O cartão dizia "Itens: 315" enquanto a tela do mesmo pedido dizia
            "Itens 50 · Unidades 315" — mesma palavra, número diferente. "Empresa"
            saiu: na conta do cliente é sempre a empresa dele, repetida igual em
            cada cartão da lista. */}
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { rotulo: "Itens", valor: String(lines.length) },
            { rotulo: "Unidades", valor: String(totalItems) },
            { rotulo: "Total", valor: formatBRL(totalValue) },
          ].map((tile) => (
            <div key={tile.rotulo} className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <dt className="text-[0.6875rem] text-muted-foreground">{tile.rotulo}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{tile.valor}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Sem caixa própria: era um retângulo arredondado dentro de outro, e a
          borda de dentro competia com a de fora sem separar nada que a mudança
          de fundo já não separe. */}
      <div className="border-t border-border/70 bg-muted/[0.15] px-5 py-4 sm:px-6">
        <div className="space-y-2.5">
          {visibleLines.map((line, indice) => (
            <div key={`${line.code}-${indice}`} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background transition-colors group-hover:border-primary/25">
                  {line.imageUrl ? (
                    <img
                      src={line.imageUrl}
                      alt=""
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground/35" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] font-medium text-foreground">{line.name}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {line.quantity} × {formatBRL(line.unitPrice)}
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-[0.8125rem] font-medium tabular-nums text-foreground">
                {formatBRL(line.subtotal)}
              </p>
            </div>
          ))}
          {visibleLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Itens ainda não sincronizados para visualização.</p>
          ) : null}
        </div>

        {onAbrir ? (
          /* "+ 48 item(ns) adicionais" era uma frase morta: dizia que havia mais
             e não levava a lugar nenhum, num cartão que abre inteiro no clique.
             Agora a mesma linha é a porta — e ela aparece mesmo quando o pedido
             cabe no cartão, senão o pedido de duas linhas não teria como se
             anunciar clicável. */
          <p className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[0.8125rem] font-medium text-primary">
            <span>
              {remainingCount > 0
                ? `Ver mais ${remainingCount} ${remainingCount === 1 ? "item" : "itens"}`
                : "Ver pedido"}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </p>
        ) : remainingCount > 0 ? (
          <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            + {remainingCount} {remainingCount === 1 ? "item" : "itens"}
          </p>
        ) : null}
      </div>
    </article>
  );
}
