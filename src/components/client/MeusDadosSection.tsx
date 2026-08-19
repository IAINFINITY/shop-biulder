import { useState } from "react";
import { toast } from "sonner";
import { Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientSectionHeader } from "@/components/client/ClientSectionHeader";
import { useAuth } from "@/hooks/useAuth";
import { useMeusDados } from "@/hooks/useMeusDados";
import { contarRegistros, nomeDoArquivo, serializarPacote } from "@/lib/meusDados";

/**
 * O que a Clinic+ guarda sobre você, e o botão para levar embora.
 *
 * Atende dois direitos de uma vez: o art. 18, II (confirmação e acesso) pela
 * tela, e o art. 18, V (portabilidade) pelo arquivo. O art. 19, II ainda exige
 * declaração "clara e completa" — daí cada linha trazer a finalidade, e não só
 * a contagem.
 *
 * Chama atenção que a exclusão, que é o direito mais difícil de implementar,
 * já existia, e o acesso, que é o mais simples, não. Esta seção fecha isso.
 */
export function MeusDadosSection() {
  const { user } = useAuth();
  const { data: pacote, isLoading, error } = useMeusDados(user?.id ?? null, user?.email ?? null);
  const [baixando, setBaixando] = useState(false);

  const baixar = () => {
    if (!pacote) return;
    setBaixando(true);

    try {
      const blob = new Blob([serializarPacote(pacote)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeDoArquivo();
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Sem revogar, o blob fica na memória da aba até ela fechar.
      URL.revokeObjectURL(url);
      toast.success("Arquivo gerado. Confira a pasta de downloads.");
    } catch {
      toast.error("Não foi possível gerar o arquivo.");
    } finally {
      setBaixando(false);
    }
  };

  const contagem = pacote ? contarRegistros(pacote) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <ClientSectionHeader
        eyebrow="Privacidade"
        title="Meus dados"
        description="Tudo o que guardamos sobre você neste catálogo, e o que cada coisa serve."
        actions={
          <Button type="button" onClick={baixar} disabled={!pacote || baixando} className="gap-2">
            <Download className="h-4 w-4" />
            Baixar meus dados
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar seus dados agora. Tente de novo em instantes.
        </div>
      ) : pacote ? (
        <>
          <div className="overflow-hidden rounded-xl bg-background/95 ring-1 ring-black/5 shadow-sm">
            {Object.entries(pacote.secoes).map(([chave, secao]) => (
              <div
                key={chave}
                className="flex items-start justify-between gap-4 border-b border-border/60 p-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{secao.titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{secao.finalidade}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {contagem?.[chave] ?? 0}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs leading-relaxed text-muted-foreground">
              O arquivo sai em JSON, formato que outro sistema consegue ler — é o que a lei chama de
              portabilidade. Ele não inclui o que estiver apenas no ERP, onde o pedido vira documento fiscal.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
