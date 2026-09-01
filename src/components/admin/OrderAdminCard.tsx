import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Eye, FileSpreadsheet, FileText, FileType2, RotateCcw, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderItemsTable } from "@/components/admin/OrderItemsTable";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { formatBRL } from "@/lib/formatMoney";
import type { OrderTableLine } from "@/lib/orders";
import {
  PROXIS_SYNC_ERROR,
  PROXIS_SYNC_LABELS,
  PROXIS_SYNC_LEGACY,
  PROXIS_SYNC_NAO_APLICAVEL,
  PROXIS_SYNC_PENDING,
  PROXIS_SYNC_SENT,
  normalizeProxisSyncStatus,
} from "@/lib/proxisOrderStatus";
import {
  ESTADOS_DO_PEDIDO,
  EXPLICACAO_PARA_O_CLIENTE,
  type StatusDoPedido,
  ROTULOS,
  VALORES_GRAVADOS,
  classeDoStatus,
  normalizarStatusDoPedido,
  rotuloDoStatus,
} from "@/lib/statusDoPedido";
import { cn } from "@/lib/utils";
import { CARTAO_CLICAVEL } from "@/lib/interacoes";

export type OrderAdminCardPayload = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_company: string | null | undefined;
  customer_phone: string | null | undefined;
  customer_cnpj: string | null | undefined;
  customer_observation?: string | null;
  status: string;
  total_items: number;
  proxis_import_id: number | null;
  proxis_status?: string | null;
  proxis_error?: string | null;
  proxis_doc_ped_web?: string | null;
  proxis_attempts?: number | null;
  proxis_last_attempt_at?: string | null;
  items: unknown;
};

