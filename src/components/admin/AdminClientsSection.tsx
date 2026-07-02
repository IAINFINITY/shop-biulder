import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatMoney";
import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPES, type CustomerType } from "@/lib/pricing";
import { AdminSectionHeader } from "./AdminSectionHeader";
import type { AdminCustomerSummary } from "./adminTypes";

type AdminClientsSectionProps = {
  customerSummaries: AdminCustomerSummary[];
  clientSearch: string;
  onClientSearchChange: (value: string) => void;
  clientFilter: "all" | "orders" | "revenue";
  onClientFilterChange: (value: "all" | "orders" | "revenue") => void;
  onUpdateCustomerType: (payload: {
    userId: string | null;
    cnpj: string;
    customerType: CustomerType;
  }) => Promise<Error | null>;
};

function getCustomerKey(customer: AdminCustomerSummary) {
  return customer.userId ?? customer.cnpj ?? customer.name;
}

export function AdminClientsSection({
  customerSummaries,
  clientSearch,
  onClientSearchChange,
  clientFilter,
  onClientFilterChange,
  onUpdateCustomerType,
}: AdminClientsSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomerSummary | null>(null);
  const [draftType, setDraftType] = useState<CustomerType>("cliente");
  const [saving, setSaving] = useState(false);
  const [updatingCustomerKey, setUpdatingCustomerKey] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    const searched = customerSummaries.filter((customer) => {
      if (!term) return true;
      return [customer.name, customer.company ?? "", customer.phone ?? "", customer.cnpj ?? ""].some((value) =>
        value.toLowerCase().includes(term),
      );
    });

    return [...searched].sort((a, b) => {
      if (clientFilter === "orders") return b.orders - a.orders || b.total - a.total;
      if (clientFilter === "revenue") return b.total - a.total || b.orders - a.orders;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [clientFilter, clientSearch, customerSummaries]);

  useEffect(() => {
    setDraftType(selectedCustomer?.customerType ?? "cliente");
  }, [selectedCustomer]);

  const openEditor = (customer: AdminCustomerSummary) => {
    setSelectedCustomer(customer);
    setDraftType(customer.customerType ?? "cliente");
    setEditorOpen(true);
  };

  const updateCustomerType = async (customer: AdminCustomerSummary, value: CustomerType) => {
    if (!customer.cnpj) {
      toast.error("Não foi possível identificar o CNPJ deste cadastro.");
      return;
    }

    const key = getCustomerKey(customer);
    setUpdatingCustomerKey(key);
    const error = await onUpdateCustomerType({
      userId: customer.userId,
      cnpj: customer.cnpj,
      customerType: value,
    });
    setUpdatingCustomerKey(null);

    if (error) {
      toast.error(error.message || "Não foi possível atualizar o tipo do cliente.");
      return;
    }

    toast.success("Tipo de cliente atualizado.");
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const saveCustomerType = async () => {
    if (!selectedCustomer?.cnpj) return;

    setSaving(true);
    const error = await onUpdateCustomerType({
      userId: selectedCustomer.userId,
      cnpj: selectedCustomer.cnpj,
      customerType: draftType,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || "Não foi possível atualizar o tipo do cliente.");
      return;
    }

    toast.success("Tipo de cliente atualizado.");
    setEditorOpen(false);
  };

  useEffect(() => {
    if (!editorOpen) {
      setSelectedCustomer(null);
      setSaving(false);
      setDraftType("cliente");
    }
  }, [editorOpen]);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <AdminSectionHeader
          eyebrow="Clientes"
          title="Visão consolidada de quem compra com frequência"
          description="Use a busca para localizar registros e os filtros para organizar a lista."
          actions={
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary">
              {filteredCustomers.length} cliente(s)
            </Badge>
          }
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Input
            placeholder="Pesquisar cliente (nome, empresa, telefone, CNPJ)"
            value={clientSearch}
            onChange={(e) => onClientSearchChange(e.target.value)}
            className="h-11 rounded-2xl border-border/70 bg-background"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={clientFilter === "all" ? "default" : "outline"}
              className="h-9 rounded-full px-3 text-[13px]"
              onClick={() => onClientFilterChange("all")}
            >
              A-Z
            </Button>
            <Button
              type="button"
              variant={clientFilter === "orders" ? "default" : "outline"}
              className="h-9 rounded-full px-3 text-[13px]"
              onClick={() => onClientFilterChange("orders")}
            >
              Mais pedidos
            </Button>
            <Button
              type="button"
              variant={clientFilter === "revenue" ? "default" : "outline"}
              className="h-9 rounded-full px-3 text-[13px]"
              onClick={() => onClientFilterChange("revenue")}
            >
              Maior gasto
            </Button>
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="rounded-[1.1rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            Nenhum cliente encontrado ainda.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => {
              const key = getCustomerKey(customer);
              const isUpdating = updatingCustomerKey === key;

              return (
                <div
                  key={key}
                  className="rounded-[1.15rem] border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 font-semibold text-primary">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold leading-5 text-foreground">{customer.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{customer.company || "Sem empresa vinculada"}</p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-full px-3 text-[12px]"
                      onClick={() => openEditor(customer)}
                    >
                      Alterar tipo
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {customer.customerType ? (
                      <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] text-primary">
                        {CUSTOMER_TYPE_LABELS[customer.customerType]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] text-muted-foreground">
                        Sem tipo definido
                      </Badge>
                    )}
                    {customer.phone ? (
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px]">
                        {customer.phone}
                      </Badge>
                    ) : null}
                    {customer.cnpj ? (
                      <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-mono text-[11px]">
                        {customer.cnpj}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-[1rem] border border-border/70 bg-muted/25 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Tipo de cadastro
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {customer.userId ? "Vinculado ao front" : "Salvo por CNPJ"}
                      </p>
                    </div>
                    <Select
                      value={customer.customerType ?? "cliente"}
                      onValueChange={(value) => updateCustomerType(customer, value as CustomerType)}
                      disabled={!customer.cnpj || isUpdating}
                    >
                      <SelectTrigger className="h-10 rounded-2xl bg-background">
                        <SelectValue placeholder="Selecione um tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {CUSTOMER_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      A regra fica salva por CNPJ. Se o cliente criar conta no front depois, ele herda essa definição.
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pedidos</p>
                      <p className="mt-1 text-[1rem] font-black tracking-[-0.04em] text-foreground">{customer.orders}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total gasto</p>
                      <p className="mt-1 font-mono text-[13px] font-semibold text-foreground">{formatBRL(customer.total)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && saving) return;
          setEditorOpen(nextOpen);
        }}
      >
        <DialogContent className="max-w-[34rem] rounded-[1.75rem] border-border/70">
          <DialogHeader className="text-left">
            <DialogDescription className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Ajuste administrativo
            </DialogDescription>
            <DialogTitle className="text-[1.45rem] font-black tracking-[-0.04em] text-foreground">
              Alterar tipo de cliente
            </DialogTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Altere a faixa comercial do cadastro para refletir a tabela correta no catálogo e no admin.
            </p>
          </DialogHeader>

          {selectedCustomer ? (
            <div className="space-y-4 pt-2">
              <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Cliente selecionado</p>
                <p className="mt-1 text-base font-semibold text-foreground">{selectedCustomer.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedCustomer.company || "Sem empresa vinculada"} {selectedCustomer.cnpj ? `• ${selectedCustomer.cnpj}` : ""}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-type-select">Tipo de cliente</Label>
                <Select value={draftType} onValueChange={(value) => setDraftType(value as CustomerType)}>
                  <SelectTrigger id="customer-type-select" className="h-11 rounded-2xl">
                    <SelectValue placeholder="Selecione um tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CUSTOMER_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 pt-2 sm:gap-2">
            <Button type="button" variant="outline" className="h-11 rounded-2xl px-5 text-sm" onClick={closeEditor} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" className="h-11 rounded-2xl px-5 text-sm" onClick={saveCustomerType} disabled={saving || !selectedCustomer?.cnpj}>
              {saving ? "Salvando..." : "Salvar alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
