import { useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, MailWarning, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import { useCadastrosPendentes } from "@/hooks/useCadastrosPendentes";
import { agruparPorEmpresa, type CadastroPendente } from "@/lib/cadastrosPendentes";
import { formatDocumentId } from "@/lib/brazilianIds";
import { cn } from "@/lib/utils";

/**
 * Quem se cadastrou e travou na confirmação de e-mail.
 *
 * ## Por que esta tela existe
 *
 * O perfil do cliente só nasce **depois** da confirmação. Antes disso a conta
 * existe, mas não aparece em lugar nenhum do painel — e o atendimento responde
 * "não encontrei esse cadastro" para alguém que se cadastrou de verdade.
 *
 * Aconteceu com a Opção de Vida: duas contas criadas no mesmo dia, nenhuma
 * confirmada, nenhuma visível. O suporte só descobriu consultando o banco.
 *
 * ## O que ela não mostra
 *
 * O link de confirmação. Ele é credencial de acesso — exibi-lo aqui faria a
 * lista virar um caminho para entrar na conta de terceiros. O reenvio manda a
 * mensagem para o e-mail cadastrado, e o link só existe na caixa da pessoa.
 */
/** Data curta, ou vazio quando não há o que mostrar. */
function dataCurta(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Linhas mostradas antes do "ver todos". Cabe na tela sem empurrar a lista de clientes. */
const LIMITE_VISIVEL = 5;

export function CadastrosPendentesSection({ comoAba = false }: { comoAba?: boolean }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  /**
   * Recolhida por padrao, e com um teto de linhas quando aberta.
   *
   * Esta secao fica **acima** da lista de clientes, que e o trabalho do dia a
   * dia. Com quatro pendentes ela e um aviso util; com cem, empurraria a lista
   * inteira para fora da tela toda vez que alguem abrisse a aba.
   *
   * O contador no cabecalho continua visivel fechada — que e a informacao que
   * importa quando nao ha ninguem esperando.
   */
  // Como aba ela **é** a tela: nasce aberta e sem teto de linhas. A versão
  // recolhida existia porque a seção morava acima da lista de clientes, e com
  // cem pendentes empurraria o trabalho do dia para fora da tela. Virando aba,
  // esse problema deixou de existir — e com ele o motivo de recolher.
  const [aberta, setAberta] = useState(comoAba);
  const [busca, setBusca] = useState("");
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const { data, isLoading, error, refetch } = useCadastrosPendentes();

  const pendentes = data ?? [];
  const grupos = agruparPorEmpresa(pendentes);

  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? pendentes.filter((p) =>
        [p.email, p.empresa, p.cnpj].some((campo) => campo.toLowerCase().includes(termo)),
      )
    : pendentes;
  // Com busca ativa, mostra tudo que casou: quem procurou um e-mail especifico
  // nao pode ter o resultado cortado por um teto pensado para navegacao.
  const visiveis = comoAba || mostrarTodos || termo ? filtrados : filtrados.slice(0, LIMITE_VISIVEL);
  const escondidos = filtrados.length - visiveis.length;

  const reenviar = async (item: CadastroPendente) => {
    setEnviando(item.email);
    try {
      const resposta = await apiFetch("/api/cadastros-pendentes", {
        method: "POST",
        body: JSON.stringify({ email: item.email }),
      });
      const corpo = (await resposta.json().catch(() => ({}))) as { detalhe?: string; error?: string };
      if (!resposta.ok) {
        toast.error(corpo.detalhe ?? corpo.error ?? "Não foi possível reenviar.");
        return;
      }
      setEnviados((atual) => new Set(atual).add(item.email));
      toast.success(`Confirmação reenviada para ${item.email}.`);
    } catch {
      toast.error("Não foi possível falar com o servidor.");
    } finally {
      setEnviando(null);
    }
  };

  return (
    <section
      className={
        comoAba
          ? // Dentro da aba ela já está no cartão da lista: mais uma moldura
            // seria caixa dentro de caixa.
            ""
          : "rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]"
      }
    >
      {/* O cabecalho inteiro abre e fecha. Fechada, a secao ocupa uma linha e
          ainda diz o numero — que e a informacao que importa quando nao ha
          ninguem esperando. */}
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        hidden={comoAba}
        className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MailWarning className="h-5 w-5 text-primary" />
          Cadastros aguardando confirmação
        </span>
        <span className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-3 py-1 text-[0.6875rem]",
              pendentes.length > 0
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-border/70",
            )}
          >
            {isLoading ? "…" : `${pendentes.length} pendente(s)`}
          </Badge>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", aberta && "rotate-180")} />
        </span>
      </button>

      {!aberta ? null : (
      <div className="mt-4">
        <p className="max-w-prose text-xs leading-5 text-muted-foreground">
          Estas contas existem, mas a pessoa ainda não clicou no link enviado por e-mail. Até
          confirmar, ela não consegue entrar e não aparece na aba Clientes.
        </p>

      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando…
        </p>
      ) : error ? (
        /* Falha de leitura não pode virar "não há ninguém pendente": alguém
           concluiria que o cadastro sumiu e mandaria a pessoa se cadastrar de
           novo — o que esbarra no e-mail já existente. */
        <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">Não foi possível consultar agora. A lista pode estar incompleta.</span>
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : pendentes.length === 0 ? (
        <p className="rounded-[1.25rem] bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Ninguém parado na confirmação.
        </p>
      ) : (
        <>
          {/* A busca so aparece quando ha o que procurar. Com quatro linhas ela
              seria ruido; com cem, e o unico jeito de achar o e-mail que o
              cliente acabou de ditar no telefone. */}
          {pendentes.length > LIMITE_VISIVEL ? (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por e-mail, empresa ou CNPJ"
                className="h-10 rounded-2xl border-border/70 bg-background pl-9 text-xs"
              />
            </div>
          ) : null}

          {filtrados.length === 0 ? (
            <p className="rounded-[1.25rem] bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              Nenhum cadastro pendente com "{busca.trim()}".
            </p>
          ) : null}

        <ul className="space-y-2">
          {visiveis.map((item) => {
            const doGrupo = grupos.get(item.cnpj.replace(/\D/g, "") || item.empresa.toLowerCase() || item.email) ?? [];
            const repetido = doGrupo.length > 1;
            const jaEnviado = enviados.has(item.email);

            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-border/70 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium text-foreground">{item.email}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {/* "e-mail enviado em 16/ago" separa dois problemas com
                        respostas opostas: nao enviamos (algo nosso quebrado) e
                        enviamos e nao chegou (spam, caixa cheia, endereco
                        errado). Sem isso o atendimento chuta. */}
                    {[
                      item.empresa || "sem empresa",
                      item.cnpj ? formatDocumentId(item.cnpj) : null,
                      item.diasParado === 0 ? "criado hoje" : `criado há ${item.diasParado} dia(s)`,
                      dataCurta(item.enviadoEm)
                        ? `e-mail enviado em ${dataCurta(item.enviadoEm)}`
                        : "e-mail não consta como enviado",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                {/* Duas contas da mesma empresa é sinal de que a mensagem não
                    está chegando — não de esquecimento. Foi o padrão da Opção
                    de Vida, e soltas na lista ninguém relaciona as duas. */}
                {repetido ? (
                  <Badge
                    variant="outline"
                    title="Esta empresa criou mais de um cadastro, e nenhum foi confirmado — provável que o e-mail não esteja chegando. Não tem relação com tentativas de login."
                    className="shrink-0 rounded-full border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[0.625rem] text-amber-900"
                  >
                    {doGrupo.length} cadastros
                  </Badge>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs", jaEnviado && "text-muted-foreground")}
                  disabled={enviando === item.email}
                  onClick={() => void reenviar(item)}
                >
                  {enviando === item.email ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {jaEnviado ? "Reenviar de novo" : "Reenviar confirmação"}
                </Button>
              </li>
            );
          })}
        </ul>

        {escondidos > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-9 w-full rounded-full text-xs"
            onClick={() => setMostrarTodos(true)}
          >
            Ver os outros {escondidos}
          </Button>
        ) : null}
        </>
      )}

      <p className="mt-4 text-[0.6875rem] leading-5 text-muted-foreground">
        Antes de reenviar, vale pedir para a pessoa procurar em <strong>spam</strong> — é para onde a
        mensagem costuma ir. O reenvio vai sempre para o e-mail cadastrado, e o link aparece só na
        caixa dela.
      </p>
      </div>
      )}
    </section>
  );
}
