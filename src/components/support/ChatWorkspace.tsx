import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Hash, MessageCircle, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";

import { ChatComposer } from "@/components/support/ChatComposer";
import { ChatConversationList } from "@/components/support/ChatConversationList";
import { ChatMessageThread } from "@/components/support/ChatMessageThread";
import { useAuth } from "@/hooks/useAuth";
import {
  useCustomerSupportConversation,
  useSendSupportMessage,
  useSupportInbox,
  useSupportMessages,
} from "@/hooks/useSupportChat";
import { formatDocumentId } from "@/lib/brazilianIds";
import { REPRESENTATIVE_PHONE_DISPLAY, REPRESENTATIVE_PHONE_WHATSAPP_URL } from "@/lib/supportContact";
import type { SupportConversation } from "@/lib/supportChat";
import { cn } from "@/lib/utils";

/**
 * O atendimento interno, nos dois lados.
 *
 * Layout copiado do chat de `pamela_crm`: coluna de conversas a esquerda, fio no
 * centro com cabecalho proprio, painel de detalhes a direita. No celular as
 * colunas viram telas — a lista some quando uma conversa abre, e um "Voltar"
 * traz de volta.
 *
 * O que existia era um painel unico que tentava servir cliente e admin com a
 * mesma tela e nao ocupava a altura disponivel: o fio rolava dentro de uma caixa
 * baixa enquanto sobrava area em volta.
 *
 * A diferenca entre os dois modos e so quantas conversas existem. O cliente tem
 * **uma** — a dele com o consultor — entao a coluna da esquerda nao aparece:
 * uma lista de um item so e moldura sem conteudo.
 */
