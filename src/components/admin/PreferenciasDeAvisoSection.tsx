import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { usePreferenciasDeAviso, useSalvarPreferenciaDeAviso } from "@/hooks/useAvisosDoPainel";
import type { AdminSection } from "@/components/admin/adminTypes";
import { AVISOS, avisoEstaLigado, tiposConfiguraveis } from "@/lib/avisosDoPainel";
import { cn } from "@/lib/utils";

/**
 * Quais avisos este administrador quer receber.
 *
 * ## Por que mora aqui e não dentro do sino
 *
 * O CRM que serviu de referência configura pelo próprio sino. O pedido aqui foi
 * o contrário, e explícito: "aqui eu quero que configure direto na parte de
 * configurações". Faz sentido — o sino é onde se **lê** o que chegou, e mexer
 * numa engrenagem no mesmo lugar em que se lê convida ao clique errado com
 * pressa. O sino tem um atalho para cá, para o caminho existir dos dois lados.
 *
 * ## É por administrador, e é isso que faz a lista servir
 *
 * Quem cuida de estoque não quer saber de banner publicado; quem cuida do
 * catálogo não quer saber de cada pedido que entra. Um ajuste global obrigaria
 * os dois a aguentar a lista do outro — e a saída de quem aguenta é parar de
 * olhar o sino.
 *
 * ⚠️ **A lista só mostra o que a permissão alcança.** Um botão que liga um aviso
 * que nunca vai chegar é uma promessa quebrada por desenho: a pessoa liga,
 * espera, e nada acontece.
 */
export function PreferenciasDeAvisoSection({
  podeVerSecao,
}: {
  podeVerSecao: (secao: AdminSection) => boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data: preferencias = {}, isLoading } = usePreferenciasDeAviso(userId);
  const salvar = useSalvarPreferenciaDeAviso(userId);

  /**
   * A engrenagem do sino traz `?foco=avisos` — e é isto que faz a tela parar
   * aqui em vez de no topo de Configurações, com esta seção três blocos abaixo.
   *
   * `scrollIntoView` e não âncora `#`: âncora empurraria o bloco para o topo
   * exato da janela, encostado na barra fixa. `block: "center"` deixa a seção
   * no meio da tela, que é onde o olho a encontra.
   */
  const [parametros] = useSearchParams();
  const foco = parametros.get("foco");
  const alvo = useRef<HTMLElement | null>(null);

  // ⚠️ A dependência é a **navegação** (`location.key`), e não o valor de `foco`.
  //
  // Com `[foco]`, clicar na engrenagem já estando em Configurações não rolaria:
  // o parâmetro continua `"avisos"`, a string não muda, o efeito não roda. E é
  // justamente aí que a pessoa mais precisa — ela já está na tela, rolou para
  // outro lugar, e pediu para voltar a esta seção.
  const { key: navegacao } = useLocation();

  useEffect(() => {
    if (foco !== "avisos" || !alvo.current) return;
    alvo.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [foco, navegacao]);

  const tipos = tiposConfiguraveis(podeVerSecao);
  if (tipos.length === 0) return null;

  return (
    <section
      ref={alvo}
      className={cn(
        "rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]",
        // Vindo do sino, um realce por alguns instantes: rolar até aqui sem
        // marcar nada deixa a dúvida de se a tela parou no lugar certo.
        foco === "avisos" && "ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Avisos do painel
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            O que aparece no sino, no topo da tela. Vale só para a sua conta.
          </p>
        </div>
        {isLoading || salvar.isPending ? (
          <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <ul className="mt-4 divide-y divide-border/70">
        {tipos.map((tipo) => {
          const ligado = avisoEstaLigado(tipo, preferencias);

          return (
            <li key={tipo} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{AVISOS[tipo].rotulo}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{AVISOS[tipo].explicacao}</p>
              </div>

              <Switch
                checked={ligado}
                aria-label={`${AVISOS[tipo].rotulo}: ${ligado ? "ligado" : "desligado"}`}
                disabled={salvar.isPending}
                onCheckedChange={(proximo) => {
                  salvar.mutate(
                    { tipo, ativo: proximo },
                    {
                      // O switch mexe e nada mais acontece na tela: sem uma
                      // confirmação, "será que salvou?" é a pergunta seguinte —
                      // ainda mais numa preferência cujo efeito só aparece dias
                      // depois, quando o aviso chega (ou não).
                      onSuccess: () =>
                        proximo
                          ? toast.success(`Avisos de "${AVISOS[tipo].rotulo}" ligados.`, {
                              icon: <Bell className="h-4 w-4" />,
                              description: "Eles voltam a aparecer no sino.",
                            })
                          : toast(`Avisos de "${AVISOS[tipo].rotulo}" desligados.`, {
                              icon: <BellOff className="h-4 w-4" />,
                              description: "Você deixa de ser avisado disso no sino.",
                            }),
                      // Sem aviso de erro, um clique que falha por rede fica
                      // indistinguível de um que deu certo: o switch volta
                      // sozinho quando a consulta recarrega, e a pessoa acha
                      // que o sistema desfez a escolha dela de propósito.
                      onError: () => toast.error("Não foi possível salvar essa preferência."),
                    },
                  );
                }}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
