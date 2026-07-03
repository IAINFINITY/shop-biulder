import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquareText, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  useCustomerSupportConversation,
  useSendSupportMessage,
  useSetInternalStaffRole,
  useSupportInbox,
  useSupportMessages,
  useUpdateSupportConversationTyping,
} from "@/hooks/useSupportChat";
import {
  formatSupportConversationTitle,
  formatSupportLastMessagePreview,
  isTypingRecently,
  type SupportConversation,
  type InternalStaffRole,
} from "@/lib/supportChat";

type SupportChatPanelProps = {
  mode: "customer" | "admin";
};

function getInitials(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return "?";

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/80 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/80 [animation-delay:0s]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/80 [animation-delay:0.2s]" />
    </span>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function MessageBubble({
  body,
  createdAt,
  owner,
  senderLabel,
}: {
  body: string;
  createdAt: string;
  owner: "self" | "other";
  senderLabel: string;
}) {
  const isSelf = owner === "self";

  return (
    <div className={cn("flex items-end gap-3", isSelf ? "justify-end" : "justify-start")}>
      {!isSelf ? (
        <Avatar className="h-11 w-11 shrink-0 border border-border/70 bg-background shadow-sm">
          <AvatarFallback className="bg-primary/5 text-xs font-semibold text-primary">
            {getInitials(senderLabel)}
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div
        className={cn(
          "max-w-[min(34rem,86%)] rounded-[1.5rem] border px-4 py-3 text-sm shadow-sm transition-shadow sm:max-w-[80%]",
          isSelf
            ? "border-primary/10 bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(174,19,21,0.12)]"
            : "border-border/70 bg-background text-foreground shadow-[0_12px_28px_rgba(15,23,42,0.05)]",
        )}
      >
        <div className={cn("flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]", isSelf ? "justify-end" : "justify-start")}>
          <span>{senderLabel}</span>
          <span className={cn("inline-flex h-1.5 w-1.5 rounded-full", isSelf ? "bg-primary-foreground/80" : "bg-primary") } />
        </div>
        <p className="whitespace-pre-wrap break-words leading-6">{body}</p>
        <p className={cn("mt-2 text-[11px]", isSelf ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {formatTime(createdAt)}
        </p>
      </div>

      {isSelf ? (
        <Avatar className="h-11 w-11 shrink-0 border border-primary/10 bg-primary/5 shadow-sm">
          <AvatarFallback className="bg-primary/5 text-xs font-semibold text-primary">
            {getInitials(senderLabel)}
          </AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}

function ConversationCard({
  conversation,
  active,
  onClick,
}: {
  conversation: SupportConversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[1.15rem] border p-3 text-left transition-all duration-200 hover:bg-muted/35",
        active
          ? "border-primary/20 bg-primary/5 shadow-[0_8px_20px_rgba(174,19,21,0.07)]"
          : "border-border/70 bg-background",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0 border border-border/70 bg-background">
          <AvatarFallback className="bg-primary/5 text-xs font-semibold text-primary">
            {getInitials(conversation.customer_company || conversation.customer_name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{formatSupportConversationTitle(conversation)}</p>
              <p className="truncate text-xs text-muted-foreground">{conversation.customer_name}</p>
            </div>
            <span className="flex-shrink-0 text-[11px] text-muted-foreground">{formatTime(conversation.last_message_at)}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
            {formatSupportLastMessagePreview(conversation)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={conversation.status === "open" ? "default" : "secondary"} className="rounded-full px-2.5 py-0.5 text-[10px]">
              {conversation.status === "open" ? "Aberta" : conversation.status === "closed" ? "Fechada" : "Arquivada"}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  );
}

function CustomerConversationSummary({ conversation }: { conversation: SupportConversation }) {
  return (
    <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 p-3 shadow-[0_8px_20px_rgba(174,19,21,0.06)]">
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0 border border-primary/10 bg-background">
          <AvatarFallback className="bg-primary/5 text-xs font-semibold text-primary">
            {getInitials(conversation.customer_company || conversation.customer_name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{formatSupportConversationTitle(conversation)}</p>
              <p className="truncate text-xs text-muted-foreground">{conversation.subject}</p>
            </div>
            <span className="flex-shrink-0 text-[11px] text-muted-foreground">{formatTime(conversation.last_message_at)}</span>
          </div>

          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {formatSupportLastMessagePreview(conversation)}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <Badge variant={conversation.status === "open" ? "default" : "secondary"} className="rounded-full px-2.5 py-0.5 text-[10px]">
              {conversation.status === "open" ? "Aberta" : conversation.status === "closed" ? "Fechada" : "Arquivada"}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function InternalStaffManager({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InternalStaffRole>("consultor");
  const roleMutation = useSetInternalStaffRole();

  const handleSave = async () => {
    if (!email.trim()) return;
    await roleMutation.mutateAsync({ email, role });
    setEmail("");
  };

  return (
    <div className={compact ? "space-y-4" : "rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-sm"}>
      {!compact ? (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Papéis internos</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Defina quem entra como consultor, representante ou admin de atendimento.
          </p>
        </div>
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] text-primary">
          Admin
        </Badge>
      </div>
      ) : null}

      <div className={cn("grid gap-3", compact ? "lg:grid-cols-[1fr_220px_auto]" : "mt-4 lg:grid-cols-[1fr_220px_auto]")}>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@empresa.com"
          className="h-11 rounded-2xl border-border/70 bg-background"
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as InternalStaffRole)}
          className="h-11 rounded-2xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <option value="consultor">Consultor</option>
          <option value="representante">Representante</option>
          <option value="admin_atendimento">Admin atendimento</option>
          <option value="admin">Admin</option>
          <option value="user">Cliente</option>
        </select>

        <Button
          type="button"
          className="h-11 rounded-2xl px-5"
          disabled={roleMutation.isPending || !email.trim()}
          onClick={handleSave}
        >
          {roleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar papel"}
        </Button>
      </div>

      {!compact ? (
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Dica: use o mesmo e-mail da conta interna e escolha o papel adequado antes de salvar.
        </p>
      ) : null}
    </div>
  );
}

export function SupportChatPanel({ mode }: SupportChatPanelProps) {
  const { user, isAdmin } = useAuth();
  const currentUserId = user?.id ?? null;
  const currentRole = isAdmin ? "admin" : "customer";
  const { data: customerConversation, isLoading: customerConversationLoading, refetch: refetchCustomerConversation } =
    useCustomerSupportConversation(currentUserId, mode === "customer" && Boolean(currentUserId));
  const { data: inboxConversations = [], isLoading: inboxLoading } = useSupportInbox(mode === "admin" && isAdmin);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [inboxSearch, setInboxSearch] = useState("");
  const sendMutation = useSendSupportMessage();
  const typingMutation = useUpdateSupportConversationTyping();
  const typingTimerRef = useRef<number | null>(null);
  const typingStateRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const [internalStaffDialogOpen, setInternalStaffDialogOpen] = useState(false);

  const filteredInboxConversations = useMemo(() => {
    const term = inboxSearch.trim().toLowerCase();
    if (!term) return inboxConversations;

    return inboxConversations.filter((conversation) =>
      [
        conversation.customer_name,
        conversation.customer_company ?? "",
        conversation.customer_cnpj ?? "",
        conversation.subject,
        conversation.last_message_preview ?? "",
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [inboxConversations, inboxSearch]);

  const selectedConversation = useMemo(() => {
    if (mode === "customer") return customerConversation ?? null;
    return filteredInboxConversations.find((conversation) => conversation.id === selectedConversationId) ?? filteredInboxConversations[0] ?? null;
  }, [customerConversation, filteredInboxConversations, mode, selectedConversationId]);

  const { data: messages = [], isLoading: messagesLoading } = useSupportMessages(
    selectedConversation?.id ?? null,
    Boolean(selectedConversation?.id),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mode === "customer" && customerConversation?.id) {
      setSelectedConversationId(customerConversation.id);
    }
  }, [customerConversation?.id, mode]);

  useEffect(() => {
    if (mode === "admin" && !selectedConversationId && filteredInboxConversations[0]?.id) {
      setSelectedConversationId(filteredInboxConversations[0].id);
    }
  }, [filteredInboxConversations, mode, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversation?.id || !currentUserId) return;

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      if (typingStateRef.current) {
        typingStateRef.current = false;
        void typingMutation.mutateAsync({
          conversationId: selectedConversation.id,
          typingRole: currentRole,
          isTyping: false,
        });
      }
      return;
    }

    typingTimerRef.current = window.setTimeout(() => {
      if (!typingStateRef.current) {
        typingStateRef.current = true;
        void typingMutation.mutateAsync({
          conversationId: selectedConversation.id,
          typingRole: currentRole,
          isTyping: true,
        });
      }
    }, 400);

    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
  }, [currentRole, currentUserId, draft, selectedConversation?.id, typingMutation]);

  useEffect(() => {
    typingStateRef.current = false;
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }
  }, [selectedConversation?.id]);

  const sendDisabled = sendMutation.isPending || !draft.trim() || !selectedConversation?.id || !currentUserId;

  const handleSend = async () => {
    if (!selectedConversation?.id || !currentUserId) return;
    await sendMutation.mutateAsync({
      conversationId: selectedConversation.id,
      senderUserId: currentUserId,
      senderRole: currentRole,
      body: draft,
    });
    typingStateRef.current = false;
    void typingMutation.mutateAsync({
      conversationId: selectedConversation.id,
      typingRole: currentRole,
      isTyping: false,
    });
    setDraft("");
    if (mode === "customer") {
      await refetchCustomerConversation();
    }
  };

  const isCustomerMode = mode === "customer";
  const otherTypingAt = isCustomerMode ? selectedConversation?.admin_typing_at : selectedConversation?.customer_typing_at;
  const otherTypingLabel = isCustomerMode ? "Consultor digitando..." : "Cliente digitando...";
  const isOtherTyping = selectedConversation ? isTypingRecently(otherTypingAt, now) : false;

  return (
    <div
      className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 overflow-hidden"
      style={{ height: "min(90vh, 64rem)" }}
    >
      <section className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4 shrink-0">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[12px]">
            {isCustomerMode ? "Chat interno" : "Inbox interno"}
          </p>
          <h2 className="text-[clamp(1.1rem,1.6vw,1.65rem)] font-bold leading-[1.12] tracking-[-0.03em] text-foreground">
            {isCustomerMode ? "Fale com seu consultor" : "Conversas com clientes"}
          </h2>
          <p className="max-w-3xl text-[13px] leading-6 text-muted-foreground sm:text-[14px]">
            {isCustomerMode
              ? "Este é o canal oficial para tirar dúvidas, receber orientações e acompanhar seu atendimento com o time interno."
              : "Cada conversa fica vinculada ao cliente, ao CNPJ e ao contexto do pedido para facilitar o atendimento do time interno."}
          </p>
        </div>
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
          {isCustomerMode ? "Representante interno" : "Equipe administrativa"}
        </Badge>
      </section>

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[18.5rem_minmax(0,1fr)] overflow-hidden">
          {isCustomerMode ? (
            <>
              <div className="flex h-full min-h-0 flex-col space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-sm">
                <div className="flex min-h-[3.5rem] items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-5 w-5 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground">Conversa ativa</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          A conversa é criada automaticamente para sua conta.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="flex h-8 min-w-[4.5rem] shrink-0 items-center justify-center rounded-full border-border/70 bg-background px-2 text-[10px] font-medium tabular-nums text-muted-foreground"
                  >
                    {customerConversationLoading ? "..." : selectedConversation ? "1 conversa" : "0 conversa"}
                  </Badge>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                  {customerConversationLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-[104px] rounded-[1.25rem]" />
                      <Skeleton className="h-[104px] rounded-[1.25rem]" />
                    </div>
                  ) : selectedConversation ? (
                    <CustomerConversationSummary conversation={selectedConversation} />
                  ) : (
                    <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-5 text-sm text-muted-foreground">
                      Não foi possível abrir sua conversa agora. Tente recarregar a página.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex h-full min-h-0 flex-col rounded-[2rem] border border-border/70 bg-background p-5 shadow-[0_18px_50px_rgba(16,24,40,0.08)]">
                <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {selectedConversation ? formatSupportConversationTitle(selectedConversation) : "Selecione uma conversa"}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">
                      {selectedConversation?.subject || "Nenhum atendimento selecionado"}
                    </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedConversation ? formatTime(selectedConversation.last_message_at) : "Sem atividade"}
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
                  {selectedConversation ? (
                    <>
                      <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto rounded-[1.75rem] border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,1))] p-4">
                        {messagesLoading ? (
                          <div className="space-y-3">
                            <Skeleton className="h-16 rounded-[1.2rem]" />
                            <Skeleton className="h-16 rounded-[1.2rem]" />
                            <Skeleton className="h-16 rounded-[1.2rem]" />
                          </div>
                        ) : messages.length > 0 ? (
                          <div className="flex w-full flex-col gap-4 px-1 sm:px-2 lg:px-4">
                            {messages.map((message) => (
                              <MessageBubble
                                key={message.id}
                                body={message.body}
                                createdAt={message.created_at}
                                owner={message.sender_user_id === currentUserId ? "self" : "other"}
                                senderLabel={message.sender_user_id === currentUserId ? "Você" : "Consultor"}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="flex min-h-[14rem] items-center justify-center rounded-[1rem] border border-dashed border-border/70 bg-background text-sm text-muted-foreground">
                            Ainda não há mensagens nesta conversa.
                          </div>
                        )}
                        {isOtherTyping ? (
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Avatar className="h-8 w-8 border border-border/70 bg-background">
                              <AvatarFallback className="bg-primary/5 text-[10px] font-semibold text-primary">
                                C
                              </AvatarFallback>
                            </Avatar>
                            <span>{otherTypingLabel}</span>
                            <TypingDots />
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3 border-t border-border/70 pt-3 xl:mt-auto">
                        <Textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (!sendDisabled) {
                                void handleSend();
                              }
                            }
                          }}
                          placeholder="Escreva sua mensagem para o consultor..."
                          className="min-h-[78px] rounded-[1.35rem] border-border/70 bg-background px-4 py-3 text-sm shadow-sm"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-[11px] leading-5 text-muted-foreground">
                            Use este canal para falar com seu representante interno e acompanhar o atendimento.
                          </p>
                          <Button type="button" className="gap-2 rounded-full px-5" disabled={sendDisabled} onClick={handleSend}>
                            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Enviar
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center">
                      <MessageSquareText className="h-10 w-10 text-primary/70" />
                      <p className="text-sm font-medium text-foreground">Nenhuma conversa selecionada</p>
                      <p className="max-w-md text-sm leading-6 text-muted-foreground">
                        Sua conversa será carregada automaticamente quando o perfil estiver pronto.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-full min-h-0 flex-col space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-sm">
                <div className="flex min-h-[3.5rem] items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 flex-shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground">Caixa de entrada</p>
                        <p className="text-xs leading-5 text-muted-foreground">Selecione uma conversa para responder.</p>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="flex h-8 min-w-[4.5rem] shrink-0 items-center justify-center rounded-full border-border/70 bg-background px-2 text-[10px] font-medium tabular-nums text-muted-foreground"
                  >
                    {inboxConversations.length}
                  </Badge>
                </div>

                <Input
                  placeholder="Buscar cliente, empresa ou CNPJ"
                  className="h-11 rounded-2xl border-border/70 bg-background"
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                />

                <div className="flex-1 overflow-y-auto pr-1">
                  {inboxLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-[88px] rounded-[1.25rem]" />
                      <Skeleton className="h-[88px] rounded-[1.25rem]" />
                    </div>
                  ) : filteredInboxConversations.length > 0 ? (
                    <div className="space-y-2.5">
                      {filteredInboxConversations.map((conversation) => (
                        <ConversationCard
                          key={conversation.id}
                          conversation={conversation}
                          active={conversation.id === selectedConversation?.id}
                          onClick={() => setSelectedConversationId(conversation.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-5 text-sm text-muted-foreground">
                      Ainda não há conversas abertas. Quando um cliente iniciar contato, elas vão aparecer aqui.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex h-full min-h-0 flex-col rounded-[2rem] border border-border/70 bg-background p-5 shadow-[0_18px_50px_rgba(16,24,40,0.08)]">
                <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {selectedConversation ? formatSupportConversationTitle(selectedConversation) : "Selecione uma conversa"}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">
                      {selectedConversation?.subject || "Nenhum atendimento selecionado"}
                    </h3>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant={selectedConversation?.status === "open" ? "default" : "secondary"} className="rounded-full px-3 py-1 text-[11px]">
                        {selectedConversation ? (selectedConversation.status === "open" ? "Aberta" : selectedConversation.status === "closed" ? "Fechada" : "Arquivada") : "—"}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-full px-4 text-sm"
                        onClick={() => setInternalStaffDialogOpen(true)}
                      >
                        Papéis internos
                      </Button>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {selectedConversation ? formatTime(selectedConversation.last_message_at) : "Sem atividade"}
                    </span>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
                  {selectedConversation ? (
                    <>
                      <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto rounded-[1.75rem] border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,1))] p-4">
                        {messagesLoading ? (
                          <div className="space-y-3">
                            <Skeleton className="h-16 rounded-[1.2rem]" />
                            <Skeleton className="h-16 rounded-[1.2rem]" />
                            <Skeleton className="h-16 rounded-[1.2rem]" />
                          </div>
                        ) : messages.length > 0 ? (
                          <div className="flex w-full flex-col gap-4 px-1 sm:px-2 lg:px-4">
                            {messages.map((message) => (
                              <MessageBubble
                                key={message.id}
                                body={message.body}
                                createdAt={message.created_at}
                                owner={message.sender_user_id === currentUserId ? "self" : "other"}
                                senderLabel={message.sender_user_id === currentUserId ? (isCustomerMode ? "Você" : "Equipe") : isCustomerMode ? "Consultor" : "Cliente"}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="flex min-h-[14rem] items-center justify-center rounded-[1rem] border border-dashed border-border/70 bg-background text-sm text-muted-foreground">
                            Ainda não há mensagens nesta conversa.
                          </div>
                        )}
                        {isOtherTyping ? (
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Avatar className="h-8 w-8 border border-border/70 bg-background">
                              <AvatarFallback className="bg-primary/5 text-[10px] font-semibold text-primary">
                                {isCustomerMode ? "C" : "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span>{otherTypingLabel}</span>
                            <TypingDots />
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3 border-t border-border/70 pt-3 xl:mt-auto">
                        <Textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (!sendDisabled) {
                                void handleSend();
                              }
                            }
                          }}
                          placeholder={isCustomerMode ? "Escreva sua mensagem para o consultor..." : "Responda ao cliente..."}
                          className="min-h-[78px] rounded-[1.35rem] border-border/70 bg-background px-4 py-3 text-sm shadow-sm"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-[11px] leading-5 text-muted-foreground">
                            As mensagens ficam vinculadas ao cliente e ao CNPJ para manter o histórico organizado.
                          </p>
                          <Button type="button" className="gap-2 rounded-full px-5" disabled={sendDisabled} onClick={handleSend}>
                            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Enviar
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center">
                      <MessageSquareText className="h-10 w-10 text-primary/70" />
                      <p className="text-sm font-medium text-foreground">Nenhuma conversa selecionada</p>
                      <p className="max-w-md text-sm leading-6 text-muted-foreground">
                        Escolha uma conversa na lista ao lado para ver o histórico e responder.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
      </div>
    </div>
  );
}