const PROXIS_SYNC_BADGE = {
  [PROXIS_SYNC_SENT]: { icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  [PROXIS_SYNC_PENDING]: { icon: Clock, className: "border-amber-200 bg-amber-50 text-amber-800" },
  [PROXIS_SYNC_ERROR]: { icon: AlertTriangle, className: "border-red-200 bg-red-50 text-red-700" },
  [PROXIS_SYNC_LEGACY]: { icon: Clock, className: "border-border/70 bg-muted/30 text-muted-foreground" },
  // Sem este par o cartao quebra: `syncBadge` viria `undefined` e `syncBadge.icon`
  // estoura. Status novo no vocabulario precisa entrar aqui junto.
  //
  // Cor propria, e nao a de erro nem a de pendente: nao ha nada errado com este
  // pedido, e ninguem precisa agir sobre ele.
  [PROXIS_SYNC_NAO_APLICAVEL]: { icon: UserRound, className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
} as const;

// Os quatro estados vem de `statusDoPedido.ts`. A lista fixa que estava aqui
// oferecia "NOVO CARRINHO / Separando / Processando / Entregue / Cancelado"
// enquanto as abas agrupavam em "Em andamento / Concluidos / Cancelados" — quem
// marcava "Entregue" precisava saber que isso o jogava em "Concluidos". Escolher
// e ver viraram a mesma coisa.

type Props = {
  order: OrderAdminCardPayload;
  displayOrderNumber: number;
  lines: OrderTableLine[];
  orderTotal: number;
  orderQty: number;
  formatDate: (value: string) => string;
  isProxisExporting: boolean;
  onExportProxis: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
  onDelete: () => void;
  onStatusChange?: (orderId: string, status: string) => void;
  /** Abre a tela do pedido. */
  onAbrirDetalhe?: () => void;
};

export function OrderAdminCard({
  order,
  displayOrderNumber,
  lines,
  orderTotal,
  orderQty,
  formatDate,
  isProxisExporting,
  onExportProxis,
  onExportXlsx,
  onExportPdf,
  onDelete,
  onStatusChange,
  onAbrirDetalhe,
}: Props) {
  const itemLabel = lines.length === 1 ? "1 item" : `${lines.length} itens`;
  /**
   * O estado que o atendimento escolheu, ainda não gravado.
   *
   * Mudar o estado passa a ser uma decisão confirmada, e não um clique no
   * seletor. O motivo não é o risco de errar o clique: é que a partir de agora
   * **o cliente vê** — o estado aparece na conta dele com uma explicação do que
   * significa. Trocar por engano manda uma informação errada para fora.
   */
  const [estadoPretendido, setEstadoPretendido] = useState<StatusDoPedido | null>(null);

  const syncStatus = normalizeProxisSyncStatus(order.proxis_status);
  const syncBadge = PROXIS_SYNC_BADGE[syncStatus];
  const SyncIcon = syncBadge.icon;
  /** Nao vai ao ERP por decisao — nao e falha, e nao pede acao de ninguem. */
  const naoVaiAoErp = syncStatus === PROXIS_SYNC_NAO_APLICAVEL;
  const syncError = order.proxis_error?.trim() ?? "";
  const syncAttempts = typeof order.proxis_attempts === "number" ? order.proxis_attempts : 0;

  return (
    /* A gaveta saiu em 31/08/2026.
       Ela abria uma lista de dois itens de um pedido que pode ter dezenas —
       respondia "quantos", nunca "quais". Quem precisa do pedido inteiro agora
       vai para a tela dele, em "Ver pedido". Manter as duas seria oferecer uma
       resposta pela metade ao lado da resposta inteira. */
    <div
      className={cn(
        "group rounded-[1.25rem] border border-border/70 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        // Tinha `hover:shadow` sozinho: a sombra mudava de 4% para 6% de preto,
        // uma diferenca que so aparece em captura de tela lado a lado.
        CARTAO_CLICAVEL,
      )}
    >
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex gap-2 sm:gap-3">

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{order.customer_name}</p>
                <p className="truncate text-xs text-muted-foreground">{order.customer_company || "Sem empresa"}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                {onStatusChange ? (
                  <Select
                    value={normalizarStatusDoPedido(order.status)}
                    onValueChange={(estado) => setEstadoPretendido(estado as StatusDoPedido)}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-9 sm:h-7 w-auto gap-1 rounded-full border px-2.5 py-0 text-[0.6875rem] font-medium",
                        classeDoStatus(order.status),
                        "[&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-50",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {ESTADOS_DO_PEDIDO.map((estado) => (
                        <SelectItem key={estado} value={estado} className="text-[0.8125rem]">
                          {ROTULOS[estado]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={cn("rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium", classeDoStatus(order.status))}>
                    {rotuloDoStatus(order.status)}
                  </Badge>
                )}
                <Badge
                  className={cn(
                    "gap-1 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium",
                    syncBadge.className,
                  )}
                  title={
                    syncError
                      ? `${PROXIS_SYNC_LABELS[syncStatus]}: ${syncError}`
                      : PROXIS_SYNC_LABELS[syncStatus]
                  }
                >
                  <SyncIcon className="h-3 w-3" />
                  {PROXIS_SYNC_LABELS[syncStatus]}
                </Badge>
                {order.proxis_import_id != null ? (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-mono text-[0.6875rem]">
                    Pedido {displayOrderNumber}
                  </Badge>
                ) : null}
                <span className="whitespace-nowrap text-[0.6875rem] text-muted-foreground">{formatDate(order.created_at)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
              <span className="tabular-nums">
                <span className="text-muted-foreground">Qtd:</span>{" "}
                <span className="font-medium text-foreground">{orderQty}</span>
              </span>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <span className="tabular-nums">
                <span className="text-muted-foreground">Total:</span>{" "}
                <span className="font-semibold text-foreground">{formatBRL(orderTotal)}</span>
              </span>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <span className="text-[0.6875rem] text-muted-foreground">{itemLabel}</span>
              {order.customer_cnpj ? (
                <>
                  <span className="text-muted-foreground hidden sm:inline">·</span>
                  <span className="text-[0.6875rem] tabular-nums text-muted-foreground">CNPJ: {order.customer_cnpj}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* A porta para a tela do pedido.
              A gaveta abaixo continua, para a espiada rápida; quem precisa
              conferir o pedido inteiro vem por aqui. */}
          {onAbrirDetalhe ? (
            <Button
              type="button"
              size="sm"
              className="h-10 gap-1 rounded-full px-3 text-[0.8125rem] sm:h-8 sm:text-xs"
              onClick={onAbrirDetalhe}
            >
              <Eye className="h-3.5 w-3.5" />
              Ver pedido
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 gap-1 rounded-full px-3 text-[0.8125rem] sm:text-xs" disabled={isProxisExporting} onClick={onExportProxis}>
            {/* Ícone do sistema, não PNG.
                Os três arquivos existem em `public/icons` e o caminho estava
                certo, mas imagem solta some por cache, por 404 silencioso e não
                acompanha a cor do botão nem o tema. Todo o resto do painel usa
                lucide; três PNGs de 9KB para um ícone de 14px eram a exceção. */}
            <FileText className="h-3.5 w-3.5" />
            {isProxisExporting ? "Gerando..." : "FOCCO .txt"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 gap-1 rounded-full px-3 text-[0.8125rem] sm:text-xs" onClick={onExportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-10 sm:h-8 gap-1 rounded-full px-3 text-[0.8125rem] sm:text-xs" onClick={onExportPdf}>
            <FileType2 className="h-3.5 w-3.5" /> PDF
          </Button>
          <ConfirmActionDialog
            trigger={
              <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8 rounded-full text-destructive" title="Excluir pedido">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
            title="Excluir pedido"
            description="Deseja excluir este pedido permanentemente"
            confirmLabel="Excluir"
            cancelLabel="Cancelar"
            destructive
            onConfirm={onDelete}
          />
        </div>
      </div>

      {/* ⚠️ **Este diálogo não existia.**
          O seletor gravava `estadoPretendido` e mais nada acontecia: nenhuma
          confirmação, nenhum salvamento. O comentário na declaração do estado
          já descrevia o diálogo — ele só nunca chegou a ser escrito, e mudar o
          estado de um pedido simplesmente não funcionava.

          Ele é controlado por `estadoPretendido` em vez de ter `trigger`
          próprio, porque quem o abre é a escolha no `Select`, e não um botão. */}
      <ConfirmActionDialog
        aberto={estadoPretendido !== null}
        onAbertoChange={(aberto) => {
          if (!aberto) setEstadoPretendido(null);
        }}
        title={`Mudar para "${estadoPretendido ? ROTULOS[estadoPretendido] : ""}"?`}
        description={
          <>
            {/* A frase exata que o cliente vai ler na conta dele. Sem mostrá-la
                aqui, quem decide o estado nunca vê o que a decisão comunica —
                e foi essa distância que gerou a reclamação de 31/08. */}
            O cliente passa a ver, na conta dele:
            <br />
            <br />
            <strong>
              “{estadoPretendido ? EXPLICACAO_PARA_O_CLIENTE[estadoPretendido] : ""}”
            </strong>
          </>
        }
        confirmLabel="Mudar estado"
        processingLabel="Mudando..."
        onConfirm={async () => {
          if (!estadoPretendido || !onStatusChange) return;
          await onStatusChange(order.id, estadoPretendido);
          setEstadoPretendido(null);
        }}
      />
    </div>
  );
}
