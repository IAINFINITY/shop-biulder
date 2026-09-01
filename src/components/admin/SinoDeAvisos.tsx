import { useMemo } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  BellOff,
  Image as ImageIcon,
  MessageSquareText,
  Settings,
  ShoppingBag,
  Star,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import {
  useAvisosDoPainel,
  useLimparAvisosDoPainel,
  useMarcarAvisosComoLidos,
  usePreferenciasDeAviso,
} from "@/hooks/useAvisosDoPainel";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import type { AdminSection } from "@/components/admin/adminTypes";
import { AVISOS, avisosVisiveis, contarNaoLidos, ehTipoConhecido, type TipoDeAviso } from "@/lib/avisosDoPainel";
import { cn } from "@/lib/utils";

const ICONE: Record<TipoDeAviso, typeof Bell> = {
  pedido_novo: ShoppingBag,
  mensagem_nova: MessageSquareText,
  cliente_novo: Users,
  funcionario_novo: UserPlus,
  avaliacao_nova: Star,
  banner_novo: ImageIcon,
  imagem_nova: ImageIcon,
  admin_novo: Shield,
};

/**
 * O sino do painel.
 *
 * ## Por que ele existe
 *
 * "eu quero realmente tipo um iconezinho de notificação (…) que aquele botão de
 * notificação ele seja pra várias coisas."
 *
 * Antes disto, saber que entrou um pedido exigia abrir Pedidos; saber que entrou
 * um cliente exigia abrir Clientes. A informação existia e nunca vinha até a
 * pessoa — ela tinha que ir buscar, em cada seção, sem saber se havia o que
 * buscar.
 *
 * ## O que ele mostra é por pessoa, em três camadas
 *
 * Permissão (regra) → preferência (escolha) → leitura (memória). O critério mora
 * em `avisosDoPainel.ts`, junto do motivo de a permissão vir antes da
 * preferência.
 *
 * ## Configurar é noutro lugar, de propósito
 *
 * O CRM de referência configura dentro do próprio sino. Aqui o pedido foi
 * explícito — "aqui eu quero que configure direto na parte de configurações" — e
 * o link daqui leva para lá, para o caminho existir dos dois lados.
 */
export function SinoDeAvisos({
  onIrParaSecao,
  podeVerSecao,
}: {
  onIrParaSecao: (secao: AdminSection, foco?: string) => void;
  /**
   * A permissao vem de fora, e nao de um `useAuth` aqui dentro: quem monta a
   * shell **ja** resolveu isso para desenhar o menu, e consultar de novo abriria
   * a porta para o sino e o menu discordarem sobre o que a pessoa alcanca.
   */
  podeVerSecao: (secao: AdminSection) => boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data: avisos = [] } = useAvisosDoPainel(userId);
  const { data: preferencias = {} } = usePreferenciasDeAviso(userId);
  const marcarComoLidos = useMarcarAvisosComoLidos(userId);
  const limpar = useLimparAvisosDoPainel(userId);

  const visiveis = useMemo(
    () => avisosVisiveis(avisos, { preferencias, podeVerSecao }),
    [avisos, preferencias, podeVerSecao],
  );
  const naoLidos = contarNaoLidos(visiveis);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={naoLidos > 0 ? `${naoLidos} avisos não lidos` : "Avisos do painel"}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <Bell className="h-[1.125rem] w-[1.125rem]" />
          {naoLidos > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold tabular-nums text-primary-foreground">
              {naoLidos > 99 ? "99+" : naoLidos}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-start gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Avisos</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {naoLidos === 0 ? "Nada novo por aqui." : `${naoLidos} não ${naoLidos === 1 ? "lido" : "lidos"}`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {naoLidos > 0 ? (
              <button
                type="button"
                onClick={() => marcarComoLidos.mutate(visiveis.filter((a) => !a.lida_em).map((a) => a.id))}
                disabled={marcarComoLidos.isPending}
                className="rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                Marcar todos
              </button>
            ) : null}
            {/* Limpar tira da lista; "marcar todos" só apaga o destaque. Duas
                ações diferentes, e por isso as duas ficam aqui.

                ⚠️ Com confirmação: some tudo de uma vez e não há como trazer de
                volta pela tela. É a mesma régua das outras ações destrutivas do
                painel. */}
            {visiveis.length > 0 ? (
              <ConfirmActionDialog
                title="Limpar seus avisos?"
                description={
                  <>
                    Os {visiveis.length} avisos saem da <strong>sua</strong> lista. Os outros
                    administradores continuam vendo os deles, e nada é apagado do sistema — avisos
                    novos seguem chegando normalmente.
                  </>
                }
                confirmLabel="Limpar"
                processingLabel="Limpando…"
                destructive
                onConfirm={() => limpar.mutateAsync(visiveis.map((a) => a.id))}
                trigger={
                  <button
                    type="button"
                    disabled={limpar.isPending}
                    aria-label="Limpar meus avisos"
                    title="Tirar todos os avisos da minha lista"
                    className="rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
                  >
                    Limpar
                  </button>
                }
              />
            ) : null}
            {/* Sempre visível, inclusive com a lista vazia: é justamente quando
                alguém quer ligar de volta o que desligou. */}
            <button
              type="button"
              // `"avisos"` e o que faz Configuracoes abrir **na** secao de
              // avisos, e nao no topo com ela tres blocos abaixo.
              onClick={() => onIrParaSecao("configuracoes", "avisos")}
              aria-label="Configurar quais avisos receber"
              title="Escolher quais avisos receber"
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {visiveis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellOff className="h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhum aviso ainda.</p>
            <button
              type="button"
              onClick={() => onIrParaSecao("configuracoes", "avisos")}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Escolher quais avisos receber
            </button>
          </div>
        ) : (
          <ul className="max-h-[26rem] divide-y divide-border overflow-y-auto">
            {visiveis.map((aviso) => {
              if (!ehTipoConhecido(aviso.tipo)) return null;
              const definicao = AVISOS[aviso.tipo];
              const Icone = ICONE[aviso.tipo];
              const lido = Boolean(aviso.lida_em);

              return (
                <li key={aviso.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // Abrir é ter visto: marcar sozinho evita o passo extra de
                      // "li e agora marco", que ninguém faz — e um sino que só
                      // zera na mão fica aceso para sempre.
                      if (!lido) marcarComoLidos.mutate([aviso.id]);
                      onIrParaSecao(definicao.secao);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/60",
                      !lido && "bg-primary/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        lido ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                      )}
                    >
                      <Icone className="h-3.5 w-3.5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {!lido ? <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-[0.8125rem] text-foreground",
                            lido ? "font-normal" : "font-medium",
                          )}
                        >
                          {aviso.titulo}
                        </span>
                      </span>
                      {aviso.descricao ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{aviso.descricao}</span>
                      ) : null}
                      <span className="mt-0.5 block text-[0.625rem] text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(aviso.created_at), { locale: ptBR, addSuffix: true })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
