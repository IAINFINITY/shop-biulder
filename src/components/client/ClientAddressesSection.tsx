import { useMemo, useState } from "react";
import { Pencil, Plus, Star, Trash2, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AddressFields } from "@/components/pedido/AddressFields";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { ClientSectionHeader } from "@/components/client/ClientSectionHeader";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerAddresses } from "@/hooks/useCustomerAddresses";
import { assertAddressReady, formatCep, type AddressFormData } from "@/lib/address";
import {
  customerAddressFormFromAddress,
  emptyCustomerAddressForm,
  type CustomerAddress,
  type CustomerAddressFormData,
} from "@/lib/customerAddresses";
import { profileAddressToForm, type CustomerProfile } from "@/lib/customerProfile";

function AddressCard({
  address,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  address: CustomerAddress;
  onEdit: (address: CustomerAddress) => void;
  onSetDefault: (address: CustomerAddress) => void;
  onDelete: (address: CustomerAddress) => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-black tracking-[-0.04em] text-foreground">{address.label}</p>
            {address.is_default ? (
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                Padrão
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {address.street || "—"}, {address.number || "—"}
            {address.complement ? ` · ${address.complement}` : ""}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {address.neighborhood || "—"} · {address.city || "—"}/{address.state || "—"}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{formatCep(address.cep)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]" onClick={() => onEdit(address)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          {!address.is_default ? (
            <Button type="button" variant="outline" className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px]" onClick={() => onSetDefault(address)}>
              <Star className="h-4 w-4" />
              Padrão
            </Button>
          ) : null}
          <ConfirmActionDialog
            trigger={
              <Button type="button" variant="outline" className="h-10 sm:h-9 rounded-full px-3 text-[13px] sm:text-[12px] text-destructive">
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            }
            title="Excluir endereço"
            description={`Deseja excluir o endereço "${address.label}"?`}
            confirmLabel="Excluir"
            destructive
            onConfirm={() => onDelete(address)}
          />
        </div>
      </div>
    </div>
  );
}

