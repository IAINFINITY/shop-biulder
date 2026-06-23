import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { formatCnpjDisplay, formatPhone } from "@/lib/brazilianIds";
import { formatCep } from "@/lib/address";
import clinicMaisLogo from "@/assets/clinicmais-logo.svg";
import { PageHeaderShell } from "@/components/layout/PageHeaderShell";
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPES,
  DEFAULT_CUSTOMER_TYPE,
  normalizeCustomerType,
} from "@/lib/pricing";
import { toast } from "sonner";

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
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!user || isAdmin) return null;

  const displayCnpj = customerProfile
    ? formatCnpjDisplay(customerProfile.cnpj)
    : "—";
  const displayCustomerType = customerProfile
    ? CUSTOMER_TYPE_LABELS[normalizeCustomerType(customerProfile.customer_type)]
    : "—";

  const handleSaveCustomerType = async () => {
    setSavingType(true);
    const error = await updateCustomerType(customerTypeDraft);
    setSavingType(false);
    if (error) {
      toast.error(error.message || "Não foi possível atualizar o tipo de cliente.");
      return;
    }
    toast.success("Tipo de cliente atualizado.");
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeaderShell>
        <div className="flex items-center gap-3">
          <Link to="/" viewTransition>
            <Button variant="ghost" size="icon" aria-label="Voltar ao catálogo">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="font-semibold text-foreground">Minha conta</span>
        </div>
      </PageHeaderShell>

      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="text-center">
          <img src={clinicMaisLogo} alt="Clinic+ Suplemento e Nutrição" className="h-9 w-auto mx-auto" />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">E-mail da conta</p>
              <p className="font-medium text-foreground truncate">{user.email}</p>
            </div>
          </div>

          {isCustomer && customerProfile ? (
            <>
              <div className="flex items-start gap-3 border-t border-border pt-4">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nome</p>
                    <p className="font-medium text-foreground">{customerProfile.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Empresa</p>
                    <p className="font-medium text-foreground">{customerProfile.company}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Telefone</p>
                    <p className="font-medium text-foreground">{formatPhone(customerProfile.phone)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CNPJ</p>
                    <p className="font-medium text-foreground tabular-nums">{displayCnpj}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-muted-foreground">Tipo de cliente</p>
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
                    <div className="flex items-center gap-2">
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
                  {customerProfile.address_cep && (
                    <div>
                      <p className="text-muted-foreground">Endereço</p>
                      <p className="font-medium text-foreground">
                        {customerProfile.address_street}
                        {customerProfile.address_number ? `, ${customerProfile.address_number}` : ""}
                        {customerProfile.address_complement
                          ? ` - ${customerProfile.address_complement}`
                          : ""}
                      </p>
                      <p className="text-foreground">
                        {customerProfile.address_neighborhood} · {customerProfile.address_city}/
                        {customerProfile.address_state}
                      </p>
                      <p className="text-foreground tabular-nums">
                        CEP {formatCep(customerProfile.address_cep)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground border-t border-border pt-4">
              Seu cadastro está em processamento. Se acabou de criar a conta, confirme o e-mail e
              entre novamente. Caso o problema persista, entre em contato com o suporte.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
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
    </div>
  );
}
