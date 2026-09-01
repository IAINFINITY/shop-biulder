import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, Hash, Mail, MapPin, MessageCircle, MessageSquare, Phone, RotateCcw, UserRound } from "lucide-react";
import { toast } from "sonner";

import { ChatComposer } from "@/components/support/ChatComposer";
import { ChatConversationList } from "@/components/support/ChatConversationList";
import { ChatMessageThread } from "@/components/support/ChatMessageThread";
import { NovaConversa } from "@/components/support/NovaConversa";
import { useAuth } from "@/hooks/useAuth";
import { useDetalhesDoCliente } from "@/hooks/useDetalhesDoCliente";
import { useLarguraDaLista, VARIAVEL_DA_LARGURA } from "@/hooks/useLarguraDaLista";
import {
  useCustomerSupportConversation,
  useFinalizarConversa,
  useSendSupportMessage,
  useSupportInbox,
  useSupportMessages,
} from "@/hooks/useSupportChat";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { estaFinalizada, iniciaisDoCliente } from "@/lib/caixaDeMensagens";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  const finalizar = useFinalizarConversa();
  const [confirmandoFim, setConfirmandoFim] = useState(false);
  const larguraDaLista = useLarguraDaLista();

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

  const encerrada = conversaAtiva ? estaFinalizada(conversaAtiva) : false;

  const { data: detalhes, isLoading: carregandoDetalhes } = useDetalhesDoCliente(
    conversaAtiva?.customer_user_id ?? null,
    conversaAtiva?.customer_cnpj ?? null,
    ehAdmin && detalhesAbertos && Boolean(conversaAtiva),
  );

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
    <>
    {/* `h-full min-h-0` e o que faz o chat ocupar tudo o que sobra entre a
        topbar e a borda de baixo. Sem o `min-h-0`, o filho rolavel estica o pai
        e a pagina inteira passa a rolar em vez do fio. */}
    <div className="relative flex h-full min-h-0 overflow-hidden border border-border bg-background text-foreground">
      {ehAdmin ? (
        <aside
          ref={larguraDaLista.alvo}
          style={{ [VARIAVEL_DA_LARGURA]: `${larguraDaLista.largura}px` } as CSSProperties}
          className={cn(
            "h-full min-h-0 w-full shrink-0 flex-col border-r border-border bg-card md:flex md:w-[var(--largura-lista)]",
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
            acaoNovaConversa={<NovaConversa onAbrirConversa={setSelecionadaId} />}
          />
        </aside>
      ) : null}

      {/* A barra de arraste — a alça que alarga a lista para ler nome de
          empresa inteiro.

          ⚠️ **Era 1px de `border/60` e ficou invisível.** Enquanto a lista era
          branca, aquele fio ainda se distinguia; com a zona de controles em
          cinza ele virou só mais uma borda, e ninguém acha o que não parece um
          controle. 1px também é alvo quase impossível de acertar com o mouse.

          Agora: 3px de largura visível, `bg-border` cheio, um sulco de pontos
          que aparece ao passar o mouse, e — o que resolve de fato — um `before`
          transparente que estende a área de clique para ~15px sem engordar o
          desenho. Alça fina de ver, larga de pegar.

          `hidden md:block`: no celular a lista ocupa a tela toda e não há o que
          redimensionar — uma alça ali só roubaria toque da rolagem. */}
      {ehAdmin ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar largura da lista"
          tabIndex={0}
          onPointerDown={larguraDaLista.aoPegar}
          onKeyDown={larguraDaLista.aoTeclar}
          onDoubleClick={larguraDaLista.reiniciar}
          title="Arraste para alargar a lista. Dois cliques volta ao padrão."
          className={cn(
            "group relative hidden w-[3px] shrink-0 cursor-col-resize bg-border transition-colors md:flex md:items-center md:justify-center",
            "before:absolute before:inset-y-0 before:-left-1.5 before:-right-1.5 before:content-['']",
            "hover:bg-primary/50 focus-visible:bg-primary focus-visible:outline-none",
            larguraDaLista.arrastando && "bg-primary",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "pointer-events-none flex h-8 w-[3px] flex-col items-center justify-center gap-[3px] rounded-full opacity-0 transition-opacity",
              "group-hover:opacity-100 group-focus-visible:opacity-100",
              larguraDaLista.arrastando && "opacity-100",
            )}
          >
            <span className="h-[3px] w-[3px] rounded-full bg-primary-foreground/80" />
            <span className="h-[3px] w-[3px] rounded-full bg-primary-foreground/80" />
            <span className="h-[3px] w-[3px] rounded-full bg-primary-foreground/80" />
          </span>
        </div>
      ) : null}

      <section
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background",
          ehAdmin && !conversaAtiva ? "hidden md:flex" : "flex",
        )}
      >
        {conversaAtiva ? (
          <>
            {/* Mesmo tom da zona de controles da lista: cabecalho e compositor
                sao a moldura, o fio de mensagens e o conteudo. Sem isso os tres
                eram brancos e o fio nao tinha comeco nem fim visivel. */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
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

              {/* O avatar amarra o cabeçalho à linha da lista: é o mesmo
                  círculo com as mesmas iniciais, e é o que diz "esta é aquela
                  conversa" sem precisar reler o nome. */}
              {ehAdmin ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {iniciaisDoCliente(conversaAtiva.customer_name)}
                </span>
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {ehAdmin
                    ? conversaAtiva.customer_company || "Atendimento ao cliente"
                    : "Falar com o consultor"}
                </p>

                {/* Clicar no nome abre os detalhes: é o gesto que quem atende
                    tenta primeiro, e até aqui ele não fazia nada. O botão
                    "Detalhes" continua ali para quem procura um botão. */}
                {ehAdmin ? (
                  <button
                    type="button"
                    onClick={() => setDetalhesAbertos((valor) => !valor)}
                    title="Ver dados do cliente"
                    className="block max-w-full truncate text-left text-lg font-semibold text-foreground hover:underline"
                  >
                    {conversaAtiva.customer_name || "Cliente"}
                  </button>
                ) : (
                  <h2 className="truncate text-lg font-semibold text-foreground">
                    {conversaAtiva.subject || "Atendimento"}
                  </h2>
                )}
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
                encerrada ? (
                  <button
                    type="button"
                    onClick={() => finalizar.mutate({ conversationId: conversaAtiva.id, finalizar: false, adminUserId: userId })}
                    disabled={finalizar.isPending}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reabrir
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmandoFim(true)}
                    disabled={finalizar.isPending}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Finalizar atendimento</span>
                    <span className="sm:hidden">Finalizar</span>
                  </button>
                )
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

            {/* O estado encerrado precisa aparecer no fio, e nao so na lista:
                quem abriu a conversa direto pelo link nao passou pela lista, e
                responderia sem saber que o atendimento ja tinha sido fechado. */}
            {encerrada ? (
              <div className="flex shrink-0 items-center gap-2 border-t border-border bg-success/5 px-4 py-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                <span className="min-w-0 flex-1">
                  Atendimento finalizado
                  {conversaAtiva.finalizada_em
                    ? ` em ${format(new Date(conversaAtiva.finalizada_em), "dd/MM 'às' HH:mm", { locale: ptBR })}`
                    : ""}
                  . {ehAdmin ? "Responder aqui reabre a conversa." : "Se precisar, é só escrever que a conversa reabre."}
                </span>
              </div>
            ) : null}

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
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
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

          {/* O tipo de conta vem primeiro porque muda o preco que a pessoa ve —
              e portanto muda a resposta que se da a ela. */}
          {detalhes?.tipoDeConta ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.6875rem] font-semibold capitalize text-primary">
              <UserRound className="h-3 w-3" />
              {detalhes.tipoDeConta}
              {detalhes.tabelaDePreco ? ` · tabela ${detalhes.tabelaDePreco}` : ""}
            </span>
          ) : null}

          {/* "Ja comprou?" e a segunda pergunta de quem atende, e a resposta
              mudava o tom da conversa inteira sem estar na tela. */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
              <p className="text-[0.625rem] text-muted-foreground">Pedidos</p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                {carregandoDetalhes ? "—" : (detalhes?.totalDePedidos ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
              <p className="text-[0.625rem] text-muted-foreground">Último</p>
              <p className="mt-0.5 truncate text-base font-semibold text-foreground">
                {detalhes?.ultimoPedidoEm
                  ? format(new Date(detalhes.ultimoPedidoEm), "dd/MM/yy", { locale: ptBR })
                  : "—"}
              </p>
            </div>
          </div>

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

            {detalhes?.email ? (
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-[0.6875rem] text-muted-foreground">E-mail</dt>
                  <dd className="break-words font-medium text-foreground">{detalhes.email}</dd>
                </div>
              </div>
            ) : null}

            {detalhes?.cidade ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-[0.6875rem] text-muted-foreground">Cidade</dt>
                  <dd className="break-words font-medium text-foreground">
                    {detalhes.cidade}
                    {detalhes.estado ? `/${detalhes.estado}` : ""}
                  </dd>
                </div>
              </div>
            ) : null}

            {detalhes?.clienteDesde ? (
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-[0.6875rem] text-muted-foreground">Cliente desde</dt>
                  <dd className="break-words font-medium text-foreground">
                    {format(new Date(detalhes.clienteDesde), "dd/MM/yyyy", { locale: ptBR })}
                  </dd>
                </div>
              </div>
            ) : null}
          </dl>
        </aside>
      ) : null}
    </div>

      <ConfirmActionDialog
        aberto={confirmandoFim}
        onAbertoChange={setConfirmandoFim}
        title="Finalizar este atendimento?"
        description={
          <>
            A conversa sai da caixa e vai para <strong>Finalizadas</strong>. O cliente recebe um aviso na plataforma
            dizendo que o atendimento foi concluído.
            <br />
            <br />
            Se ele responder depois, a conversa <strong>reabre sozinha</strong> e volta para a fila.
          </>
        }
        confirmLabel="Finalizar atendimento"
        processingLabel="Finalizando..."
        onConfirm={async () => {
          if (!conversaAtiva) return;
          await finalizar.mutateAsync({ conversationId: conversaAtiva.id, finalizar: true, adminUserId: userId });
          toast.success("Atendimento finalizado", { description: "O cliente foi avisado na plataforma." });
        }}
      />
    </>
  );
}
