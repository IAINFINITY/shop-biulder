import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CatalogNotificationImageFrame } from "@/components/shared/CatalogNotificationImageFrame";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { AdminSectionHeader } from "./AdminSectionHeader";
import { CATALOG_NOTIFICATIONS_TABLE, type CatalogNotification } from "@/lib/catalogNotifications";
import { useCatalogNotifications } from "@/hooks/useCatalogNotifications";
import { useAdminCustomerProfiles } from "@/hooks/useAdminCustomerProfiles";
import { useAuth } from "@/hooks/useAuth";
import { deleteStorageImage, uploadProductImageFile } from "@/lib/productImageStorage";
import { cn } from "@/lib/utils";
import { ADMIN_TEXT_LIMITS } from "@/lib/adminTextLimits";

type NotificationFormState = {
  id?: string;
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  targetUserId: string;
  priority: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const DEFAULT_PRIORITY_STEP = 10;

function toDatetimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function getTodayDateInputValue(reference = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function splitDatetimeLocalValue(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };

  const normalized = value.trim();
  if (!normalized) return { date: "", time: "" };

  if (normalized.length <= 10) {
    return {
      date: normalized.slice(0, 10),
      time: "",
    };
  }

  return {
    date: normalized.slice(0, 10),
    time: normalized.slice(11, 16),
  };
}

function combineDateAndTime(date: string, time: string): string {
  if (!date) return "";
  if (!time) return date;

  const combined = `${date}T${time}`;
  const parsed = new Date(combined);
  if (Number.isNaN(parsed.getTime())) return "";

  return combined;
}

function isCompleteDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.trim());
}

function normalizeTimeDraft(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `${digits.padStart(2, "0")}:00`;

  const hours = digits.slice(0, 2).padStart(2, "0");
  const minutes = digits.slice(2, 4).padEnd(2, "0");
  return `${hours}:${minutes}`;
}

