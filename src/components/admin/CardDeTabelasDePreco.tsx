import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layers, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { ListaComBusca } from "@/components/admin/ListaComBusca";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { rotuloDaTabela, useTabelasDePreco } from "@/hooks/useTabelasDePreco";
import { customerTypeLabel } from "@/lib/pricing";

/**
 * As tabelas de preço: quem usa cada uma, e quais estão no ar.
 *
 * ## ⚠️ Ativar e desativar passaram a pedir confirmação
 *
 * Antes o botão aplicava direto. Desativar uma tabela tira a origem de preço de
 * quem depende dela — e isso não dá erro nenhum: o cliente simplesmente passa a
 * pagar outro valor. Ação sem aviso e sem sintoma é a combinação que faz um
 * clique errado só aparecer na fatura do mês seguinte.
 *
 * O diálogo diz **quantas contas e quais tipos** dependem da tabela, que é a
 * informação que falta para decidir.
 */
export function CardDeTabelasDePreco({
  contasPorTabela,
  onAbrirTabela,
}: {
  /** Quantas contas têm cada tabela como negociação individual. */
  contasPorTabela: Map<number, number>;
  onAbrirTabela?: (tprId: number) => void;
}) {
  const queryClient = useQueryClient();
  const { data: tabelas = [], isLoading } = useTabelasDePreco();
  const { options: tipos } = useCustomerTypes();

  const [mexendo, setMexendo] = useState<number | null>(null);
  const [novaTabela, setNovaTabela] = useState("");
  const [criando, setCriando] = useState(false);

  /**
   * Cria uma tabela.
   *
   * ## ⚠️ O `tpr_id` é gerado aqui, e não pelo banco
   *
   * A coluna é a chave e **não tem `default`**: os números vinham do ERP, onde
   * eram atribuídos lá. Sem Proxis, alguém tem de escolher — e escolher "o
   * próximo acima do maior" mantém os números do ERP intactos e nunca colide
   * com eles, porque só cresce a partir do topo.
   *
   * Começar em 9000 se não houver nenhuma deixa uma faixa livre entre os ids
   * antigos (40…8745) e os novos, o que torna óbvio, olhando um número, se ele
   * nasceu aqui ou veio de fora.
   */
  const criar = async () => {
    const nome = novaTabela.trim();
    if (nome.length < 3) {
      toast.error("Dê um nome à tabela antes de criar.", {
        description: "Pelo menos três letras — por exemplo, “Sul 2026”.",
      });
      return;
    }

    setCriando(true);
    try {
      const maior = tabelas.reduce((maximo, tabela) => Math.max(maximo, tabela.tprId), 0);
      const proximo = maior > 0 ? maior + 1 : 9000;

      const { error } = await supabase
        .from("clinic+b2b_price_tables")
        .insert({ tpr_id: proximo, name: nome, active: true });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["price-tables"] });
      setNovaTabela("");
      toast.success(`Tabela “${nome}” criada (${proximo}).`, {
        // Sem esta frase a tabela nasce e some: ela ainda não tem preço, e o
        // seletor de origem dos tipos só oferece tabelas com preço.
        description: "Ela ainda não tem preços — abra a lista abaixo para preencher.",
      });
    } catch {
      toast.error("Não foi possível criar a tabela.");
    } finally {
      setCriando(false);
    }
  };

  /** Os tipos que puxam preço desta tabela — o que o diálogo precisa dizer. */
  const tiposQueUsam = (tprId: number) => tipos.filter((tipo) => tipo.priceTableId === tprId);

  const alternar = async (tprId: number, ativa: boolean) => {
    setMexendo(tprId);
    try {
      const { error } = await supabase
        .from("clinic+b2b_price_tables")
        .update({ active: ativa })
        .eq("tpr_id", tprId);

      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["price-tables"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-pricing"] }),
      ]);
      toast.success(ativa ? "Tabela reativada." : "Tabela desativada.");
    } catch {
      toast.error("Não foi possível mudar a tabela.");
    } finally {
      setMexendo(null);
    }
  };

  /**
   * Apaga a tabela e os preços dela.
   *
   * ⚠️ Quem decide se pode é o **banco**, não esta tela. A função
   * `clinic_b2b_excluir_tabela_de_preco` recusa quando um tipo ou uma conta
   * depende da tabela, e faz as duas remoções numa transação — sem ela, uma
   * falha no meio deixaria a tabela sem preço nenhum.
   *
   * A tela desabilita o botão pelo mesmo motivo, mas isso é conveniência: ela
   * pode estar com dado velho, e o vínculo pode ter sido criado há um segundo
   * por outra pessoa.
   */
  const excluir = async (tprId: number, nome: string) => {
    setMexendo(tprId);
    try {
      const { data, error } = await supabase.rpc("clinic_b2b_excluir_tabela_de_preco" as never, {
        p_tpr_id: tprId,
      } as never);

      if (error) throw error;

      const removidos = Number((data as { precos_removidos?: number } | null)?.precos_removidos ?? 0);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["price-tables"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-pricing"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-price-overrides"] }),
      ]);
      toast.success(`Tabela “${nome}” excluída.`, {
        description: removidos > 0 ? `${removidos} preço(s) saíram junto.` : "Ela não tinha preço nenhum.",
      });
    } catch (erro) {
      console.error("[preços] falha ao excluir tabela", erro);
      // A mensagem do banco diz **quem** depende dela; repeti-la é mais útil
      // que "não foi possível".
      const detalhe = erro instanceof Error ? erro.message : "";
      toast.error("Não foi possível excluir a tabela.", {
        description: detalhe.includes("em uso")
          ? "Alguém ainda depende dela. Desative em vez de excluir."
          : undefined,
      });
    } finally {
      setMexendo(null);
    }
  };

  return (
    <section className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Layers className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Tabelas de preço
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Listas de preço que um tipo inteiro ou uma conta específica pode usar.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Input
          value={novaTabela}
          onChange={(evento) => setNovaTabela(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") void criar();
          }}
          placeholder="Nome da nova tabela — ex.: Sul 2026"
          className="h-10 rounded-2xl text-[0.8125rem]"
        />
        <Button type="button" onClick={() => void criar()} disabled={criando} className="h-10 shrink-0 rounded-2xl px-4 text-sm">
          {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Criar tabela
        </Button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <p className="py-3 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <ListaComBusca
            itens={tabelas}
            chaveDoItem={(tabela) => String(tabela.tprId)}
            // O número entra na busca: é por ele que o ERP e o TXT falam de
            // uma tabela, e quem procura "8729" não sabe o nome dela.
            textoDoItem={(tabela) => `${tabela.description} ${tabela.tprId}`}
            buscaPlaceholder="Buscar tabela ou número..."
            vazio="Nenhuma tabela cadastrada."
            renderizar={(tabela) => {
              const contas = contasPorTabela.get(tabela.tprId) ?? 0;
              const usadaPor = tiposQueUsam(tabela.tprId);
              // Mesma condição que a função no banco aplica. Aqui é só para não
              // oferecer um botão que vai ser recusado.
              const emUso = usadaPor.length > 0 || contas > 0;

              return (
            // Grade igual à do card de tipos: nome, estado e ações sempre na
            // mesma vertical, com ou sem selo de "Desativada".
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{rotuloDaTabela(tabela)}</p>
                {/* Quem depende dela, em uma linha. Sem isto, "desativar" é uma
                    decisão tomada sem saber o que ela desliga. */}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {usadaPor.length > 0
                    ? `Tipo: ${usadaPor.map((tipo) => customerTypeLabel(tipo.name)).join(", ")}`
                    : contas > 0
                      ? `${contas} conta(s) por negociação individual`
                      : "Ninguém usa"}
                </p>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2">
                {!tabela.ativa ? (
                  <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                    Desativada
                  </Badge>
                ) : null}

                {onAbrirTabela ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-full px-2.5 text-xs"
                    onClick={() => onAbrirTabela(tabela.tprId)}
                  >
                    Ver preços
                  </Button>
                ) : null}

                <ConfirmActionDialog
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-full px-3 text-xs"
                      disabled={mexendo === tabela.tprId}
                    >
                      {mexendo === tabela.tprId ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                      {tabela.ativa ? "Desativar" : "Reativar"}
                    </Button>
                  }
                  title={tabela.ativa ? `Desativar “${tabela.description}”?` : `Reativar “${tabela.description}”?`}
                  description={
                    tabela.ativa ? (
                      <>
                        Ela some do cadastro de clientes e da escolha de origem dos tipos.{" "}
                        <strong>Os preços não são apagados.</strong>
                        {usadaPor.length > 0 || contas > 0 ? (
                          <>
                            <br />
                            <br />
                            ⚠️ Hoje dependem dela:{" "}
                            <strong>
                              {[
                                usadaPor.length > 0
                                  ? `o tipo ${usadaPor.map((t) => customerTypeLabel(t.name)).join(", ")}`
                                  : null,
                                contas > 0 ? `${contas} conta(s) com negociação individual` : null,
                              ]
                                .filter(Boolean)
                                .join(" e ")}
                            </strong>
                            . Eles passam a pagar pelo preço de cadastro, sem aviso na tela deles.
                          </>
                        ) : null}
                      </>
                    ) : (
                      "Ela volta a aparecer no cadastro de clientes e na escolha de origem dos tipos."
                    )
                  }
                  confirmLabel={tabela.ativa ? "Desativar" : "Reativar"}
                  processingLabel={tabela.ativa ? "Desativando..." : "Reativando..."}
                  destructive={tabela.ativa}
                  onConfirm={() => alternar(tabela.tprId, !tabela.ativa)}
                />

                {/* Excluir de verdade — o que "desativar" nunca fez.
                    Desativada, a tabela some da escolha e fica na lista para
                    sempre; quem cria uma para testar acumula entulho. Só é
                    oferecido quando ninguém depende dela: com tipo ou conta
                    apontando, apagar mudaria o preço de gente real sem aviso. */}
                {emUso ? (
                  <span
                    title="Desative em vez de excluir: alguém ainda depende desta tabela."
                    className="cursor-not-allowed rounded-full p-1.5 text-muted-foreground/40"
                    aria-hidden
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <ConfirmActionDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 rounded-full p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={mexendo === tabela.tprId}
                        aria-label={`Excluir a tabela ${tabela.description}`}
                        title="Excluir tabela"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    }
                    title={`Excluir “${tabela.description}”?`}
                    description={
                      <>
                        A tabela e os preços dela são apagados. <strong>Não dá para desfazer.</strong>
                        <br />
                        <br />
                        Ninguém depende dela hoje — nenhum tipo de conta e nenhuma conta com
                        negociação individual. Se quiser apenas tirá-la da frente, use{" "}
                        <strong>Desativar</strong>: os preços ficam guardados.
                      </>
                    }
                    confirmLabel="Excluir"
                    processingLabel="Excluindo..."
                    destructive
                    onConfirm={() => excluir(tabela.tprId, tabela.description)}
                  />
                )}
              </div>
              </div>
              );
            }}
          />
        )}
      </div>
    </section>
  );
}
