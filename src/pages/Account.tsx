import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatCnpjDisplay, formatPhone } from "@/lib/brazilianIds";
import { formatCep } from "@/lib/address";
import clinicMaisLogo from "@/assets/clinicmais-logo.png";

export default function Account() {
  const navigate = useNavigate();
  const { user, isAdmin, isCustomer, customerProfile, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex h-14 items-center gap-3 px-4">
          <Link to="/">
            <Button variant="ghost" size="icon" aria-label="Voltar ao catalogo">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="font-semibold text-foreground">Minha conta</span>
        </div>
      </header>

      <div className="container mx-auto max-w-lg px-4 py-8 space-y-6">
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
                  {customerProfile.address_cep && (
                    <div>
                      <p className="text-muted-foreground">Endereco</p>
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
              Seu cadastro esta em processamento. Se acabou de criar a conta, confirme o e-mail e
              entre novamente. Caso o problema persista, entre em contato com o suporte.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/" className="flex-1">
            <Button variant="outline" className="w-full">
              Ir ao catalogo
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="flex-1 gap-2 text-muted-foreground"
            onClick={() => {
              void signOut();
              navigate("/login", { replace: true });
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
