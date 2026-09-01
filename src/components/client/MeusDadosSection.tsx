import { useState } from "react";
import { toast } from "sonner";
import { FileJson, ShieldCheck, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { useAuth } from "@/hooks/useAuth";
import { useMeusDados } from "@/hooks/useMeusDados";
import { BOM_DO_EXCEL } from "@/lib/csvDoTitular";
import {
  CHAVES_DO_PACOTE,
  contarRegistros,
  csvDaSecao,
  nomeDoArquivo,
  nomeDoArquivoDaSecao,
  serializarPacote,
  type ChaveDeSecao,
} from "@/lib/meusDados";

/**
 * O que a Clinic+ guarda sobre você, e o botão para levar embora.
 *
 * Atende dois direitos de uma vez: o art. 18, II (confirmação e acesso) pela
 * tela, e o art. 18, V (portabilidade) pelo arquivo. O art. 19, II ainda exige
 * declaração "clara e completa" — daí cada linha trazer a finalidade, e não só
 * a contagem.
 *
 * ## Uma seção de cada vez
 *
 * O único botão era "baixar tudo", e tudo era um JSON de sete seções aninhadas.
 * Quem queria conferir o endereço de entrega recebia o histórico inteiro de
 * pedidos junto, num formato que não abre em planilha. Agora cada linha baixa a
 * própria planilha, e o pacote inteiro continua existindo para quem vai levar os
 * dados para outro serviço — ver a nota de formato em `csvDoTitular.ts`.
 */
export function MeusDadosSection() {
  const { user } = useAuth();
  const { data: pacote, isLoading, error } = useMeusDados(user?.id ?? null, user?.email ?? null);
  /** Qual arquivo está sendo gerado — para desligar só o botão que foi clicado. */
  const [gerando, setGerando] = useState<string | null>(null);

  const baixar = (nome: string, conteudo: string, tipo: string, marca: string) => {
    setGerando(marca);

    try {
      const blob = new Blob([conteudo], { type: tipo });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Sem revogar, o blob fica na memória da aba até ela fechar.
      URL.revokeObjectURL(url);
      toast.success("Arquivo gerado. Confira a pasta de downloads.");
    } catch {
      toast.error("Não foi possível gerar o arquivo.");
    } finally {
      setGerando(null);
    }
  };

  const baixarTudo = () => {
    if (!pacote) return;
    baixar(nomeDoArquivo(), serializarPacote(pacote), "application/json", "tudo");
  };

  const baixarSecao = (chave: ChaveDeSecao) => {
    if (!pacote) return;
    baixar(
      nomeDoArquivoDaSecao(chave),
      // O marcador vai só no arquivo: sem ele o Excel abre "Endereço" como
      // "EndereÃ§o", porque assume a codificação do sistema.
      `${BOM_DO_EXCEL}${csvDaSecao(pacote, chave)}`,
      "text/csv;charset=utf-8",
      chave,
    );
  };

  const contagem = pacote ? contarRegistros(pacote) : null;
  const totalDeRegistros = contagem ? Object.values(contagem).reduce((soma, n) => soma + n, 0) : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ⚠️ Só o contador no cabeçalho.
          O padrão do painel — `AdminListaPadrao` — é cabeçalho com contador e
          ação dentro do cartão, junto do que ela muda. Aqui o botão "Baixar
          meus dados" estava no cabeçalho, longe da lista que ele exporta. */}
      <SectionHeader
        eyebrow="Privacidade"
        title="Meus dados"
        description="Tudo o que guardamos sobre você neste catálogo, e para que cada coisa serve."
        actions={
          pacote ? (
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[0.6875rem] font-medium">
              {totalDeRegistros} registro(s)
            </Badge>
          ) : null
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar seus dados agora. Tente de novo em instantes.
        </div>
      ) : pacote ? (
        <>
          <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-background/95 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/[0.15] px-4 py-3">
              <p className="text-[0.8125rem] text-muted-foreground">
                Baixe uma seção em planilha, ou tudo num arquivo só.
              </p>
              <Button
                type="button"
                onClick={baixarTudo}
                disabled={gerando !== null}
                className="h-9 gap-2 rounded-2xl px-4 text-[0.8125rem]"
              >
                <FileJson className="h-4 w-4" />
                Baixar tudo (JSON)
              </Button>
            </div>

            {CHAVES_DO_PACOTE.map((chave) => {
              const secao = pacote.secoes[chave];
              if (!secao) return null;
              const quantos = contagem?.[chave] ?? 0;

              return (
                <div
                  key={chave}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 p-4 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{secao.titulo}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{secao.finalidade}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                      {quantos}
                    </span>
                    {/* Desligado quando não há registro: um CSV só com o
                        cabeçalho parece arquivo quebrado, e a pessoa volta aqui
                        achando que o download falhou. */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-2xl px-3 text-xs"
                      disabled={quantos === 0 || gerando !== null}
                      onClick={() => baixarSecao(chave)}
                      title={quantos === 0 ? "Nada a exportar nesta seção" : `Baixar ${secao.titulo} em planilha`}
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      CSV
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-3 rounded-[1.25rem] bg-muted/40 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong className="font-medium text-foreground">CSV</strong> abre em Excel, Google Planilhas e
                LibreOffice, e traz as colunas legíveis de uma seção.{" "}
                <strong className="font-medium text-foreground">JSON</strong> traz tudo, inclusive os campos técnicos, e
                é o formato para levar seus dados a outro serviço — o que a lei chama de portabilidade.
              </p>
              <p>
                Nenhum dos dois inclui o que estiver apenas no ERP, sistema em que o pedido vira documento fiscal.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
