import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquareText, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Menu, MessagesSquare, Plus } from "lucide-react";

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

function internalStaffRoleLabel(role: InternalStaffRole | null | undefined) {
  switch (role) {
    case "consultor":
      return "Consultor";
    case "representante":
      return "Representante";
    case "admin_atendimento":
      return "Admin atendimento";
    case "admin":
      return "Admin";
    default:
      return "Cliente";
  }
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
          "max-w-[75%] rounded-2xl border px-4 py-3 text-sm",
          isSelf
            ? "border-primary/10 bg-primary text-primary-foreground"
            : "border-border/70 bg-background text-foreground",
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">{senderLabel}</p>
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
        "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-destructive/10",
        active && "bg-muted/30",
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-border">
        {getInitials(conversation.customer_company || conversation.customer_name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{formatSupportConversationTitle(conversation)}</span>
          <span className="flex-shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatTime(conversation.last_message_at)}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {formatSupportLastMessagePreview(conversation)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {conversation.status === "open" ? "Aberta" : conversation.status === "closed" ? "Fechada" : "Arquivada"}
          </span>
        </div>
      </div>
    </button>
  );
}

function CustomerConversationSummary({ conversation }: { conversation: SupportConversation }) {
  return (
    <button type="button" className="flex w-full items-start gap-3 rounded-lg bg-muted/30 px-3 py-3 text-left transition-colors hover:bg-destructive/10">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-border">
        {getInitials(conversation.customer_company || conversation.customer_name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{formatSupportConversationTitle(conversation)}</span>
          <span className="flex-shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatTime(conversation.last_message_at)}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {formatSupportLastMessagePreview(conversation)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {conversation.status === "open" ? "Aberta" : conversation.status === "closed" ? "Fechada" : "Arquivada"}
          </span>
        </div>
      </div>
    </button>
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
  const isCustomerMode = mode === "customer";
  const [isMobile, setIsMobile] = useState(false);
  const [mobileInboxOpen, setMobileInboxOpen] = useState(false);
  const { data: customerConversation, isLoading: customerConversationLoading, refetch: refetchCustomerConversation } =
    useCustomerSupportConversation(currentUserId, mode === "customer" && Boolean(currentUserId));
  const { data: inboxConversations = [], isLoading: inboxLoading } = useSupportInbox(mode === "admin" && isAdmin);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxScope, setInboxScope] = useState<"all" | "mine">("mine");
  const sendMutation = useSendSupportMessage();
  const typingMutation = useUpdateSupportConversationTyping();
  const typingTimerRef = useRef<number | null>(null);
  const typingStateRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const [internalStaffDialogOpen, setInternalStaffDialogOpen] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newConversationCustomerId, setNewConversationCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 767px)");
    const updateMobileState = () => setIsMobile(media.matches);

    updateMobileState();
    media.addEventListener("change", updateMobileState);
    return () => media.removeEventListener("change", updateMobileState);
  }, []);

  const filteredInboxConversations = useMemo(() => {
    let list = inboxConversations;

    if (inboxScope === "mine") {
      list = list.filter((c) => c.assigned_admin_id === currentUserId);
    }

    const term = inboxSearch.trim().toLowerCase();
    if (!term) return list;

    return list.filter((conversation) =>
      [
        conversation.customer_name,
        conversation.customer_company ?? "",
        conversation.customer_cnpj ?? "",
        conversation.subject,
        conversation.last_message_preview ?? "",
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [inboxConversations, inboxSearch, inboxScope, currentUserId]);

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
    if (!newConversationCustomerId || !currentUserId) return;

    const customerId = newConversationCustomerId;
    setNewConversationCustomerId(null);

    const createConversation = async () => {
      const { data: profile } = await supabase
        .from("customer_profiles")
        .select("user_id, name, company, phone, cnpj, representante_id")
        .eq("user_id", customerId)
        .single();

      if (!profile) return;

      const { data: newConv, error } = await supabase
        .from("support_conversations")
        .insert({
          customer_user_id: profile.user_id,
          customer_name: profile.name,
          customer_company: profile.company || null,
          customer_phone: profile.phone || null,
          customer_cnpj: profile.cnpj || null,
          assigned_admin_id: profile.representante_id || currentUserId,
          subject: "Atendimento",
          status: "open",
        })
        .select()
        .single();

      if (error) {
        console.error("Erro ao criar conversa:", error);
        return;
      }

      setSelectedConversationId(newConv.id);
    };

    void createConversation();
  }, [newConversationCustomerId, currentUserId]);

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

  const otherTypingAt = isCustomerMode ? selectedConversation?.admin_typing_at : selectedConversation?.customer_typing_at;
  const otherTypingLabel = isCustomerMode ? "Consultor digitando..." : "Cliente digitando...";
  const isOtherTyping = selectedConversation ? isTypingRecently(otherTypingAt, now) : false;
  const mobileConversationTitle = selectedConversation ? formatSupportConversationTitle(selectedConversation) : "Conversa";
  const mobileConversationSubtitle = selectedConversation?.subject || (isCustomerMode ? "Fale com seu consultor" : "Selecione uma conversa");
  const mobileConversationTime = selectedConversation ? formatTime(selectedConversation.last_message_at) : "Sem atividade";

  if (isMobile) {
    return (
      <div
        className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 overflow-hidden px-3"
        style={{ height: "min(92dvh, 68rem)" }}
      >
        <section className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {isCustomerMode ? "Chat interno" : "Inbox interno"}
            </p>
            <h2 className="truncate text-[1.05rem] font-bold leading-tight tracking-[-0.03em] text-foreground">
              {isCustomerMode ? "Fale com seu consultor" : "Conversas com clientes"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {!isCustomerMode ? (
              <Sheet open={mobileInboxOpen} onOpenChange={setMobileInboxOpen}>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" className="h-10 rounded-full px-3 text-sm">
                    <Menu className="h-4 w-4" />
                    Conversas
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[min(92vw,28rem)] overflow-y-auto p-4 sm:p-6">
                  <SheetHeader className="text-left">
                    <SheetTitle>Conversas</SheetTitle>
                    <SheetDescription>Abra uma conversa para responder no painel principal.</SheetDescription>
                  </SheetHeader>

                  <div className="mt-4 space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-2xl w-full gap-2 text-sm"
                      onClick={() => {
                        setNewConversationOpen(true);
                        setMobileInboxOpen(false);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Nova conversa
                    </Button>

                    <Input
                      placeholder="Buscar cliente, empresa ou CNPJ"
                      className="h-10 rounded-2xl border-border/70 bg-background"
                      value={inboxSearch}
                      onChange={(e) => setInboxSearch(e.target.value)}
                    />

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
                            onClick={() => {
                              setSelectedConversationId(conversation.id);
                              setMobileInboxOpen(false);
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background p-5 text-sm text-muted-foreground">
                        Ainda não há conversas abertas. Quando um cliente iniciar contato, elas vão aparecer aqui.
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            ) : null}

            {!isCustomerMode ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full px-3 text-sm"
                onClick={() => setInternalStaffDialogOpen(true)}
              >
                Papéis
              </Button>
            ) : null}
          </div>
        </section>

        {selectedConversation ? (
          <>
            <div className="flex items-center justify-between gap-3 px-1 pt-1">
              <Badge variant={selectedConversation.status === "open" ? "default" : "secondary"} className="rounded-full px-3 py-1 text-[11px]">
                {selectedConversation.status === "open" ? "Aberta" : selectedConversation.status === "closed" ? "Fechada" : "Arquivada"}
              </Badge>
              <span className="text-[11px] text-muted-foreground">{mobileConversationTime}</span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {mobileConversationTitle}
                    </p>
                  </div>
                </div>

                {messagesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 rounded-[1.2rem]" />
                    <Skeleton className="h-16 rounded-[1.2rem]" />
                    <Skeleton className="h-16 rounded-[1.2rem]" />
                  </div>
                ) : messages.length > 0 ? (
                  <div className="flex w-full flex-col gap-3">
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        body={message.body}
                        createdAt={message.created_at}
                        owner={message.sender_user_id === currentUserId ? "self" : "other"}
                        senderLabel={
                          message.sender_user_id === currentUserId
                            ? "Você"
                            : message.sender_user_name || (
                                isCustomerMode
                                  ? "Consultor"
                                  : message.sender_role
                                    ? internalStaffRoleLabel(message.sender_role)
                                    : "Cliente"
                              )
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[14rem] items-center justify-center rounded-[1rem] border border-dashed border-border/70 bg-background text-sm text-muted-foreground">
                    Ainda não há mensagens nesta conversa.
                  </div>
                )}

                {isOtherTyping ? (
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Avatar className="h-9 w-9 border border-border/70 bg-background">
                      <AvatarFallback className="bg-primary/5 text-[10px] font-semibold text-primary">
                        {isCustomerMode ? "C" : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span>{otherTypingLabel}</span>
                    <TypingDots />
                  </div>
                ) : null}
              </div>

              <div className="border-t border-border/70 px-4 py-4">
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
                  className="min-h-[78px] rounded-xl border-border/70 bg-background px-4 py-3 text-sm shadow-sm"
                />
                <div className="mt-3 flex items-center justify-end gap-3">
                  <Button type="button" className="gap-2 rounded-full px-4" disabled={sendDisabled} onClick={handleSend}>
                    {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center">
            <MessagesSquare className="h-10 w-10 text-primary/70" />
            <p className="text-sm font-medium text-foreground">Nenhuma conversa selecionada</p>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              {isCustomerMode
                ? "Sua conversa será carregada automaticamente quando o perfil estiver pronto."
                : "Escolha uma conversa na lista para ver o histórico e responder."}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 sm:gap-6 overflow-hidden"
      style={{ height: isMobile ? "min(92dvh, 68rem)" : "min(85vh, 64rem)" }}
    >
      <section className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isCustomerMode ? "Chat interno" : "Inbox interno"}
          </p>
          <h2 className="truncate text-[1.05rem] font-bold leading-tight tracking-[-0.03em] text-foreground">
            {isCustomerMode ? "Fale com seu consultor" : "Conversas com clientes"}
          </h2>
        </div>
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
          {isCustomerMode ? "Representante interno" : "Equipe administrativa"}
        </Badge>
      </section>

      <div className="grid min-h-0 flex-1 gap-3 sm:gap-5 xl:grid-cols-[18.5rem_minmax(0,1fr)] overflow-hidden">
          {isCustomerMode ? (
            <>
              <div className="hidden h-full min-h-0 flex-col space-y-3 sm:space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-3 sm:p-4 shadow-sm xl:flex">
                <div className="flex min-h-[3.5rem] items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
                      <MessageSquareText className="h-5 w-5 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground">Conversa ativa</p>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="flex h-10 sm:h-8 min-w-[4.5rem] shrink-0 items-center justify-center rounded-full border-border/70 bg-background px-2 text-[10px] font-medium tabular-nums text-muted-foreground"
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

              <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/70 bg-card shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 pb-3 sm:px-5 sm:pb-4">
                  <div className="pt-4 sm:pt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {selectedConversation ? formatSupportConversationTitle(selectedConversation) : "Selecione uma conversa"}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">
                      {selectedConversation?.subject || "Nenhum atendimento selecionado"}
                    </h3>
                  </div>
                  <span className="pt-4 sm:pt-5 text-[11px] text-muted-foreground">
                    {selectedConversation ? formatTime(selectedConversation.last_message_at) : "Sem atividade"}
                  </span>
                </div>

                {selectedConversation ? (
                  <>
                    <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-5 sm:py-5">
                      {messagesLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-16 rounded-[1.2rem]" />
                          <Skeleton className="h-16 rounded-[1.2rem]" />
                          <Skeleton className="h-16 rounded-[1.2rem]" />
                        </div>
                      ) : messages.length > 0 ? (
                        <div className="flex w-full flex-col gap-3">
                          {messages.map((message) => (
                            <MessageBubble
                              key={message.id}
                              body={message.body}
                              createdAt={message.created_at}
                              owner={message.sender_user_id === currentUserId ? "self" : "other"}
                              senderLabel={message.sender_user_id === currentUserId ? "Você" : (message.sender_user_name || "Consultor")}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-[14rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background text-sm text-muted-foreground">
                          Ainda não há mensagens nesta conversa.
                        </div>
                      )}
                      {isOtherTyping ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Avatar className="h-10 w-10 sm:h-8 sm:w-8 border border-border/70 bg-background">
                            <AvatarFallback className="bg-primary/5 text-[10px] font-semibold text-primary">
                              C
                            </AvatarFallback>
                          </Avatar>
                          <span>{otherTypingLabel}</span>
                          <TypingDots />
                        </div>
                      ) : null}
                    </div>

                    <div className="border-t border-border/70 px-4 py-4 sm:px-5 sm:py-5">
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
                        className="min-h-[78px] rounded-xl border-border/70 bg-background px-4 py-3 text-sm shadow-sm"
                      />
                      <div className="mt-3 flex items-center justify-end gap-3">
                        <Button type="button" className="gap-2 rounded-full px-5" disabled={sendDisabled} onClick={handleSend}>
                          {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[24rem] flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                    <MessageSquareText className="h-10 w-10 text-primary/70" />
                    <p className="text-sm font-medium text-foreground">Nenhuma conversa selecionada</p>
                    <p className="max-w-md text-sm leading-6 text-muted-foreground">
                      Sua conversa será carregada automaticamente quando o perfil estiver pronto.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex h-full min-h-0 flex-col space-y-3 sm:space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-3 sm:p-4 shadow-sm">
                <div className="flex min-h-[3.5rem] items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 flex-shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground">Caixa de entrada</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInboxScope("mine")}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors",
                        inboxScope === "mine"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Minhas
                    </button>
                    <button
                      type="button"
                      onClick={() => setInboxScope("all")}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors",
                        inboxScope === "all"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Todas
                    </button>
                  </div>
                </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-2xl w-full gap-2 text-sm"
                    onClick={() => setNewConversationOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Nova conversa
                  </Button>

                  <Input
                    placeholder="Buscar cliente, empresa ou CNPJ"
                    className="h-10 sm:h-11 rounded-2xl border-border/70 bg-background"
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

              <div className="flex h-full min-h-0 flex-col rounded-xl border border-border/70 bg-card shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 pb-3 sm:px-5 sm:pb-4">
                  <div className="pt-4 sm:pt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {selectedConversation ? formatSupportConversationTitle(selectedConversation) : "Selecione uma conversa"}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">
                      {selectedConversation?.subject || "Nenhum atendimento selecionado"}
                    </h3>
                  </div>
                  <div className="pt-4 sm:pt-5 flex flex-col items-end gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant={selectedConversation?.status === "open" ? "default" : "secondary"} className="rounded-full px-3 py-1 text-[11px]">
                        {selectedConversation ? (selectedConversation.status === "open" ? "Aberta" : selectedConversation.status === "closed" ? "Fechada" : "Arquivada") : "—"}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 sm:h-9 rounded-full px-4 text-sm"
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

                {selectedConversation ? (
                  <>
                    <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-5 sm:py-5">
                      {messagesLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-16 rounded-[1.2rem]" />
                          <Skeleton className="h-16 rounded-[1.2rem]" />
                          <Skeleton className="h-16 rounded-[1.2rem]" />
                        </div>
                      ) : messages.length > 0 ? (
                        <div className="flex w-full flex-col gap-3">
                          {messages.map((message) => (
                            <MessageBubble
                              key={message.id}
                              body={message.body}
                              createdAt={message.created_at}
                              owner={message.sender_user_id === currentUserId ? "self" : "other"}
                              senderLabel={
                                message.sender_user_id === currentUserId
                                  ? "Você"
                                  : message.sender_user_name || (
                                      message.sender_role
                                        ? internalStaffRoleLabel(message.sender_role)
                                        : "Cliente"
                                    )
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-[14rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background text-sm text-muted-foreground">
                          Ainda não há mensagens nesta conversa.
                        </div>
                      )}
                      {isOtherTyping ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Avatar className="h-10 w-10 sm:h-8 sm:w-8 border border-border/70 bg-background">
                            <AvatarFallback className="bg-primary/5 text-[10px] font-semibold text-primary">
                              {isCustomerMode ? "C" : "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span>{otherTypingLabel}</span>
                          <TypingDots />
                        </div>
                      ) : null}
                    </div>

                    <div className="border-t border-border/70 px-4 py-4 sm:px-5 sm:py-5">
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
                        className="min-h-[78px] rounded-xl border-border/70 bg-background px-4 py-3 text-sm shadow-sm"
                      />
                      <div className="mt-3 flex items-center justify-end gap-3">
                        <Button type="button" className="gap-2 rounded-full px-5" disabled={sendDisabled} onClick={handleSend}>
                          {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[24rem] flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                    <MessageSquareText className="h-10 w-10 text-primary/70" />
                    <p className="text-sm font-medium text-foreground">Nenhuma conversa selecionada</p>
                    <p className="max-w-md text-sm leading-6 text-muted-foreground">
                      Escolha uma conversa na lista ao lado para ver o histórico e responder.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
      <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
        <DialogContent className="max-w-[34rem] rounded-[1.5rem] border-border/70">
          <DialogHeader>
            <DialogTitle className="text-[1.05rem] font-black tracking-[-0.04em]">
              Nova conversa
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-6 text-muted-foreground">
              Selecione um cliente para iniciar uma conversa.
            </DialogDescription>
          </DialogHeader>
          <NewConversationSearch
            onSelect={(customerUserId) => {
              setNewConversationOpen(false);
              const existing = inboxConversations.find((c) => c.customer_user_id === customerUserId);
              if (existing) {
                setSelectedConversationId(existing.id);
                return;
              }
              setNewConversationCustomerId(customerUserId);
            }}
          />
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
} 

function NewConversationSearch({ onSelect }: { onSelect: (customerUserId: string) => void }) {
  const [search, setSearch] = useState("");
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customer-profiles-search", search],
    enabled: search.trim().length >= 2,
    staleTime: 10_000,
    queryFn: async () => {
      const term = search.trim();
      const { data, error } = await supabase
        .from("customer_profiles")
        .select("user_id, name, company, phone, cnpj")
        .or(`name.ilike.%${term}%,company.ilike.%${term}%,cnpj.ilike.%${term}%`)
        .order("name", { ascending: true })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as Array<{
        user_id: string;
        name: string;
        company: string;
        phone: string;
        cnpj: string;
      }>;
    },
  });

  return (
    <div className="space-y-4 pt-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar cliente por nome, empresa ou CNPJ"
        className="h-11 rounded-2xl border-border/70 bg-background"
        autoFocus
      />

      <div className="max-h-[24rem] min-h-[8rem] overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-[72px] rounded-[1rem]" />
            <Skeleton className="h-[72px] rounded-[1rem]" />
          </div>
        ) : customers.length > 0 ? (
          customers.map((customer) => (
            <button
              key={customer.user_id}
              type="button"
              className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-destructive/10"
              onClick={() => onSelect(customer.user_id)}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-border">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {customer.company || customer.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {customer.name} {customer.cnpj ? `· ${customer.cnpj}` : ""}
                </p>
              </div>
            </button>
          ))
        ) : search.trim().length >= 2 ? (
          <div className="rounded-[1rem] border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="rounded-[1rem] border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
            Digite ao menos 2 caracteres para buscar.
          </div>
        )}
      </div>
    </div>
  );
}

