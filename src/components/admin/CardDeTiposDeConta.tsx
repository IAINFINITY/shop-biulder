import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { ListaComBusca } from "@/components/admin/ListaComBusca";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { rotuloDaTabela, useTabelasDePreco } from "@/hooks/useTabelasDePreco";
import { customerTypeLabel } from "@/lib/pricing";

/** Valor do `Select` quando o tipo tem preços próprios. */
const PROPRIOS = "proprios";

/**
 * Os tipos de conta, e de onde vem o preço de cada um.
 *
 * ## O que mudou
 *
 * Um tipo era só um rótulo: existia, e os preços dele viviam soltos em
 * `customer_price_overrides`. Não havia como dizer "todo lojista paga pela
 * tabela 8729" — isso só dava conta a conta, e um lojista novo nascia fora da
 * tabela, em silêncio.
 *
 * Agora cada tipo escolhe a **origem** do preço: preços próprios, ou uma tabela.
 * E vários tipos podem apontar para a mesma, que era o ponto do pedido.
 *
 * ## ⚠️ A negociação individual continua ganhando
 *
 * Uma conta com tabela negociada própria ignora a do tipo. A do tipo é a regra
 * do grupo; a da conta é um acordo caso a caso, e o grupo passando por cima do
 * acordo apagaria 35 negociações de uma vez — sem erro, só com o preço errado.
 */
export function CardDeTiposDeConta() {
  const queryClient = useQueryClient();
  const { options: tipos, addCustomType, removeCustomType, isLoading } = useCustomerTypes();
  const { data: tabelas = [] } = useTabelasDePreco();

  const [novoTipo, setNovoTipo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mexendo, setMexendo] = useState<string | null>(null);

  const criar = async () => {
    const nome = novoTipo.trim();
    // ⚠️ Valida no clique, e não desabilitando o botão.
    //
    // O botão nascia `disabled` até haver 2 letras, e um botão apagado não diz
    // o que falta — a leitura é "está quebrado", não "digite primeiro". Botão
    // vivo que responde com o motivo custa um toast e tira a dúvida.
    if (nome.length < 2) {
      toast.error("Escreva o nome do tipo antes de criar.", {
        description: "Pelo menos duas letras — por exemplo, “farmácia”.",
      });
      return;
    }

    setSalvando(true);
    await addCustomType(nome);
    setNovoTipo("");
    setSalvando(false);
  };

  const mudarOrigem = async (nome: string, valor: string) => {
    setMexendo(nome);
    try {
      const tabela = valor === PROPRIOS ? null : Number(valor);
      const { error } = await supabase
        .from("clinic+b2b_customer_types")
        .update({ price_table_id: tabela, updated_at: new Date().toISOString() })
        .eq("name", nome);

      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-types-saved"] }),
        // O preço que o cliente vê muda junto: sem isto a etiqueta continuaria
        // mostrando a origem antiga até o cache de 5 minutos expirar.
        queryClient.invalidateQueries({ queryKey: ["customer-pricing"] }),
      ]);

      toast.success(
        tabela === null
          ? `“${customerTypeLabel(nome)}” volta a usar preços próprios.`
          : `“${customerTypeLabel(nome)}” passa a usar a tabela ${tabela}.`,
        { description: "Contas com tabela negociada própria continuam com a delas." },
      );
    } catch {
      toast.error("Não foi possível mudar a origem do preço.");
    } finally {
      setMexendo(null);
    }
  };

  return (
    <section className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Tipos de conta
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Cada tipo tem preços próprios ou puxa de uma tabela. Vários tipos podem usar a mesma.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Input
          value={novoTipo}
          onChange={(evento) => setNovoTipo(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") void criar();
          }}
          placeholder="Nome do novo tipo — ex.: farmácia"
          className="h-10 rounded-2xl text-[0.8125rem]"
        />
        <Button type="button" onClick={() => void criar()} disabled={salvando} className="h-10 shrink-0 rounded-2xl px-4 text-sm">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Criar tipo
        </Button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <p className="py-3 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <ListaComBusca
            itens={tipos}
            chaveDoItem={(tipo) => tipo.name}
            textoDoItem={(tipo) => customerTypeLabel(tipo.name)}
            buscaPlaceholder="Buscar tipo..."
            vazio="Nenhum tipo de conta cadastrado."
            renderizar={(tipo) => {
              const origem = tipo.priceTableId == null ? PROPRIOS : String(tipo.priceTableId);

              return (
                // ⚠️ Grade, e não `flex-wrap`.
                //
                // Com `flex`, uma linha cujo conteúdo do meio fosse mais estreito
                // encolhia e puxava a lixeira para a esquerda, e os nomes
                // acabavam em alturas diferentes. Três colunas fixas põem nome,
                // origem e ação sempre na mesma vertical.
                <div className="grid grid-cols-[1fr_13rem_2.25rem] items-center gap-3 py-3">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {customerTypeLabel(tipo.name)}
                  </span>

                  <Select
                    value={origem}
                    disabled={mexendo === tipo.name}
                    onValueChange={(valor) => void mudarOrigem(tipo.name, valor)}
                  >
                    <SelectTrigger className="h-9 w-full rounded-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PROPRIOS}>Preços próprios deste tipo</SelectItem>
                      {tabelas
                        .filter((tabela) => tabela.ativa && tabela.temPreco)
                        .map((tabela) => (
                          <SelectItem key={tabela.tprId} value={String(tabela.tprId)}>
                            {rotuloDaTabela(tabela)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center justify-end">
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 w-8 rounded-full p-0 text-destructive hover:bg-destructive/10"
                          title={`Apagar o tipo ${customerTypeLabel(tipo.name)}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Apagar</span>
                        </Button>
                      }
                      title={`Apagar o tipo “${customerTypeLabel(tipo.name)}”?`}
                      description="Se alguma conta estiver usando este tipo, a exclusão é recusada — troque o tipo dessas contas primeiro, em Clientes."
                      confirmLabel="Apagar tipo"
                      processingLabel="Apagando..."
                      destructive
                      onConfirm={async () => {
                        await removeCustomType(tipo.name);
                      }}
                    />
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
