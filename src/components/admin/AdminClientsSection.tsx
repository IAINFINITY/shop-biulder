import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { customerTypeLabel } from "@/lib/pricing";
import { formatCnpjDisplay } from "@/lib/brazilianIds";
import { useCustomerTypes } from "@/hooks/useCustomerTypes";
import { supabase } from "@/integrations/supabase/client";
import { CUSTOMER_ADDRESSES_TABLE, customerAddressFromRow, type CustomerAddress } from "@/lib/customerAddresses";
import { AdminSectionHeader } from "./AdminSectionHeader";
import type { AdminCustomerSummary } from "./adminTypes";
import type { CustomerProfile } from "@/lib/customerProfile";
import { listAdminUsers, getRoleLabel, type AdminUserRecord } from "@/lib/adminUsers";

type AdminClientsSectionProps = {
  customerProfiles: CustomerProfile[];
  customerSummaries: AdminCustomerSummary[];
  clientSearch: string;
  onClientSearchChange: (value: string) => void;
  clientFilter: "all" | "orders" | "revenue";
  onClientFilterChange: (value: "all" | "orders" | "revenue") => void;
  onUpdateCustomerType: (payload: {
    userId: string | null;
    cnpj: string;
    customerType: string;
  }) => Promise<Error | null>;
};

