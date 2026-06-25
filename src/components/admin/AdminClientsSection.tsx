import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/formatMoney";
import { AdminSectionHeader } from "./AdminSectionHeader";
import type { AdminCustomerSummary } from "./adminTypes";

type AdminClientsSectionProps = {
  customerSummaries: AdminCustomerSummary[];
  clientSearch: string;
  onClientSearchChange: (value: string) => void;
  clientFilter: "all" | "orders" | "revenue";
  onClientFilterChange: (value: "all" | "orders" | "revenue") => void;
};

export function AdminClientsSection({
  customerSummaries,
  clientSearch,
  onClientSearchChange,
  clientFilter,
  onClientFilterChange,
}: AdminClientsSectionProps) {
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

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]">
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

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
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
          <div className="mt-4 rounded-[1.1rem] border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            Nenhum cliente encontrado ainda.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.cnpj || customer.name}
                className="rounded-[1.15rem] border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 font-semibold text-primary">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-5 text-foreground">{customer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{customer.company || "Sem empresa vinculada"}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
