import { useCallback, useEffect, useState } from "react";
import { Loader2, MonitorSmartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import { TEXT } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { ListaComBusca } from "@/components/admin/ListaComBusca";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";

/**
 * Os aparelhos que dispensam o segundo fator.
 *
 * A §17 exige que "dispositivo confiavel" tenha **inventario visivel** e
 * **revogacao pelo usuario**. Sem esta tela, a memoria de 30 dias seria uma
 * porta que a pessoa nao ve e nao consegue fechar — e o pior caso e exatamente
 * o que ela precisa poder resolver: o computador que ficou no cliente, o
 * notebook vendido, o aparelho perdido.
 *
 * E o mesmo argumento que a lista de autenticadores ja carrega: descobrir algo
 * estranho e nao poder tirar seria pior do que nao ver.
 *
 * ## Fala direto com o banco, sem rota
 *
 * As policies da migration `20260808220000` permitem ao dono **ler** e
 * **atualizar** as proprias linhas. Ler e revogar cabem nisso, entao uma rota so
 * repetiria a regra em outro lugar.
 *
 * O que **nao** cabe e inserir: nao existe policy de INSERT, de proposito. Se o
 * navegador pudesse criar a linha, bastaria isso para nunca mais ver o desafio,
 * e a confianca de dispositivo passaria a "substituir MFA silenciosamente" — o
 * que a §17 proibe. Registrar so acontece server-side, com `aal2` provado.
 */

const TABELA = "clinic+b2b_dispositivos_confiaveis";

type Aparelho = {
  id: string;
  rotulo: string | null;
  criado_em: string;
  ultimo_uso_em: string | null;
  expira_em: string;
};

function formatarData(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
}

export function AparelhosLembradosSection({ className }: { className?: string } = {}) {
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const supabase = await loadSupabaseClient();
      // `revogado_em is null` e `rotacionado_em is null`: a tabela guarda o
      // historico para detectar replay, mas a pessoa so precisa ver o que ainda
      // vale. Mostrar token rotacionado seria listar a mesma maquina varias
      // vezes — uma linha por login.
      const { data, error } = await supabase
        .from(TABELA)
        .select("id, rotulo, criado_em, ultimo_uso_em, expira_em")
        .is("revogado_em", null)
        .is("rotacionado_em", null)
        .gt("expira_em", new Date().toISOString())
        .order("criado_em", { ascending: false });
      if (error) throw error;
      setAparelhos((data ?? []) as Aparelho[]);
      setErro(null);
    } catch (e) {
      console.error("[aparelhos] falha ao listar:", e);
      setErro("Não foi possível carregar seus aparelhos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const revogar = async (id: string) => {
    setRemovendo(id);
    try {
      const supabase = await loadSupabaseClient();
      const { error } = await supabase
        .from(TABELA)
        .update({ revogado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await recarregar();
    } catch (e) {
      console.error("[aparelhos] falha ao revogar:", e);
      setErro("Não foi possível remover este aparelho.");
      // ⚠️ Repropaga: `ConfirmActionDialog` só fecha quando `onConfirm` resolve.
      // Engolindo o erro aqui, o diálogo fecharia como se tivesse dado certo e o
      // aparelho continuaria lembrado — a pior falha possível numa tela de
      // segurança, porque a pessoa vai embora achando que fechou a porta.
      throw e;
    } finally {
      setRemovendo(null);
    }
  };

  // Sem aparelho lembrado nao ha o que administrar, e uma secao vazia so ocupa a
  // tela. Ela aparece quando passa a ter sentido.
  if (!carregando && aparelhos.length === 0 && !erro) return null;

  return (
    <section className={cn("rounded-[1.5rem] border border-border/70 bg-background p-5 sm:p-6", className)}>
      <div className="flex items-start gap-3 pb-4">
        <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className={cn(TEXT.body, "font-semibold text-foreground")}>Aparelhos lembrados</h2>
          <p className={cn(TEXT.caption, "mt-0.5 text-muted-foreground")}>
            Nestes, o código do autenticador não é pedido. Se algum não for seu, remova — ele
            volta a pedir o código na próxima entrada.
          </p>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className={TEXT.compact}>Carregando…</p>
        </div>
      ) : (
        // ⚠️ Paginado — e aqui não é precaução: uma conta já tem **13**
        // aparelhos lembrados. Cada login de um navegador novo acrescenta um, e
        // a lista só cresce; sem teto ela empurra o resto da tela de segurança
        // para fora.
        <ListaComBusca
          itens={aparelhos}
          chaveDoItem={(a) => a.id}
          textoDoItem={(a) => a.rotulo ?? "Aparelho desconhecido"}
          buscaPlaceholder="Buscar aparelho..."
          vazio="Nenhum aparelho lembrado."
          renderizar={(a) => {
            const criado = formatarData(a.criado_em);
            const usado = formatarData(a.ultimo_uso_em);
            return (
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className={cn(TEXT.compact, "font-medium text-foreground")}>
                    {a.rotulo ?? "Aparelho desconhecido"}
                  </p>
                  <p className={cn(TEXT.caption, "text-muted-foreground")}>
                    {criado ? `Lembrado em ${criado}` : "Lembrado recentemente"}
                    {usado ? ` · usado em ${usado}` : ""}
                  </p>
                </div>
                {/* ⚠️ Confirmação, como em toda ação destrutiva do projeto.
                    Não é medo do clique errado: remover é a única ação da linha,
                    fica ao lado do nome e não tem como desfazer — a linha some da
                    lista e o único caminho de volta é entrar de novo naquele
                    aparelho e refazer o segundo fator. Ninguém adivinha isso pelo
                    ícone de lixeira. */}
                <ConfirmActionDialog
                  title="Remover este aparelho?"
                  description={
                    <>
                      <strong>{a.rotulo ?? "Este aparelho"}</strong> volta a pedir o código do
                      autenticador na próxima entrada. Não dá para desfazer: para lembrá-lo de novo,
                      é preciso entrar por ele e confirmar o código.
                    </>
                  }
                  confirmLabel="Remover"
                  processingLabel="Removendo…"
                  destructive
                  onConfirm={() => revogar(a.id)}
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-2 text-destructive hover:text-destructive"
                      disabled={removendo === a.id}
                    >
                      {removendo === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remover
                    </Button>
                  }
                />
              </div>
            );
          }}
        />
      )}

      {erro ? (
        <p className={cn(TEXT.caption, "mt-3 text-destructive")} role="alert">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
