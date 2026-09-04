import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { CUSTOMER_PRICE_OVERRIDES_TABLE } from "@/lib/pricing";
import { formatBRL } from "@/lib/formatMoney";
import { getProductUnitPrice, type Product } from "@/lib/products";
import {
  alteracoesDe,
  chaveDoEscopo,
  formatarParaCampo,
  montarEscopos,
  type EscopoDePreco,
  type LinhaDePrecoDoProduto,
} from "@/lib/precoEmTodasAsTabelas";
import { cn } from "@/lib/utils";

/**
 * Um produto, todos os preços, uma janela.
 *
 * ## O pedido
 *
 * "eu preciso ir dentro de cada planilha dessas, procurar o produto e alterar o
 * valor. Não tem como abrir um campo ali, produto 4187, e eu cadastrar ao mesmo
 * tempo os três preços, numa abertura única de janela?"
 *
 * A regra — quais escopos existem, o que conta como alteração — está em
 * `precoEmTodasAsTabelas.ts`, com teste. Aqui fica o que toca o banco.
 *
 * ## O campo em branco significa "não mexi"
 *
 * ⚠️ Nunca zero. É a diferença entre corrigir um preço e apagar cinco: quem abre
 * a janela para mudar o preço de funcionário não quer zerar os outros escopos
 * por não ter digitado neles.
 */