function formatTimeDraft(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function getLocalDateTime(value: string): Date | null {
  if (!isCompleteDateTime(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function DateTimeSelector({
  label,
  helperText,
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  dateTriggerId,
  timeTriggerId,
}: {
  label: string;
  helperText: string;
  dateValue: string;
  timeValue: string;
  onDateChange: (nextDate: string) => void;
  onTimeChange: (nextTime: string) => void;
  dateTriggerId: string;
  timeTriggerId: string;
}) {
  const [timeDraft, setTimeDraft] = useState(() => formatTimeDraft(timeValue));

  useEffect(() => {
    setTimeDraft(formatTimeDraft(timeValue));
  }, [timeValue]);

  return (
    <div className="space-y-2 min-w-0">
      <Label className="text-[13px] font-medium">{label}</Label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Input
          id={dateTriggerId}
          type="date"
          value={dateValue}
          onChange={(e) => onDateChange(e.target.value)}
          min={getTodayDateInputValue()}
          className="h-11 w-full rounded-2xl border-border/70 bg-background text-sm"
        />
        <Input
          id={timeTriggerId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="HH:MM"
          value={timeDraft}
          maxLength={5}
          onChange={(e) => setTimeDraft(formatTimeDraft(e.target.value))}
          onBlur={(e) => {
            const normalized = normalizeTimeDraft(e.target.value);
            setTimeDraft(normalized);
            onTimeChange(normalized);
          }}
          className="h-11 w-full rounded-2xl border-border/70 bg-background text-sm tabular-nums"
        />
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">{helperText} O formato fica como 08:30.</p>
    </div>
  );
}

function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getCustomerLabel(profile: { company: string; name: string; cnpj: string }) {
  const company = profile.company.trim();
  const name = profile.name.trim();
  const cnpj = profile.cnpj.trim();

  if (company && name) return `${company} • ${name}`;
  if (company) return company;
  if (name) return name;
  return cnpj || "Cliente";
}

function getNextPriority(notifications: CatalogNotification[]): string {
  if (notifications.length === 0) return "0";
  const maxPriority = Math.max(...notifications.map((notification) => notification.priority));
  return String(maxPriority + DEFAULT_PRIORITY_STEP);
}

function formatWindow(notification: CatalogNotification): string {
  const starts = notification.starts_at ? new Date(notification.starts_at) : null;
  const ends = notification.ends_at ? new Date(notification.ends_at) : null;

  const formatDateTime = (date: Date) =>
    `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

  const parts = [
    starts && !Number.isNaN(starts.getTime()) ? `início ${formatDateTime(starts)}` : null,
    ends && !Number.isNaN(ends.getTime()) ? `fim ${formatDateTime(ends)}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" • ") : "Sem janela definida";
}

function NotificationCard({
  notification,
  targetUserLabel,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  notification: CatalogNotification;
  targetUserLabel?: string | null;
  onEdit: (notification: CatalogNotification) => void;
  onToggleActive: (notification: CatalogNotification) => void;
  onDelete: (notificationId: string) => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.35rem] border border-border/70 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        !notification.active && "opacity-75",
      )}
    >
      <CatalogNotificationImageFrame src={notification.image_url} alt={notification.title} className="h-44 sm:h-48" fit="cover" />

      <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-semibold text-foreground">{notification.title}</p>
              <Badge variant={notification.active ? "secondary" : "outline"} className="rounded-full px-2.5 py-0.5 text-[11px]">
                {notification.active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Prioridade {notification.priority} • {formatWindow(notification)}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-2.5 py-1">
            <p className="text-[11px] font-medium text-muted-foreground">Visível</p>
            <Switch
              checked={notification.active}
              onCheckedChange={() => onToggleActive(notification)}
              aria-label={notification.active ? "Desativar notificação" : "Ativar notificação"}
            />
          </div>
        </div>

        {targetUserLabel ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px]">
              Para: {targetUserLabel}
            </Badge>
          </div>
        ) : null}

        <div className="space-y-2">
          {notification.summary ? <p className="text-sm font-medium leading-6 text-foreground">{notification.summary}</p> : null}
          {notification.body ? <p className="text-sm leading-6 text-muted-foreground line-clamp-3">{notification.body}</p> : null}
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]" onClick={() => onEdit(notification)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>

          <ConfirmActionDialog
            trigger={
              <Button type="button" variant="outline" className="h-9 rounded-full px-3 text-[12px] text-destructive">
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            }
            title="Excluir notificação"
            description={`Deseja excluir "${notification.title}"? Essa ação remove a campanha imediatamente do painel do cliente.`}
            confirmLabel="Excluir"
            destructive
            onConfirm={() => onDelete(notification.id)}
          />
        </div>
      </div>
    </div>
  );
}

