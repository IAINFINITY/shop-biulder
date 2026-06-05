import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressFields } from "@/components/customer/AddressFields";
import { CustomerDataFields } from "@/components/customer/CustomerDataFields";
import { useAuth } from "@/hooks/useAuth";
import { useCnpjValidation } from "@/hooks/useCnpjValidation";
import { assertAddressReady, emptyAddressForm } from "@/lib/address";
import { toast } from "sonner";
import clinicMaisLogo from "@/assets/clinicmais-logo.png";

const emptyCustomerForm = {
  name: "",
  phone: "",
  company: "",
  cnpj: "",
};

export default function Login() {
  const navigate = useNavigate();
  const { user, isAdmin, loading, signIn, signUpCustomer } = useAuth();
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState("");
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [cnpjTouched, setCnpjTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cnpjValidation = useCnpjValidation(customerForm.cnpj, cnpjTouched);

  useEffect(() => {
    if (!loading && user) {
      navigate(isAdmin ? "/admin" : "/conta", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const error = await signIn(signInEmail.trim(), signInPassword);
    if (error) toast.error(error.message);
    setSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setCnpjTouched(true);

    const cnpjMessage = cnpjValidation.assertCnpjReady();
    if (cnpjMessage) {
      if (cnpjMessage === "Validando CNPJ...") toast.info(cnpjMessage);
      else toast.error(cnpjMessage);
      return;
    }

    if (signUpPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (signUpPassword !== signUpPasswordConfirm) {
      toast.error("As senhas nao coincidem.");
      return;
    }

    const addressMessage = assertAddressReady(addressForm);
    if (addressMessage) {
      toast.error(addressMessage);
      return;
    }

    setSubmitting(true);
    const { error, needsEmailConfirmation } = await signUpCustomer({
      ...customerForm,
      ...addressForm,
      email: signUpEmail.trim(),
      password: signUpPassword,
    });

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("customer_profiles_cnpj_unique") || message.includes("duplicate")) {
        toast.error("Este CNPJ ja possui cadastro.");
      } else {
        toast.error(error.message || "Erro ao criar conta");
      }
      setSubmitting(false);
      return;
    }

    if (needsEmailConfirmation) {
      toast.success("Conta criada! Confirme seu e-mail para concluir o cadastro.");
    } else {
      toast.success("Conta criada com sucesso!");
      navigate("/conta", { replace: true });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <img src={clinicMaisLogo} alt="Clinic+ Suplemento e Nutrição" className="h-10 w-auto mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Area do cliente B2B</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Cadastro e login para identificacao da sua empresa. O catalogo e os pedidos continuam
            disponiveis sem login.
          </p>
        </div>

        <Tabs defaultValue="entrar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entrar">Entrar</TabsTrigger>
            <TabsTrigger value="cadastro">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="entrar">
            <form onSubmit={handleSignIn} className="space-y-4 rounded-xl border border-border bg-card p-5">
              <div className="space-y-2">
                <Label htmlFor="signin-email">E-mail</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Senha</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="Senha"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="cadastro">
            <form onSubmit={handleSignUp} className="space-y-4 rounded-xl border border-border bg-card p-5">
              <CustomerDataFields
                idPrefix="signup"
                form={customerForm}
                onChange={(patch) => setCustomerForm((prev) => ({ ...prev, ...patch }))}
                onCnpjBlur={() => setCnpjTouched(true)}
                cnpjValidation={cnpjValidation}
              />

              <AddressFields
                idPrefix="signup"
                form={addressForm}
                onChange={(patch) => setAddressForm((prev) => ({ ...prev, ...patch }))}
              />

              <div className="space-y-2">
                <Label htmlFor="signup-email">E-mail</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password-confirm">Confirmar senha</Label>
                <Input
                  id="signup-password-confirm"
                  type="password"
                  value={signUpPasswordConfirm}
                  onChange={(e) => setSignUpPasswordConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Criando conta..." : "Criar conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          ← Voltar ao catalogo
        </Link>
      </div>
    </div>
  );
}