export function ChatWorkspace({ mode }: { mode: "customer" | "admin" }) {
  const { user, customerProfile } = useAuth();
  const userId = user?.id ?? null;
  const ehAdmin = mode === "admin";

  // Sem perfil de cliente nao existe conversa a criar: a RPC
  // `ensure_support_conversation` levanta "Perfil de cliente nao encontrado" e a
  // consulta falha. Como ela reconsulta a cada 5s, deixar ligada era bater numa
  // porta fechada para sempre — e a tela ficava em "Carregando" sem fim, porque
  // o erro nunca era lido.
  const temPerfil = Boolean(customerProfile);
  const { data: conversaDoCliente, isLoading: carregandoCliente } = useCustomerSupportConversation(
    userId,
    !ehAdmin && Boolean(userId) && temPerfil,
  );
  const { data: caixaDeEntrada = [], isLoading: carregandoCaixa } = useSupportInbox(ehAdmin);

  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  // Abre a primeira conversa sozinho — **so no desktop**.
  //
  // No celular as duas colunas nao cabem lado a lado: a lista some quando ha
  // conversa aberta. Com a selecao automatica, o admin caia direto numa conversa
  // e nunca via a lista — e o "Voltar" levava a uma tela que ele nao sabia que
  // existia. No desktop a lista continua a vista, entao abrir a primeira poupa
  // um clique em vez de esconder algo.
  useEffect(() => {
    if (!ehAdmin || selecionadaId || caixaDeEntrada.length === 0) return;
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches) return;
    setSelecionadaId(caixaDeEntrada[0].id);
  }, [caixaDeEntrada, ehAdmin, selecionadaId]);

  const conversaAtiva: SupportConversation | null = useMemo(() => {
    if (!ehAdmin) return conversaDoCliente ?? null;
    return caixaDeEntrada.find((conversa) => conversa.id === selecionadaId) ?? null;
  }, [caixaDeEntrada, conversaDoCliente, ehAdmin, selecionadaId]);

  const { data: mensagens = [], isLoading: carregandoMensagens } = useSupportMessages(
    conversaAtiva?.id ?? null,
    Boolean(conversaAtiva?.id),
  );
  const enviar = useSendSupportMessage();

  const aoEnviar = async (texto: string) => {
    if (!conversaAtiva?.id || !userId) return;
    try {
      await enviar.mutateAsync({
        conversationId: conversaAtiva.id,
        senderUserId: userId,
        senderRole: mode,
        body: texto,
      });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível enviar a mensagem.");
      throw erro;
    }
  };

  const carregandoFio = ehAdmin ? carregandoMensagens : carregandoCliente || carregandoMensagens;

  return (
    // `h-full min-h-0` e o que faz o chat ocupar tudo o que sobra entre a topbar
    // e a borda de baixo. Sem o `min-h-0`, o filho rolavel estica o pai e a
    // pagina inteira passa a rolar em vez do fio.
    <div className="relative flex h-full min-h-0 overflow-hidden border border-border bg-background text-foreground">
      {ehAdmin ? (
        <aside
          className={cn(
            "h-full min-h-0 w-full shrink-0 flex-col border-r border-border bg-card md:flex md:w-[330px]",
            conversaAtiva ? "hidden md:flex" : "flex",
          )}
        >
          <ChatConversationList
            conversas={caixaDeEntrada}
            selecionadaId={conversaAtiva?.id ?? null}
            onSelecionar={(conversa) => {
              setSelecionadaId(conversa.id);
              setDetalhesAbertos(false);
            }}
            carregando={carregandoCaixa}
          />
        </aside>
      ) : null}

      <section
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background",
          ehAdmin && !conversaAtiva ? "hidden md:flex" : "flex",
        )}
      >
        {conversaAtiva ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
              {ehAdmin ? (
                <button
                  type="button"
                  onClick={() => setSelecionadaId(null)}
                  className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground md:hidden"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {ehAdmin ? "Atendimento ao cliente" : "Falar com o consultor"}
                </p>
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {ehAdmin ? conversaAtiva.customer_name || "Cliente" : conversaAtiva.subject || "Atendimento"}
                </h2>
              </div>

              {/* O atalho do consultor vivia num cartao acima do chat, que roubava
                  altura do fio. Aqui ele continua a um clique e nao custa area. */}
              {!ehAdmin ? (
                <a
                  href={REPRESENTATIVE_PHONE_WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {REPRESENTATIVE_PHONE_DISPLAY}
                </a>
              ) : null}

              {ehAdmin ? (
                <button
                  type="button"
                  onClick={() => setDetalhesAbertos((valor) => !valor)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    detalhesAbertos
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-secondary",
                  )}
                >
                  Detalhes
                </button>
              ) : null}
            </div>

            <ChatMessageThread
              mensagens={mensagens}
              meuPapel={mode}
              carregando={carregandoFio}
              vazioDescricao={
                ehAdmin
                  ? "Escreva abaixo para iniciar o atendimento."
                  : "Escreva abaixo e um consultor responde por aqui."
              }
            />

            <ChatComposer
              onEnviar={aoEnviar}
              placeholder={ehAdmin ? "Responder ao cliente..." : "Escreva sua mensagem..."}
            />
          </>
        ) : ehAdmin ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <MessageCircle className="h-10 w-10 opacity-30" />
            <p className="text-sm">Selecione uma conversa para começar.</p>
          </div>
        ) : (
          /* Cliente sem conversa ve o **layout**, e nao uma tela de espera.

             A conversa so nasce quando ha perfil de cliente, e quem ainda nao
             completou o cadastro nunca ia sair do "Carregando". Mostrar a mesma
             moldura — cabecalho, fio e caixa de escrever — deixa claro o que a
             tela e, e o motivo de nao dar para escrever aparece no lugar das
             mensagens em vez de esconder tudo. */
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Falar com o consultor
                </p>
                <h2 className="truncate text-lg font-semibold text-foreground">Atendimento</h2>
              </div>
              <a
                href={REPRESENTATIVE_PHONE_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex"
              >
                <Phone className="h-3.5 w-3.5" />
                {REPRESENTATIVE_PHONE_DISPLAY}
              </a>
            </div>

            {carregandoCliente ? (
              <div className="flex-1 space-y-3 overflow-hidden p-4">
                <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-muted" />
                <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-muted" />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  {temPerfil ? "Não foi possível abrir o atendimento" : "Complete seu cadastro para conversar"}
                </h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {temPerfil
                    ? "Tente de novo em instantes. Se continuar, use o contato do consultor acima."
                    : "O atendimento fica disponível assim que os dados do cliente estiverem no cadastro. Você encontra o formulário na seção Empresa."}
                </p>
              </div>
            )}

            <ChatComposer
              onEnviar={aoEnviar}
              desabilitado
              placeholder={
                temPerfil ? "Atendimento indisponível no momento" : "Complete o cadastro para enviar mensagens"
              }
            />
          </>
        )}
      </section>

      {ehAdmin && detalhesAbertos && conversaAtiva ? (
        <aside className="absolute inset-0 z-20 overflow-y-auto border-l border-border bg-card p-4 lg:static lg:z-auto lg:w-[300px] lg:shrink-0">
          {/* No celular ele cobre o fio, em vez de nao existir: era `hidden
              lg:block`, e o botao "Detalhes" simplesmente nao fazia nada. */}
          <button
            type="button"
            onClick={() => setDetalhesAbertos(false)}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar à conversa
          </button>
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Dados do cliente
          </p>
          <h3 className="mt-1 text-base font-semibold text-foreground">
            {conversaAtiva.customer_name || "Cliente"}
          </h3>

          <dl className="mt-4 space-y-3 text-sm">
            {conversaAtiva.customer_company ? (
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-[0.6875rem] text-muted-foreground">Empresa</dt>
                  <dd className="break-words font-medium text-foreground">{conversaAtiva.customer_company}</dd>
                </div>
              </div>
            ) : null}

            {conversaAtiva.customer_cnpj ? (
              <div className="flex items-start gap-2">
                <Hash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-[0.6875rem] text-muted-foreground">CNPJ</dt>
                  <dd className="break-words font-medium text-foreground">
                    {formatDocumentId(conversaAtiva.customer_cnpj)}
                  </dd>
                </div>
              </div>
            ) : null}

            {conversaAtiva.customer_phone ? (
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-[0.6875rem] text-muted-foreground">Telefone</dt>
                  <dd className="break-words font-medium text-foreground">{conversaAtiva.customer_phone}</dd>
                </div>
              </div>
            ) : null}
          </dl>
        </aside>
      ) : null}
    </div>
  );
}