function NotificationPreview({
  draft,
  targetUserLabel,
}: {
  draft: NotificationFormState | null;
  targetUserLabel?: string | null;
}) {
  const imageUrl = draft?.imageUrl.trim();
  const title = draft?.title.trim() || "Título da notificação";
  const summary = draft?.summary.trim() || "Resumo curto para chamar atenção do cliente.";
  const body = draft?.body.trim() || "Escreva aqui a mensagem completa da campanha, aviso ou novidade.";
  const ctaLabel = draft?.ctaLabel.trim() || "Botão de ação";
  const ctaUrl = draft?.ctaUrl.trim();
  const priority = draft?.priority.trim() || "0";

  return (
    <div className="flex h-full min-h-[540px] flex-col gap-5">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pré-visualização</p>
        <p className="text-sm text-foreground/80">Veja como a notificação vai aparecer para o cliente antes de salvar.</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <CatalogNotificationImageFrame src={imageUrl} alt={title} className="aspect-[3/1]" fit="cover" showBackdrop={false} />

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant={draft?.active ? "secondary" : "outline"} className="rounded-full px-3 py-1 text-[11px]">
              {draft?.active ? "Ativa" : "Inativa"}
            </Badge>
            <p className="text-[11px] text-muted-foreground">Prioridade {priority}</p>
          </div>

          {targetUserLabel ? (
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[11px]">
              Para: {targetUserLabel}
            </Badge>
          ) : null}

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Campanha</p>
            <p className="text-[1.03rem] font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>

          <p className="text-sm leading-6 text-foreground/90 whitespace-pre-wrap break-words">{body}</p>

          <div className="mt-auto flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ação</p>
              <p className="truncate text-sm font-medium text-foreground">{ctaLabel}</p>
              <p className="truncate text-xs text-muted-foreground">{ctaUrl || "Sem link configurado"}</p>
            </div>
            <Button type="button" className="h-10 rounded-2xl px-4 text-sm" disabled>
              {ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationEditor({
  open,
  onOpenChange,
  draft,
  targetUserOptions,
  targetUserLabel,
  onDraftChange,
  onSave,
  saving,
  uploading,
  onUploadImage,
  onClearImage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: NotificationFormState | null;
  targetUserOptions: Array<{ value: string; label: string }>;
  targetUserLabel?: string | null;
  onDraftChange: (patch: Partial<NotificationFormState>) => void;
  onSave: () => void;
  saving: boolean;
  uploading: boolean;
  onUploadImage: () => void;
  onClearImage: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(98vw,1320px)] max-w-[1320px] overflow-hidden rounded-[1.75rem] border-border/70 p-0">
        <div className="flex max-h-[92vh] flex-col overflow-hidden">
          <DialogHeader className="border-b border-border/70 px-5 py-4">
            <DialogTitle className="text-left text-[1.1rem] font-black tracking-[-0.04em] text-foreground">
              {draft?.id ? "Editar notificação" : "Nova notificação"}
            </DialogTitle>
            <DialogDescription className="text-left text-[13px] text-muted-foreground">
              Ajuste a mensagem e veja o preview antes de publicar para os clientes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              {draft ? (
                <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
          <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="notification-title" className="text-[13px] font-medium">
                          Título
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {draft.title.length}/{ADMIN_TEXT_LIMITS.notifications.title} caracteres
                        </p>
                      </div>
                      <Input
                        id="notification-title"
                        value={draft.title}
                        onChange={(e) => onDraftChange({ title: e.target.value })}
                        placeholder="Ex: Campanha de fim de semana"
                        maxLength={ADMIN_TEXT_LIMITS.notifications.title}
                        className="h-11 rounded-2xl border-border/70 bg-background"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="notification-summary" className="text-[13px] font-medium">
                          Resumo
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {draft.summary.length}/{ADMIN_TEXT_LIMITS.notifications.summary} caracteres
                        </p>
                      </div>
                      <Input
                        id="notification-summary"
                        value={draft.summary}
                        onChange={(e) => onDraftChange({ summary: e.target.value })}
                        placeholder="Texto curto que aparece em destaque"
                        maxLength={ADMIN_TEXT_LIMITS.notifications.summary}
                        className="h-11 rounded-2xl border-border/70 bg-background"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="notification-body" className="text-[13px] font-medium">
                          Mensagem
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {draft.body.length}/{ADMIN_TEXT_LIMITS.notifications.body} caracteres
                        </p>
                      </div>
                      <Textarea
                        id="notification-body"
                        value={draft.body}
                        onChange={(e) => onDraftChange({ body: e.target.value })}
                        placeholder="Explique a campanha, aviso ou novidade com mais detalhe."
                        maxLength={ADMIN_TEXT_LIMITS.notifications.body}
                        className="min-h-36 rounded-2xl border-border/70 bg-background text-sm leading-6"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-[1.35rem] border border-border/70 bg-muted/15 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Label htmlFor="notification-image-url" className="text-[13px] font-medium">
                          Imagem
                        </Label>
                        <p className="text-xs text-muted-foreground">Você pode colar uma URL ou enviar um arquivo do computador.</p>
                      </div>
                      {draft.imageUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 rounded-full px-3 text-[12px] text-destructive"
                          onClick={onClearImage}
                        >
                          <X className="h-4 w-4" />
                          Remover imagem
                        </Button>
                      ) : null}
                    </div>
                    <Input
                      id="notification-image-url"
                      value={draft.imageUrl}
                      onChange={(e) => onDraftChange({ imageUrl: e.target.value })}
                      placeholder="Cole a URL da imagem da campanha"
                      maxLength={500}
                      className="h-11 rounded-2xl border-border/70 bg-background"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-2xl px-4 text-sm"
                        onClick={onUploadImage}
                        disabled={uploading}
                      >
                        <Upload className="h-4 w-4" />
                        {uploading ? "Enviando..." : "Enviar imagem"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="notification-cta-label" className="text-[13px] font-medium">
                          Texto do botão
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {draft.ctaLabel.length}/{ADMIN_TEXT_LIMITS.notifications.ctaLabel} caracteres
                        </p>
                      </div>
                      <Input
                        id="notification-cta-label"
                        value={draft.ctaLabel}
                        onChange={(e) => onDraftChange({ ctaLabel: e.target.value })}
                        placeholder="Ex: Ver campanha"
                        maxLength={ADMIN_TEXT_LIMITS.notifications.ctaLabel}
                        className="h-11 rounded-2xl border-border/70 bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="notification-cta-url" className="text-[13px] font-medium">
                          Link do botão
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          {draft.ctaUrl.length}/{ADMIN_TEXT_LIMITS.notifications.ctaUrl} caracteres
                        </p>
                      </div>
                      <Input
                        id="notification-cta-url"
                        value={draft.ctaUrl}
                        onChange={(e) => onDraftChange({ ctaUrl: e.target.value })}
                        placeholder="Ex: /pedido ou https://..."
                        maxLength={ADMIN_TEXT_LIMITS.notifications.ctaUrl}
                        className="h-11 rounded-2xl border-border/70 bg-background"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="notification-priority" className="text-[13px] font-medium">
                          Prioridade de exibição
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Ordem interna do envio. É útil para campanhas pontuais e ajustes de exibição.
                        </p>
                      </div>
                      <Input
                        id="notification-priority"
                        type="number"
                        value={draft.priority}
                        onChange={(e) => onDraftChange({ priority: e.target.value })}
                        className="h-11 rounded-2xl border-border/70 bg-background"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="notification-target-user" className="text-[13px] font-medium">
                          Usuário específico
                        </Label>
                        <p className="text-[11px] text-muted-foreground">Deixe em branco para enviar para todos.</p>
                      </div>
                      <Select
                        value={draft.targetUserId || "__all__"}
                        onValueChange={(value) => onDraftChange({ targetUserId: value === "__all__" ? "" : value })}
                      >
                        <SelectTrigger id="notification-target-user" className="h-11 rounded-2xl border-border/70 bg-background text-[13px]">
                          <SelectValue placeholder="Todos os clientes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos os clientes</SelectItem>
                          {targetUserOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {targetUserLabel ? (
                        <p className="text-[11px] leading-5 text-muted-foreground">
                          Essa notificação será exibida apenas para <span className="font-medium text-foreground">{targetUserLabel}</span>.
                        </p>
                      ) : (
                        <p className="text-[11px] leading-5 text-muted-foreground">Modo padrão: todos os clientes ativos enxergam essa notificação.</p>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
                      <DateTimeSelector
                        label="Início"
                        helperText="Escolha a data e o horário em que a campanha começa a aparecer."
                        dateTriggerId="notification-starts-at-date"
                        timeTriggerId="notification-starts-at-time"
                        dateValue={splitDatetimeLocalValue(draft.startsAt).date}
                        timeValue={splitDatetimeLocalValue(draft.startsAt).time}
                        onDateChange={(nextDate) => {
                          const current = splitDatetimeLocalValue(draft.startsAt);
                          onDraftChange({ startsAt: combineDateAndTime(nextDate, current.time) });
                        }}
                        onTimeChange={(nextTime) => {
                          const current = splitDatetimeLocalValue(draft.startsAt);
                          onDraftChange({ startsAt: combineDateAndTime(current.date, nextTime) });
                        }}
                      />

                      <DateTimeSelector
                        label="Fim"
                        helperText="Escolha a data e o horário em que a campanha deve parar de aparecer."
                        dateTriggerId="notification-ends-at-date"
                        timeTriggerId="notification-ends-at-time"
                        dateValue={splitDatetimeLocalValue(draft.endsAt).date}
                        timeValue={splitDatetimeLocalValue(draft.endsAt).time}
                        onDateChange={(nextDate) => {
                          const current = splitDatetimeLocalValue(draft.endsAt);
                          onDraftChange({ endsAt: combineDateAndTime(nextDate, current.time) });
                        }}
                        onTimeChange={(nextTime) => {
                          const current = splitDatetimeLocalValue(draft.endsAt);
                          onDraftChange({ endsAt: combineDateAndTime(current.date, nextTime) });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 overflow-y-auto border-t border-border/70 bg-muted/15 p-5 sm:p-6 lg:border-l lg:border-t-0">
              <NotificationPreview
                draft={draft}
                targetUserLabel={targetUserLabel}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border/70 bg-background px-5 py-4 sm:gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-2xl px-5 text-sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" className="h-11 rounded-2xl px-5 text-sm" onClick={onSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar notificação"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminNotificationsSection() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { data: notifications = [], isLoading } = useCatalogNotifications({ activeOnly: false });
  const { data: customerProfiles = [] } = useAdminCustomerProfiles(Boolean(user && isAdmin));
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<NotificationFormState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedNotifications = useMemo(
    () => [...notifications].sort((left, right) => right.priority - left.priority || right.created_at.localeCompare(left.created_at)),
    [notifications],
  );
  const targetUserLabels = useMemo(
    () =>
      new Map(
        customerProfiles.map((profile) => [
          profile.user_id,
          getCustomerLabel({
            company: profile.company,
            name: profile.name,
            cnpj: profile.cnpj,
          }),
        ]),
      ),
    [customerProfiles],
  );
  const targetUserOptions = useMemo(
    () =>
      customerProfiles.map((profile) => ({
        value: profile.user_id,
        label: getCustomerLabel({
          company: profile.company,
          name: profile.name,
          cnpj: profile.cnpj,
        }),
      })),
    [customerProfiles],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["catalog-notifications"] });
  };

  const openNew = () => {
    setDraft({
      title: "",
      summary: "",
      body: "",
      imageUrl: "",
      ctaLabel: "",
      ctaUrl: "",
      targetUserId: "",
      priority: getNextPriority(sortedNotifications),
      startsAt: "",
      endsAt: "",
      active: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (notification: CatalogNotification) => {
    setDraft({
      id: notification.id,
      title: notification.title,
      summary: notification.summary,
      body: notification.body,
      imageUrl: notification.image_url ?? "",
      ctaLabel: notification.cta_label ?? "",
      ctaUrl: notification.cta_url ?? "",
      targetUserId: notification.target_user_id ?? "",
      priority: String(notification.priority),
      startsAt: toDatetimeLocalValue(notification.starts_at),
      endsAt: toDatetimeLocalValue(notification.ends_at),
      active: notification.active,
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const handleUploadImage = async () => {
    if (!draft) return;
    const input = fileInputRef.current;
    if (!input) return;
    input.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    const result = await uploadProductImageFile(file);
    setUploading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setDraft((current) => (current ? { ...current, imageUrl: result.publicUrl } : current));
    toast.success("Imagem enviada.");
  };

  const saveNotification = async () => {
    if (!draft) return;

    const title = draft.title.trim();
    const summary = draft.summary.trim();
    const body = draft.body.trim();
    if (!title || !summary || !body) {
      toast.error("Preencha título, resumo e mensagem.");
      return;
    }

    if ((draft.startsAt && !isCompleteDateTime(draft.startsAt)) || (draft.endsAt && !isCompleteDateTime(draft.endsAt))) {
      toast.error("Preencha data e horário completos.");
      return;
    }

    const startsAtDate = draft.startsAt ? getLocalDateTime(draft.startsAt) : null;
    const endsAtDate = draft.endsAt ? getLocalDateTime(draft.endsAt) : null;
    const now = new Date();

    if (startsAtDate && startsAtDate.getTime() < now.getTime()) {
      toast.error("O início não pode ser no passado.");
      return;
    }

    if (endsAtDate && endsAtDate.getTime() < now.getTime()) {
      toast.error("O fim não pode ser no passado.");
      return;
    }

    if (startsAtDate && endsAtDate && endsAtDate.getTime() < startsAtDate.getTime()) {
      toast.error("O fim precisa ser depois do início.");
      return;
    }

    const priority = Number.isFinite(Number(draft.priority)) ? Math.trunc(Number(draft.priority)) : 0;
    const payload = {
      title,
      summary,
      body,
      image_url: trimToNull(draft.imageUrl),
      cta_label: trimToNull(draft.ctaLabel),
      cta_url: trimToNull(draft.ctaUrl),
      target_user_id: trimToNull(draft.targetUserId),
      priority,
      active: draft.active,
      starts_at: fromDatetimeLocalValue(draft.startsAt),
      ends_at: fromDatetimeLocalValue(draft.endsAt),
    };

    setSaving(true);
    const { error } = draft.id
      ? await supabase.from(CATALOG_NOTIFICATIONS_TABLE).update(payload).eq("id", draft.id)
      : await supabase.from(CATALOG_NOTIFICATIONS_TABLE).insert(payload);
    setSaving(false);

    if (error) {
      console.error("Erro ao salvar notificação", error);
      toast.error("Erro ao salvar notificação.");
      return;
    }

    toast.success(draft.id ? "Notificação atualizada." : "Notificação publicada.");
    setEditorOpen(false);
    setDraft(null);
    await refresh();
  };

  const deleteNotification = async (id: string) => {
    const notification = notifications.find((n) => n.id === id);
    if (notification?.image_url) {
      await deleteStorageImage(notification.image_url);
    }

    const { error } = await supabase.from(CATALOG_NOTIFICATIONS_TABLE).delete().eq("id", id);
    if (error) {
      console.error("Erro ao remover notificação", error);
      toast.error("Erro ao remover notificação.");
      return;
    }
    toast.success("Notificação removida.");
    await refresh();
  };

  const toggleActive = async (notification: CatalogNotification) => {
    const { error } = await supabase
      .from(CATALOG_NOTIFICATIONS_TABLE)
      .update({ active: !notification.active })
      .eq("id", notification.id);

    if (error) {
      console.error("Erro ao atualizar notificação", error);
      toast.error("Erro ao atualizar notificação.");
      return;
    }

    toast.success(notification.active ? "Notificação desativada." : "Notificação ativada.");
    await refresh();
  };

  const activeCount = sortedNotifications.filter((notification) => notification.active).length;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Notificações"
        title="Campanhas e avisos do catálogo"
        description="Publique mensagens para aparecer na área de notificações do cliente e organize a prioridade de exibição."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
              {activeCount} ativa(s)
            </Badge>
            <Button type="button" className="h-10 rounded-2xl px-4 text-sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Nova notificação
            </Button>
          </div>
        }
      />

      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-foreground">O cliente vê apenas as notificações ativas e dentro da janela de início/fim, quando configurada.</p>
            <p className="text-xs text-muted-foreground">Use prioridade maior para empurrar uma campanha para o topo da lista.</p>
          </div>
          <Badge variant="outline" className="rounded-full border-border/70 px-3 py-1 text-[11px] font-medium">
            {sortedNotifications.length} notificação(ões)
          </Badge>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-[1.25rem] border border-border/70 bg-muted/20" />
            ))}
          </div>
        ) : sortedNotifications.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            Nenhuma notificação cadastrada ainda.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                targetUserLabel={notification.target_user_id ? targetUserLabels.get(notification.target_user_id) ?? notification.target_user_id : null}
                onEdit={openEdit}
                onToggleActive={toggleActive}
                onDelete={deleteNotification}
              />
            ))}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <NotificationEditor
        open={editorOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeEditor();
        }}
        draft={draft}
        targetUserOptions={targetUserOptions}
        targetUserLabel={draft?.targetUserId ? targetUserLabels.get(draft.targetUserId) ?? draft.targetUserId : null}
        onDraftChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
        onSave={saveNotification}
        saving={saving}
        uploading={uploading}
        onUploadImage={handleUploadImage}
        onClearImage={() => setDraft((current) => (current ? { ...current, imageUrl: "" } : current))}
      />
    </div>
  );
}