function AddressEditor({
  profile,
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onSave,
  saving,
  editingId,
}: {
  profile: CustomerProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: CustomerAddressFormData;
  onDraftChange: (patch: Partial<CustomerAddressFormData>) => void;
  onSave: () => void;
  saving: boolean;
  editingId: string | null;
}) {
  const initialLabelHint = useMemo(() => {
    if (editingId) return "Edite o nome para identificar o endereço";
    if (profile) return "Use um apelido curto, como Principal ou Entrega";
    return "Identifique este endereço para facilitar a compra";
  }, [editingId, profile]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(98vw,980px)] max-w-[980px] overflow-hidden rounded-[1.75rem] border-border/70 p-0">
        <div className="flex max-h-[92vh] flex-col overflow-hidden">
          <DialogHeader className="border-b border-border/70 px-5 py-4">
            <DialogTitle className="text-left text-[1.1rem] font-black tracking-[-0.04em] text-foreground">
              {editingId ? "Editar endereço" : "Novo endereço"}
            </DialogTitle>
            <DialogDescription className="text-left text-[13px] text-muted-foreground">
              {initialLabelHint}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-4 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
              <div className="space-y-2">
                <Label htmlFor="address-label" className="text-[13px] font-medium">
                  Nome do endereço
                </Label>
                <Input
                  id="address-label"
                  value={draft.label}
                  onChange={(e) => onDraftChange({ label: e.target.value })}
                  placeholder="Ex: Principal"
                  className="h-11 rounded-2xl border-border/70 bg-background"
                />
              </div>

              <AddressFields
                form={draft}
                onChange={(patch) => onDraftChange(patch)}
              />

              <div className="flex items-center justify-between rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Endereço padrão
                  </p>
                  <p className="text-sm text-foreground">Usar este endereço por padrão nas compras</p>
                </div>
                <Switch
                  checked={draft.is_default}
                  onCheckedChange={(checked) => onDraftChange({ is_default: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border/70 bg-background px-5 py-4 sm:gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-2xl px-5 text-sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" className="h-11 rounded-2xl px-5 text-sm" onClick={onSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar endereço"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClientAddressesSection() {
  const { user, customerProfile } = useAuth();
  const { data: addresses = [], isLoading, saveAddress, deleteAddress, setDefaultAddress } = useCustomerAddresses(user?.id ?? null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomerAddressFormData>(emptyCustomerAddressForm());

  const canAddMore = addresses.length < 5;

  const openNew = () => {
    if (!canAddMore) {
      toast.error("Você pode cadastrar no máximo 5 endereços");
      return;
    }

    const baseForm = customerProfile ? profileAddressToForm(customerProfile) : emptyCustomerAddressForm();
    setEditingId(null);
    setDraft({
      ...baseForm,
      label: customerProfile?.address_cep ? "Principal" : "Novo endereço",
      is_default: addresses.length === 0,
    });
    setEditorOpen(true);
  };

  const openEdit = (address: CustomerAddress) => {
    setEditingId(address.id);
    setDraft(customerAddressFormFromAddress(address));
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;

    if (!draft.label.trim()) {
      toast.error("Informe um nome para o endereço");
      return;
    }

    const addressMessage = assertAddressReady(draft as AddressFormData);
    if (addressMessage) {
      toast.error(addressMessage);
      return;
    }

    if (!editingId && !canAddMore) {
      toast.error("Você pode cadastrar no máximo 5 endereços");
      return;
    }

    setSaving(true);
    const { error, data } = await saveAddress(draft, editingId ?? undefined);
    if (error) {
      console.error("Erro ao salvar endereço", error);
      toast.error("Não foi possível salvar o endereço");
      setSaving(false);
      return;
    }

    if (draft.is_default && data?.id) {
      const defaultResult = await setDefaultAddress(data.id);
      if (defaultResult.error) {
        console.error("Erro ao definir endereço padrão", defaultResult.error);
        toast.error("Não foi possível definir o endereço padrão");
        setSaving(false);
        return;
      }
    }

    toast.success(editingId ? "Endereço atualizado." : "Endereço salvo.");
    setSaving(false);
    setEditorOpen(false);
  };

  const handleDelete = async (address: CustomerAddress) => {
    const { error } = await deleteAddress(address.id);
    if (error) {
      console.error("Erro ao excluir endereço", error);
      toast.error("Não foi possível excluir o endereço");
      return;
    }
    toast.success("Endereço excluído.");
  };

  const handleSetDefault = async (address: CustomerAddress) => {
    const { error } = await setDefaultAddress(address.id);
    if (error) {
      console.error("Erro ao definir endereço padrão", error);
      toast.error("Não foi possível definir o endereço padrão");
      return;
    }
    toast.success("Endereço padrão atualizado.");
  };

  return (
    <div className="space-y-6">
      <ClientSectionHeader
        eyebrow="Endereços"
        title="Meus endereços"
        description="Cadastre até cinco endereços e escolha o mais adequado na hora da compra."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium">
              {addresses.length}/5
            </Badge>
            <Button type="button" className="h-10 rounded-2xl px-4 text-sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Novo endereço
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-[1.5rem] border border-border/70 bg-muted/20" />
          ))}
        </div>
      ) : addresses.length > 0 ? (
        <div className="grid gap-4">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={openEdit}
              onSetDefault={handleSetDefault}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : customerProfile ? (
        <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPinned className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black tracking-[-0.04em] text-foreground">Nenhum endereço salvo ainda</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Use o endereço do cadastro como ponto de partida e salve os outros quando precisar.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" className="rounded-full px-4" onClick={openNew}>
                  <Plus className="h-4 w-4" />
                  Salvar endereço
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
          <p className="text-sm leading-6 text-muted-foreground">
            O cadastro da conta ainda está sendo concluído. Quando o perfil estiver pronto, você poderá salvar os endereços aqui.
          </p>
        </div>
      )}

      <AddressEditor
        profile={customerProfile}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        draft={draft}
        onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onSave={handleSave}
        saving={saving}
        editingId={editingId}
      />
    </div>
  );
}
