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
import { SectionHeader } from "@/components/shared/SectionHeader";
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
import { MODAL_TELA_CHEIA, MODAL_TELA_CHEIA_CORPO } from "@/lib/modais";
import { cn } from "@/lib/utils";
import { ListaComBusca } from "@/components/admin/ListaComBusca";

/**
 * Um endereço da conta.
 *
 * ## O que mudou
 *
 * Eram cartões brancos idênticos, sem número, sem reação ao mouse, e o padrão
 * marcado por um selo cinza igual a qualquer outro. Numa lista de três, achar o
 * padrão exigia ler os três.
 *
 * Agora: **o número à esquerda** (é assim que se fala deles — "manda pro
 * segundo"), o padrão com moldura e círculo na cor da marca, e o cartão inteiro
 * reagindo ao mouse como os do painel.
 */
function AddressCard({
  address,
  posicao,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  address: CustomerAddress;
  /** A posição na lista, base 1. Só numeração — não é identificador. */
  posicao: number;
  onEdit: (address: CustomerAddress) => void;
  onSetDefault: (address: CustomerAddress) => void;
  onDelete: (address: CustomerAddress) => void;
}) {
  const ehPadrao = address.is_default;

  return (
    <div
      className={cn(
        "group rounded-[1.25rem] border bg-background/95 p-5 shadow-sm transition-all duration-200 sm:p-6",
        "hover:shadow-[0_4px_16px_rgba(16,24,40,0.08)]",
        // ⚠️ O padrão fica com a borda da marca **o tempo todo**, e não só no
        // hover: é o endereço que vai ser usado se ninguém escolher outro, e
        // isso precisa ser visível sem passar o mouse — inclusive no celular,
        // onde hover não existe.
        ehPadrao ? "border-primary/30 bg-primary/[0.02]" : "border-border/70 hover:border-primary/25",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {/* O número: é assim que se fala de endereço numa lista. */}
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
              ehPadrao
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground group-hover:border-primary/20 group-hover:text-primary",
            )}
          >
            {posicao}
          </span>

          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold tracking-tight text-foreground">{address.label}</p>
            {ehPadrao ? (
              <Badge className="gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[0.6875rem] text-primary hover:bg-primary/10">
                <Star className="h-3 w-3 fill-current" />
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
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-2xl px-3 text-[0.8125rem] sm:h-9 sm:text-xs" onClick={() => onEdit(address)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          {!address.is_default ? (
            <Button type="button" variant="outline" className="h-10 rounded-2xl px-3 text-[0.8125rem] sm:h-9 sm:text-xs" onClick={() => onSetDefault(address)}>
              <Star className="h-4 w-4" />
              Padrão
            </Button>
          ) : null}
          <ConfirmActionDialog
            trigger={
              <Button type="button" variant="outline" className="h-10 sm:h-9 rounded-full px-3 text-[0.8125rem] sm:text-xs text-destructive">
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
      <DialogContent className={cn(MODAL_TELA_CHEIA, "max-h-[92dvh] w-[min(98vw,980px)] max-w-[980px] overflow-hidden rounded-[1.35rem] border-border/70 p-0 sm:rounded-[1.75rem]")}>
        <div className={cn("flex max-h-[92dvh] flex-col overflow-hidden", MODAL_TELA_CHEIA_CORPO)}>
          <DialogHeader className="border-b border-border/70 px-5 py-4">
            <DialogTitle className="text-left text-lg font-semibold tracking-tight text-foreground">
              {editingId ? "Editar endereço" : "Novo endereço"}
            </DialogTitle>
            <DialogDescription className="text-left text-[0.8125rem] text-muted-foreground">
              {initialLabelHint}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="space-y-4 rounded-[1.25rem] bg-background border border-border/70 p-4 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
              <div className="space-y-2">
                <Label htmlFor="address-label" className="text-[0.8125rem] font-medium">
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
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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

  /**
   * O padrão em primeiro, o resto na ordem em que veio.
   *
   * ⚠️ A numeração segue esta ordem, não a do banco. "Endereço 1" tem de ser o
   * que vai ser usado — se o padrão aparecesse em terceiro numerado como 3, o
   * número contradiria o selo ao lado dele.
   */
  const enderecosOrdenados = useMemo(
    () => [...addresses].sort((a, b) => Number(b.is_default) - Number(a.is_default)),
    [addresses],
  );

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

  /**
   * Esta tela **nao** escreve no endereco da empresa, e isso e deliberado.
   *
   * Houve uma versao que copiava o endereco padrao daqui para as colunas
   * `address_*` do perfil, para consertar o "Endereço não cadastrado" que
   * aparecia em Dados da empresa. Consertava o sintoma e criava um erro pior:
   * passava a gravar um endereco de **entrega** no campo cadastral da empresa.
   *
   * O caso que mostrou isso: a ECOZ esta registrada na Receita em
   * `TRES PONTES, S/N · INTERIOR · XANXERE/SC`, e o endereco de entrega da
   * conta e `Rua Visconde de Cairu, 15 · Vista Alegre`. Copiar o segundo por
   * cima do primeiro deixa a ficha cadastral errada — e e essa ficha que o
   * painel do admin mostra.
   *
   * O endereco da empresa agora vem da Receita pelo CNPJ. Ver
   * `enderecoDaReceita.ts` e o preenchimento em `useAuth`.
   */

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
      <SectionHeader
        eyebrow="Endereços"
        title="Meus endereços"
        description="Cadastre até cinco endereços e escolha o mais adequado na hora da compra."
        /* ⚠️ Só o contador. "Novo endereço" desceu para a barra da lista.
           O padrão do painel está escrito em `AdminListaPadrao`: cabeçalho com
           contador, ação principal dentro do cartão, ao lado da busca. O motivo
           não é simetria — é que criar um endereço muda a lista logo abaixo, e o
           olho já está na barra por causa do campo de busca. Botão no cabeçalho
           e busca no cartão obrigam a subir e descer para operar a mesma tela. */
        actions={
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-[0.6875rem] font-medium">
            {addresses.length}/5
          </Badge>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-xl border border-border/70 bg-muted/20" />
          ))}
        </div>
      ) : addresses.length > 0 ? (
        // Paginado como o resto: hoje o maior cliente tem 3 endereços, então os
        // controles não aparecem — surgem a partir do sétimo.
        <ListaComBusca
          itens={enderecosOrdenados}
          chaveDoItem={(address) => address.id}
          textoDoItem={(address) =>
            [address.label, address.street, address.neighborhood, address.city, address.cep]
              .filter(Boolean)
              .join(" ")
          }
          buscaPlaceholder="Buscar endereço..."
          vazio="Nenhum endereço cadastrado."
          acaoPrincipal={
            <Button type="button" className="h-10 shrink-0 rounded-2xl px-4 text-sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Novo endereço
            </Button>
          }
          renderizar={(address) => (
            <div className="py-2">
              <AddressCard
                address={address}
                posicao={enderecosOrdenados.indexOf(address) + 1}
                onEdit={openEdit}
                onSetDefault={handleSetDefault}
                onDelete={handleDelete}
              />
            </div>
          )}
        />
      ) : customerProfile ? (
        <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPinned className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold tracking-tight text-foreground">Nenhum endereço salvo ainda</p>
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