export function PrecoEmTodasAsTabelasDialog({
  aberto,
  onAbertoChange,
  produtos,
  tiposDeConta,
  tabelas,
  onSalvo,
}: {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  produtos: readonly Product[];
  tiposDeConta: readonly { name: string; label: string }[];
  tabelas: readonly { tprId: number; description: string; ativa: boolean }[];
  onSalvo: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [produto, setProduto] = useState<Product | null>(null);
  const [linhas, setLinhas] = useState<LinhaDePrecoDoProduto[] | null>(null);
  const [digitado, setDigitado] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const escopos = useMemo(() => montarEscopos(tiposDeConta, tabelas), [tiposDeConta, tabelas]);

  // Fechar e reabrir tem de começar limpo: o produto anterior ainda na tela,
  // com os preços do anterior nos campos, é o caminho curto para gravar o
  // preço certo no produto errado.
  useEffect(() => {
    if (aberto) return;
    setBusca("");
    setProduto(null);
    setLinhas(null);
    setDigitado({});
  }, [aberto]);

  /**
   * Os candidatos da busca.
   *
   * Código **e** nome: quem confere pedido procura por "4187", quem cadastra
   * procura por "Gomas Hair". Teto de 8 porque isto é um seletor, não uma lista.
   */
  const candidatos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo.length < 2) return [];
    return produtos
      .filter((p) => {
        const codigo = (p.product_code ?? "").toLowerCase();
        return codigo.includes(termo) || p.name.toLowerCase().includes(termo);
      })
      .slice(0, 8);
  }, [busca, produtos]);

  const escolherProduto = async (escolhido: Product) => {
    const codigo = (escolhido.product_code ?? "").trim();
    if (!codigo) {
      toast.error("Este produto não tem código cadastrado, então não dá para ter preço próprio.");
      return;
    }

    setProduto(escolhido);
    setCarregando(true);
    setLinhas(null);
    setDigitado({});

    try {
      // Uma consulta só para todos os escopos deste produto — e o recorte por
      // escopo é feito aqui, na memória. Uma consulta por escopo seriam seis
      // idas ao banco para trazer no máximo seis linhas.
      const { data, error } = await supabase
        .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
        .select("customer_type, proxis_tpr_id, price, active")
        .eq("product_code", codigo);

      if (error) throw error;

      const gravados = (data ?? []) as {
        customer_type: string;
        proxis_tpr_id: number | null;
        price: number | string;
        active: boolean;
      }[];

      const montadas = escopos.map<LinhaDePrecoDoProduto>((escopo) => {
        const achado = gravados.find((linha) =>
          escopo.tipo === "geral"
            ? linha.proxis_tpr_id === null && linha.customer_type === escopo.customerType
            : Number(linha.proxis_tpr_id) === escopo.tprId,
        );

        return {
          escopo,
          precoAtual: achado ? Number(achado.price) : null,
          ativo: achado ? Boolean(achado.active) : true,
        };
      });

      setLinhas(montadas);
      setDigitado(
        Object.fromEntries(montadas.map((l) => [chaveDoEscopo(l.escopo), formatarParaCampo(l.precoAtual)])),
      );
    } catch (erro) {
      console.error("[preços] falha ao carregar os escopos do produto", erro);
      toast.error("Não foi possível carregar os preços deste produto.");
      setProduto(null);
    } finally {
      setCarregando(false);
    }
  };

  const mudancas = linhas ? alteracoesDe(linhas, digitado) : [];

  const salvar = async () => {
    if (!produto || mudancas.length === 0) return;
    const codigo = (produto.product_code ?? "").trim();
    setSalvando(true);

    try {
      // Sequencial, e não `Promise.all`: são poucas linhas, e uma falha no meio
      // de um lote paralelo deixaria metade gravada sem dizer qual metade.
      for (const mudanca of mudancas) {
        const { escopo, preco } = mudanca;

        let consulta = supabase
          .from(CUSTOMER_PRICE_OVERRIDES_TABLE)
          .select("id")
          .eq("product_code", codigo);

        consulta =
          escopo.tipo === "geral"
            ? consulta.eq("customer_type", escopo.customerType).is("proxis_tpr_id", null)
            : consulta.eq("proxis_tpr_id", escopo.tprId);

        const { data: existente, error: erroLeitura } = await consulta.maybeSingle();
        if (erroLeitura) throw erroLeitura;

        const payload = {
          customer_type: escopo.customerType,
          proxis_tpr_id: escopo.tipo === "geral" ? null : escopo.tprId,
          product_code: codigo,
          price: preco,
          active: true,
        };

        const { error } = existente
          ? await supabase.from(CUSTOMER_PRICE_OVERRIDES_TABLE).update(payload).eq("id", existente.id)
          : await supabase.from(CUSTOMER_PRICE_OVERRIDES_TABLE).insert(payload);

        if (error) throw error;
      }

      toast.success(
        mudancas.length === 1
          ? `Preço salvo em 1 tabela.`
          : `Preços salvos em ${mudancas.length} tabelas.`,
      );
      onSalvo();
      onAbertoChange(false);
    } catch (erro) {
      console.error("[preços] falha ao salvar", erro);
      toast.error("Não foi possível salvar. Nenhuma alteração pela metade — confira e tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  const rotuloDoEscopo = (escopo: EscopoDePreco) =>
    escopo.tipo === "geral" ? escopo.rotulo : `${escopo.rotulo} · #${escopo.tprId}`;

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preço por produto</DialogTitle>
          <DialogDescription>
            Ache o produto pelo código ou pelo nome e ajuste o preço em todas as tabelas de uma vez.
          </DialogDescription>
        </DialogHeader>

        {!produto ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código ou nome do produto — ex.: 4187"
                className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            {busca.trim().length < 2 ? (
              <p className="px-1 text-xs text-muted-foreground">Digite ao menos dois caracteres.</p>
            ) : candidatos.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
            ) : (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70">
                {candidatos.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => void escolherProduto(p)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="mr-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                          {p.product_code || "sem código"}
                        </span>
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatBRL(getProductUnitPrice(p))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{produto.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Código {produto.product_code} · catálogo {formatBRL(getProductUnitPrice(produto))}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => setProduto(null)}>
                Trocar produto
              </Button>
            </div>

            {carregando || !linhas ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/70">
                {linhas.map((linha) => {
                  const chave = chaveDoEscopo(linha.escopo);
                  const alterado = mudancas.some((m) => chaveDoEscopo(m.escopo) === chave);

                  return (
                    <div
                      key={chave}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-b-0",
                        alterado && "bg-primary/[0.04]",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{rotuloDoEscopo(linha.escopo)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {linha.precoAtual === null ? (
                            // Sem preço próprio, quem manda é o preço de catálogo.
                            <>Sem preço próprio — usa {formatBRL(getProductUnitPrice(produto))} do catálogo</>
                          ) : (
                            <>Hoje: {formatBRL(linha.precoAtual)}</>
                          )}
                          {linha.escopo.tipo === "tabela" && !linha.escopo.ativa ? " · tabela desativada" : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {alterado ? (
                          <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/5 px-2 py-0 text-[0.625rem] text-primary">
                            alterado
                          </Badge>
                        ) : null}
                        <Input
                          value={digitado[chave] ?? ""}
                          onChange={(e) => setDigitado((atual) => ({ ...atual, [chave]: e.target.value }))}
                          inputMode="decimal"
                          placeholder="—"
                          aria-label={`Preço em ${rotuloDoEscopo(linha.escopo)}`}
                          className="h-10 w-28 rounded-xl text-right tabular-nums"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {mudancas.length === 0
                  ? "Campo em branco fica como está — nada é zerado."
                  : `${mudancas.length} ${mudancas.length === 1 ? "tabela será alterada" : "tabelas serão alteradas"}.`}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-10 rounded-2xl px-4" onClick={() => onAbertoChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="h-10 rounded-2xl px-5"
                  disabled={mudancas.length === 0 || salvando}
                  onClick={() => void salvar()}
                >
                  {salvando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