function getCustomerKey(customer: AdminCustomerSummary) {
  return customer.userId ?? customer.cnpj ?? customer.name;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function DetailField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full min-h-[64px] sm:min-h-[80px] flex-col justify-between rounded-[1.2rem] border border-border/70 bg-muted/20 p-3 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
        <p className="text-[13px] sm:text-sm font-medium leading-5 sm:leading-6 text-foreground">{value}</p>
        {hint ? <p className="text-[11px] leading-4 sm:leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function AdminClientsSection({
  customerProfiles,
  customerSummaries,
  clientSearch,
  onClientSearchChange,
  clientFilter,
  onClientFilterChange,
  onUpdateCustomerType,
}: AdminClientsSectionProps) {
  const { options: customerTypes, addCustomType } = useCustomerTypes();
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsCustomer, setDetailsCustomer] = useState<AdminCustomerSummary | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomerSummary | null>(null);
  const [draftType, setDraftType] = useState<string>("cliente");
  const [saving, setSaving] = useState(false);
  const [updatingCustomerKey, setUpdatingCustomerKey] = useState<string | null>(null);
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [syncingProxis, setSyncingProxis] = useState(false);

  const { data: adminUsers = [] } = useQuery({
    queryKey: ["admin-users"],
    staleTime: 30_000,
    queryFn: listAdminUsers,
  });
  const [draftRepresentanteId, setDraftRepresentanteId] = useState<string>("");
  const [representanteSaving, setRepresentanteSaving] = useState(false);

  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { unknown: 0 };
    for (const c of customerSummaries) {
      const t = c.customerType ?? "unknown";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [customerSummaries]);

  const filteredCustomers = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();

    let filtered = customerSummaries;

    if (term) {
      filtered = filtered.filter((customer) =>
        [customer.name, customer.company ?? "", customer.phone ?? "", customer.cnpj ?? ""].some((value) =>
          value.toLowerCase().includes(term),
        ),
      );
    }

    if (typeFilter !== null) {
      filtered = filtered.filter((customer) => {
        if (typeFilter === "unknown") return !customer.customerType;
        return customer.customerType === typeFilter;
      });
    }

    return [...filtered].sort((a, b) => {
      if (clientFilter === "orders") return b.orders - a.orders || b.total - a.total;
      if (clientFilter === "revenue") return b.total - a.total || b.orders - a.orders;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [clientFilter, clientSearch, customerSummaries, typeFilter]);

  const customerProfilesByKey = useMemo(() => {
    const map = new Map<string, CustomerProfile>();
    for (const profile of customerProfiles) {
      const userKey = profile.user_id?.trim();
      const cnpjKey = profile.cnpj?.replace(/\D/g, "");
      if (userKey) map.set(userKey, profile);
      if (cnpjKey) map.set(cnpjKey, profile);
    }
    return map;
  }, [customerProfiles]);

  const selectedDetailsProfile = useMemo(() => {
    if (!detailsCustomer) return null;
    if (detailsCustomer.userId && customerProfilesByKey.has(detailsCustomer.userId)) {
      return customerProfilesByKey.get(detailsCustomer.userId) ?? null;
    }
    const cnpjKey = detailsCustomer.cnpj?.replace(/\D/g, "");
    if (cnpjKey && customerProfilesByKey.has(cnpjKey)) {
      return customerProfilesByKey.get(cnpjKey) ?? null;
    }
    return null;
  }, [customerProfilesByKey, detailsCustomer]);

  const detailUserId = detailsCustomer?.userId ?? selectedDetailsProfile?.user_id ?? null;

  const { data: detailAddresses = [] } = useQuery({
    queryKey: ["admin-customer-addresses", detailUserId],
    enabled: detailsOpen && Boolean(detailUserId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CUSTOMER_ADDRESSES_TABLE)
        .select("id,user_id,label,is_default,cep,street,number,complement,neighborhood,city,state,ibge,created_at,updated_at")
        .eq("user_id", detailUserId as string)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => customerAddressFromRow(row)) as CustomerAddress[];
    },
  });

  useEffect(() => {
    setDraftType(selectedCustomer?.customerType ?? "cliente");
  }, [selectedCustomer]);

  useEffect(() => {
    if (!detailsOpen) {
      setDetailsCustomer(null);
    }
  }, [detailsOpen]);

  useEffect(() => {
    if (detailsOpen && selectedDetailsProfile) {
      setDraftRepresentanteId(selectedDetailsProfile.representante_id ?? "");
    }
  }, [detailsOpen, selectedDetailsProfile]);

  const openEditor = (customer: AdminCustomerSummary) => {
    setSelectedCustomer(customer);
    setDraftType(customer.customerType ?? "cliente");
    setEditorOpen(true);
  };

  const openDetails = (customer: AdminCustomerSummary) => {
    setDetailsCustomer(customer);
    setDetailsOpen(true);
  };

  const updateCustomerType = async (customer: AdminCustomerSummary, value: string) => {
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
      console.error("Erro ao atualizar tipo do cliente", error);
      toast.error("Não foi possível atualizar o tipo do cliente.");
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
      console.error("Erro ao atualizar tipo do cliente", error);
      toast.error("Não foi possível atualizar o tipo do cliente.");
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
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-3 sm:space-y-4">
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

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {customerTypes.map((type) => (
            <Badge key={type.name} variant="outline" className="rounded-full border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] text-primary">
              {type.label}: {typeCounts[type.name] ?? 0}
            </Badge>
          ))}
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] text-muted-foreground">
            Sem tipo: {typeCounts["unknown"] ?? 0}
          </Badge>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Input
            placeholder="Pesquisar cliente (nome, empresa, telefone, CNPJ)"
            value={clientSearch}
            onChange={(e) => onClientSearchChange(e.target.value)}
            className="h-10 sm:h-11 rounded-2xl border-border/70 bg-background"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={clientFilter === "all" ? "default" : "outline"}
              className="h-10 sm:h-9 rounded-full px-3 text-[13px]"
              onClick={() => onClientFilterChange("all")}
            >
              A-Z
            </Button>
            <Button
              type="button"
              variant={clientFilter === "orders" ? "default" : "outline"}
              className="h-10 sm:h-9 rounded-full px-3 text-[13px]"
              onClick={() => onClientFilterChange("orders")}
            >
              Mais pedidos
            </Button>
            <Button
              type="button"
              variant={clientFilter === "revenue" ? "default" : "outline"}
              className="h-10 sm:h-9 rounded-full px-3 text-[13px]"
              onClick={() => onClientFilterChange("revenue")}
            >
              Maior gasto
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={typeFilter === null ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[13px]"
            onClick={() => setTypeFilter(null)}
          >
            Todos
          </Button>
          {customerTypes.map((type) => (
            <Button
              key={type.name}
              type="button"
              variant={typeFilter === type.name ? "default" : "outline"}
              className="h-10 sm:h-9 rounded-full px-3 text-[13px]"
              onClick={() => setTypeFilter(typeFilter === type.name ? null : type.name)}
            >
              {type.label}
            </Button>
          ))}
          <Button
            type="button"
            variant={typeFilter === "unknown" ? "default" : "outline"}
            className="h-10 sm:h-9 rounded-full px-3 text-[13px]"
            onClick={() => setTypeFilter(typeFilter === "unknown" ? null : "unknown")}
          >
            Sem tipo
          </Button>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="rounded-[1.1rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            Nenhum cliente encontrado ainda.
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => {
              const key = getCustomerKey(customer);
              const isUpdating = updatingCustomerKey === key;

              return (
                <div
                  key={key}
                  className="min-w-0 rounded-[1.15rem] border border-border/70 bg-card p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.03)]"
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

                    <div className="flex flex-col gap-2 sm:items-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 sm:h-8 rounded-full px-3 text-[13px] sm:text-[12px]"
                        onClick={() => openDetails(customer)}
                      >
                        Ver dados
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 sm:h-8 rounded-full px-3 text-[13px] sm:text-[12px]"
                        onClick={() => openEditor(customer)}
                      >
                        Alterar tipo
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2.5 sm:mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {customer.customerType ? (
                      <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] text-primary">
                        {customerTypeLabel(customer.customerType)}
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
                        {formatCnpjDisplay(customer.cnpj)}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-2.5 sm:mt-3 rounded-[1rem] border border-border/70 bg-muted/25 p-2.5 sm:p-3">
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
                      onValueChange={(value) => updateCustomerType(customer, value)}
                      disabled={!customer.cnpj || isUpdating}
                    >
                      <SelectTrigger className="h-10 rounded-2xl bg-background">
                        <SelectValue placeholder="Selecione um tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {customerTypes.map((type) => (
                          <SelectItem key={type.name} value={type.name}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      A regra fica salva por CNPJ. Se o cliente criar conta no front depois, ele herda essa definição.
                    </p>
                  </div>

                  <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3 border-t border-border/70 pt-3 sm:pt-4">
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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[92vh] w-[min(98vw,640px)] max-w-[640px] overflow-hidden rounded-[1.5rem] border-border/70 p-0">
          <div className="flex max-h-[92vh] flex-col overflow-hidden">
            <DialogHeader className="border-b border-border/70 px-4 py-3 sm:px-5 sm:py-4">
              <DialogTitle className="text-left text-[1.05rem] sm:text-[1.1rem] font-black tracking-[-0.04em] text-foreground">
                Dados do cliente
              </DialogTitle>
              <DialogDescription className="text-left text-[12px] sm:text-[13px] text-muted-foreground">
                Cadastro, endereço e vínculo com o Proxsys.
              </DialogDescription>
            </DialogHeader>

            {detailsCustomer ? (
              <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
                <div className="space-y-4 sm:space-y-5">
                  <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[1.15rem] font-black tracking-[-0.04em] text-foreground">{detailsCustomer.name}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">{detailsCustomer.company || "Sem empresa vinculada"}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] text-primary"
                      >
                        {detailsCustomer.customerType ? customerTypeLabel(detailsCustomer.customerType) : "Sem tipo"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      <DetailField label="CNPJ" value={formatCnpjDisplay(detailsCustomer.cnpj ?? "") || "—"} />
                      <DetailField label="Telefone" value={detailsCustomer.phone || "—"} />
                      <DetailField label="Pedidos" value={String(detailsCustomer.orders)} />
                      <DetailField label="Total gasto" value={formatBRL(detailsCustomer.total)} />
                    </div>

                    {selectedDetailsProfile ? (
                      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                          Perfil completo
                        </Badge>
                        <span>Cadastrado em {formatDateTime(selectedDetailsProfile.created_at)}</span>
                      </div>
                    ) : (
                      <p className="mt-2.5 text-[11px] text-muted-foreground">
                        Cliente agregado por CNPJ — sem conta no front.
                      </p>
                    )}
                  </div>

                  {detailAddresses.length > 0 ? (
                    <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        Endereço{detailAddresses.length > 1 ? "s" : ""}
                      </p>
                      <div className="mt-3 space-y-3">
                        {detailAddresses.map((addr) => (
                          <div key={addr.id} className="rounded-[1rem] border border-border/70 bg-muted/20 p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-foreground">{addr.label}</span>
                              {addr.is_default ? (
                                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">Padrão</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1.5 text-[13px] leading-5 text-foreground">
                              {[addr.street, addr.number].filter(Boolean).join(", ") || "—"}
                              {addr.complement ? `, ${addr.complement}` : ""}
                            </p>
                            <p className="text-[12px] leading-5 text-muted-foreground">
                              {[addr.neighborhood, addr.city, addr.state].filter(Boolean).join(" · ")}
                              {addr.cep ? ` — CEP ${addr.cep}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : selectedDetailsProfile ? (
                    <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Endereço (perfil)</p>
                      <p className="mt-3 text-[14px] leading-6 text-foreground">
                        {[
                          selectedDetailsProfile.address_street,
                          selectedDetailsProfile.address_number,
                        ].filter(Boolean).join(", ") || "—"}
                        {selectedDetailsProfile.address_complement ? `, ${selectedDetailsProfile.address_complement}` : ""}
                      </p>
                      <p className="text-[13px] leading-6 text-muted-foreground">
                        {[
                          selectedDetailsProfile.address_neighborhood,
                          selectedDetailsProfile.address_city,
                          selectedDetailsProfile.address_state,
                        ].filter(Boolean).join(" · ")}
                        {selectedDetailsProfile.address_cep ? ` — CEP ${selectedDetailsProfile.address_cep}` : ""}
                      </p>
                    </div>
                  ) : null}

                  {selectedDetailsProfile ? (
                    <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        Representante
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Select
                          value={draftRepresentanteId}
                          onValueChange={setDraftRepresentanteId}
                        >
                          <SelectTrigger className="h-10 rounded-2xl flex-1">
                            <SelectValue placeholder="Selecionar representante" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sem representante</SelectItem>
                            {adminUsers.filter((u) => u.is_active).map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {u.display_name || u.email} · {getRoleLabel(u.role)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          className="h-10 rounded-2xl px-4 text-sm shrink-0"
                          disabled={representanteSaving || draftRepresentanteId === (selectedDetailsProfile.representante_id ?? "")}
                          onClick={async () => {
                            setRepresentanteSaving(true);
                            try {
                              const { error } = await supabase.rpc("set_customer_representante", {
                                p_customer_user_id: selectedDetailsProfile.user_id,
                                p_representante_id: draftRepresentanteId || null,
                              });
                              if (error) throw error;
                              toast.success("Representante atualizado.");
                            } catch {
                              toast.error("Erro ao atualizar representante.");
                            } finally {
                              setRepresentanteSaving(false);
                            }
                          }}
                        >
                          {representanteSaving ? "Salvando..." : "Salvar"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {selectedDetailsProfile ? (
                    <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Vínculo Proxsys</p>
                        {selectedDetailsProfile.proxis_found ? (
                          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                            <DetailField label="PES ID" value={String(selectedDetailsProfile.proxis_pes_id ?? "—")} />
                            <DetailField label="TPR ID" value={String(selectedDetailsProfile.proxis_tpr_id ?? "—")} />
                            <DetailField label="Sincronizado" value={formatDateTime(selectedDetailsProfile.proxis_synced_at)} />
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3">
                            <p className="text-[13px] leading-6 text-muted-foreground">
                              Este cliente ainda não está vinculado ao Proxsys.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-full px-3 text-[12px]"
                              disabled={syncingProxis}
                              onClick={async () => {
                                const cnpj = selectedDetailsProfile.cnpj || detailsCustomer.cnpj;
                                if (!cnpj) { toast.error("CNPJ não encontrado."); return; }
                                setSyncingProxis(true);
                                try {
                                  const { syncCustomerProxisLink } = await import("@/lib/proxisCustomer");
                                  await syncCustomerProxisLink(cnpj, detailUserId);
                                  toast.success("Vínculo Proxsys atualizado.");
                                  setDetailsOpen(false);
                                } catch {
                                  toast.error("Erro ao sincronizar com Proxsys.");
                                } finally {
                                  setSyncingProxis(false);
                                }
                              }}
                            >
                              {syncingProxis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                              Sincronizar agora
                            </Button>
                          </div>
                        )}
                      </div>
                  ) : detailsCustomer.cnpj ? (
                    <div className="rounded-[1.25rem] border border-border/70 bg-background p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Vínculo Proxsys</p>
                      <p className="mt-3 text-[13px] leading-6 text-muted-foreground">
                        Cliente sem perfil completo. Use o botão abaixo para verificar o vínculo pelo CNPJ.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 h-9 rounded-full px-3 text-[12px]"
                        disabled={syncingProxis}
                        onClick={async () => {
                          setSyncingProxis(true);
                          try {
                            const { syncCustomerProxisLink } = await import("@/lib/proxisCustomer");
                            await syncCustomerProxisLink(detailsCustomer.cnpj!, detailUserId);
                            toast.success("Vínculo Proxsys atualizado.");
                            setDetailsOpen(false);
                          } catch {
                            toast.error("Erro ao sincronizar com Proxsys.");
                          } finally {
                            setSyncingProxis(false);
                          }
                        }}
                      >
                        {syncingProxis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Sincronizar agora
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editorOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && saving) return;
          setEditorOpen(nextOpen);
        }}
      >
        <DialogContent className="max-w-[34rem] rounded-[1.35rem] sm:rounded-[1.75rem] border-border/70">
          <DialogHeader className="text-left">
            <DialogDescription className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Ajuste administrativo
            </DialogDescription>
            <DialogTitle className="text-[1.25rem] sm:text-[1.45rem] font-black tracking-[-0.04em] text-foreground">
              Alterar tipo de cliente
            </DialogTitle>
            <p className="text-[13px] sm:text-sm leading-5 sm:leading-6 text-muted-foreground">
              Altere a faixa comercial do cadastro para refletir a tabela correta no catálogo e no admin.
            </p>
          </DialogHeader>

          {selectedCustomer ? (
            <div className="space-y-3 sm:space-y-4 pt-2">
              <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-3 sm:p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Cliente selecionado</p>
                <p className="mt-1 text-[15px] sm:text-base font-semibold text-foreground">{selectedCustomer.name}</p>
                <p className="mt-1 text-[12px] sm:text-sm text-muted-foreground">
                  {selectedCustomer.company || "Sem empresa vinculada"} {selectedCustomer.cnpj ? `• ${formatCnpjDisplay(selectedCustomer.cnpj)}` : ""}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-type-select">Tipo de cliente</Label>
                <div className="flex gap-2">
                  <Select value={draftType} onValueChange={(value) => setDraftType(value)}>
                    <SelectTrigger id="customer-type-select" className="h-10 sm:h-11 rounded-2xl flex-1">
                      <SelectValue placeholder="Selecione um tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerTypes.map((type) => (
                        <SelectItem key={type.name} value={type.name}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 sm:h-11 w-10 sm:w-11 rounded-2xl shrink-0"
                    onClick={() => {
                      setNewTypeName("");
                      setNewTypeOpen(true);
                    }}
                    title="Adicionar novo tipo"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 pt-2 sm:gap-2">
            <Button type="button" variant="outline" className="h-10 sm:h-11 rounded-2xl px-5 text-sm" onClick={closeEditor} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" className="h-10 sm:h-11 rounded-2xl px-5 text-sm" onClick={saveCustomerType} disabled={saving || !selectedCustomer?.cnpj}>
              {saving ? "Salvando..." : "Salvar alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newTypeOpen} onOpenChange={setNewTypeOpen}>
        <DialogContent className="max-w-[26rem] rounded-[1.5rem] border-border/70">
          <DialogHeader>
            <DialogTitle className="text-[1.05rem] font-black tracking-[-0.04em]">Novo tipo de cliente</DialogTitle>
            <DialogDescription className="text-[13px] leading-6 text-muted-foreground">
              Crie um novo tipo que ficará disponível para todos os clientes e tabelas de preço.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-type-name">Nome do tipo</Label>
              <Input
                id="new-type-name"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Ex.: Atacadista"
                className="h-11 rounded-2xl border-border/70 bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTypeName.trim()) {
                    addCustomType(newTypeName);
                    setDraftType(newTypeName.trim().toLowerCase());
                    setNewTypeName("");
                    setNewTypeOpen(false);
                  }
                }}
              />
              {newTypeName.trim() ? (
                <p className="text-[12px] text-muted-foreground">
                  Será salvo como: <span className="font-semibold text-foreground">{newTypeName.trim().toLowerCase()}</span>
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="mt-0 rounded-2xl px-4 text-sm" onClick={() => { setNewTypeOpen(false); setNewTypeName(""); }}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="mt-0 rounded-2xl px-4 text-sm"
              disabled={!newTypeName.trim()}
              onClick={() => {
                addCustomType(newTypeName);
                setDraftType(newTypeName.trim().toLowerCase());
                setNewTypeName("");
                setNewTypeOpen(false);
              }}
            >
              Criar tipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
