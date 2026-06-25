import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, LogOut, ShieldCheck, ShoppingBag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { formatCnpjDisplay, formatPhone } from "@/lib/brazilianIds";
import { formatCep } from "@/lib/address";
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPES,
  DEFAULT_CUSTOMER_TYPE,
  normalizeCustomerType,
} from "@/lib/pricing";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Badge } from "@/components/ui/badge";

export default function Account() {
  const navigate = useNavigate();
  const { user, isAdmin, isCustomer, customerProfile, loading, signOut, updateCustomerType } = useAuth();
  const [customerTypeDraft, setCustomerTypeDraft] = useState(DEFAULT_CUSTOMER_TYPE);
  const [savingType, setSavingType] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true, viewTransition: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/admin", { replace: true, viewTransition: true });
    }
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    setCustomerTypeDraft(normalizeCustomerType(customerProfile?.customer_type));
  }, [customerProfile?.customer_type]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!user || isAdmin) return null;

  const displayCnpj = customerProfile ? formatCnpjDisplay(customerProfile.cnpj) : "—";
  const displayCustomerType = customerProfile
    ? CUSTOMER_TYPE_LABELS[normalizeCustomerType(customerProfile.customer_type)]
    : "—";

  const handleSaveCustomerType = async () => {
    setSavingType(true);
    const error = await updateCustomerType(customerTypeDraft);
    setSavingType(false);
    if (error) {
      toast.error(error.message || "Nao foi possivel atualizar o tipo de cliente.");
      return;
    }
    toast.success("Tipo de cliente atualizado.");
  };

  return (
    <AuthShell
      badge="Minha conta"
      title="Perfil da empresa"
      description="Veja os dados da sua conta, ajuste o tipo de cliente e mantenha o cadastro pronto para o atendimento do Clinic+."
      highlights={[
        {
          title: "Acesso ao perfil",
          text: "Seu e-mail fica vinculado a uma conta B2B com identidade própria.",
        },
        {
          title: "Tipo de cliente",
          text: "O tipo define a tabela aplicada ao seu cadastro e ao pedido.",
        },
        {
          title: "Dados salvos",
          text: "Empresa, CNPJ e endereço ficam organizados para consultas futuras.",
        },
      ]}
      footer={
        <Link
          to="/"
          viewTransition
          className="inline-flex items-center justify-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Ir ao catálogo
        </Link>
      }
      cardClassName="max-w-[680px]"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium">
            Conta B2B
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium">
            Preços por perfil
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium">
            Cadastro da empresa
          </Badge>
        </div>

        <div className="rounded-[1.75rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                E-mail da conta
              </p>
              <p className="truncate text-base font-medium text-foreground">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Status
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Conta ativa</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Perfil
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{displayCustomerType}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Acesso
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Cliente B2B</p>
            </div>
          </div>
        </div>

        {isCustomer && customerProfile ? (
          <div className="rounded-[1.75rem] border border-border/70 bg-background/95 p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Dados da empresa</h3>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Nome</p>
                <p className="font-medium text-foreground">{customerProfile.name}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Empresa</p>
                <p className="font-medium text-foreground">{customerProfile.company}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Telefone</p>
                <p className="font-medium text-foreground">{formatPhone(customerProfile.phone)}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">CNPJ</p>
                <p className="font-medium text-foreground tabular-nums">{displayCnpj}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Tipo de cliente</p>
              </div>
              <div className="mt-4 space-y-3">
                <Select
                  value={customerTypeDraft}
                  onValueChange={(value) => setCustomerTypeDraft(normalizeCustomerType(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CUSTOMER_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSaveCustomerType()}
                    disabled={savingType || customerTypeDraft === normalizeCustomerType(customerProfile.customer_type)}
                  >
                    {savingType ? "Salvando..." : "Salvar tipo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Tipo atual: {displayCustomerType}
                  </p>
                </div>
              </div>
            </div>

            {customerProfile.address_cep && (
              <div className="mt-6 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Endereço
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {customerProfile.address_street}
                  {customerProfile.address_number ? `, ${customerProfile.address_number}` : ""}
                  {customerProfile.address_complement ? ` - ${customerProfile.address_complement}` : ""}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {customerProfile.address_neighborhood} · {customerProfile.address_city}/{customerProfile.address_state}
                </p>
                <p className="mt-1 text-sm text-foreground tabular-nums">CEP {formatCep(customerProfile.address_cep)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-border/70 bg-background/95 p-5 text-sm text-muted-foreground shadow-sm sm:p-6">
            Seu cadastro está em processamento. Se acabou de criar a conta, confirme o e-mail e
            entre novamente. Caso o problema persista, entre em contato com o suporte.
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/" viewTransition className="flex-1">
            <Button variant="outline" className="w-full">
              Ir ao catálogo
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="flex-1 gap-2 text-muted-foreground"
            onClick={() => {
              void signOut();
              navigate("/login", { replace: true, viewTransition: true });
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
