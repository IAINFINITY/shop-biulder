import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { useCnpjValidation } from "@/hooks/useCnpjValidation";
import { toast } from "sonner";
import { DEFAULT_CUSTOMER_TYPE } from "@/lib/pricing";
import { ClientAuthStage } from "@/components/auth/ClientAuthStage";
import { Building2, LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";

const emptyCustomerForm = {
  name: "",
  phone: "",
  company: "",
  cnpj: "",
  customer_type: DEFAULT_CUSTOMER_TYPE,
};

const emptyAddressData = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  ibge: "",
};

const AUTH_FEEDBACK_MIN_MS = 700;

type AuthFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  icon: LucideIcon;
  onBlur?: () => void;
};

function AuthField({
  id,
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  autoComplete,
  required = false,
  icon: Icon,
  onBlur,
}: AuthFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <span className="pointer-events-none absolute left-10 top-1/2 h-7 w-px -translate-y-1/2 bg-border/80" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className="h-12 rounded-2xl border-border/70 bg-background pl-14 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
        />
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { user, isAdmin, loading, isResolvingAccess, signIn, signUpCustomer } = useAuth();
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState("");
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [cnpjTouched, setCnpjTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authTab, setAuthTab] = useState<"entrar" | "cadastro">("entrar");

  const cnpjValidation = useCnpjValidation(customerForm.cnpj, cnpjTouched);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const startedAt = Date.now();
    setSubmitting(true);
    const error = await signIn(signInEmail.trim(), signInPassword);
    const elapsed = Date.now() - startedAt;
    if (elapsed < AUTH_FEEDBACK_MIN_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, AUTH_FEEDBACK_MIN_MS - elapsed));
    }
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

    setSubmitting(true);
    const { error, needsEmailConfirmation } = await signUpCustomer({
      ...customerForm,
      ...emptyAddressData,
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
      navigate("/conta", { replace: true, viewTransition: true });
    }
    setSubmitting(false);
  };

  if (loading || isResolvingAccess) {
    return (
      <AuthStatusScreen
        eyebrow="Acesso cliente"
        title="Abrindo sua conta"
        description="Estamos validando sua sessão para carregar o acesso certo sem trocar de área no meio do caminho."
      />
    );
  }

  if (user) {
    return <Navigate to={isAdmin ? "/admin" : "/conta"} replace />;
  }

  return (
    <ClientAuthStage>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2.25rem] border border-border/70 bg-background text-foreground shadow-[0_16px_40px_rgba(16,24,40,0.08)]">
        <div className="border-b border-border/70 px-6 py-7 sm:px-8">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/25 bg-primary/5 shadow-[0_8px_22px_rgba(16,24,40,0.05)]">
            <img src="/faviconV2.png" alt="Clinic+ logo" className="h-14 w-auto" />
          </div>

          <div className="mt-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">Acesso cliente</p>
            <h2 className="mt-3 text-[clamp(1.9rem,2.8vw,2.7rem)] font-black leading-[1] tracking-[-0.05em] text-foreground">
              {authTab === "entrar" ? "Entrar na conta" : "Criar conta corporativa"}
            </h2>
            <p className="mx-auto mt-3 max-w-[34ch] text-sm leading-6 text-muted-foreground">
              {authTab === "entrar"
                ? "Entre com seu e-mail e senha cadastrados."
                : "Preencha os dados da sua empresa para criar sua conta B2B."}
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6 sm:px-8">
          <Tabs value={authTab} onValueChange={setAuthTab} className="flex min-h-0 w-full flex-1 flex-col">
            <TabsList className="grid h-12 w-full grid-cols-2 items-stretch rounded-full border border-border/70 bg-muted/60 p-1">
              <TabsTrigger
                value="entrar"
                className="flex h-10 w-full items-center justify-center rounded-full px-5 text-[13px] font-medium leading-none text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                Entrar
              </TabsTrigger>
              <TabsTrigger
                value="cadastro"
                className="flex h-10 w-full items-center justify-center rounded-full px-5 text-[13px] font-medium leading-none text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                Criar conta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="entrar" className="mt-0 flex-1 min-h-0">
              <form
                onSubmit={handleSignIn}
                className="mt-5 flex min-h-full flex-col space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]"
              >
                <AuthField
                  id="signin-email"
                  label="E-mail corporativo"
                  placeholder="seu@empresa.com"
                  value={signInEmail}
                  onChange={setSignInEmail}
                  type="email"
                  autoComplete="email"
                  required
                  icon={Mail}
                />

                <AuthField
                  id="signin-password"
                  label="Senha"
                  placeholder="Sua senha"
                  value={signInPassword}
                  onChange={setSignInPassword}
                  type="password"
                  autoComplete="current-password"
                  required
                  icon={LockKeyhole}
                />

                <div className="flex items-center justify-between gap-4 text-[12.5px]">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                    <Checkbox className="h-4 w-4 border-primary data-[state=checked]:bg-primary" />
                    Lembrar acesso
                  </label>
                  <a href="#" className="text-primary transition-colors hover:text-primary/80">
                    Esqueceu a senha?
                  </a>
                </div>

                <Button type="submit" className="h-12 w-full rounded-2xl text-[15px] font-semibold" disabled={submitting}>
                  {submitting ? "Autenticando..." : "Entrar"}
                </Button>

                <div className="flex items-center justify-center gap-2 pt-1 text-[12px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Ambiente seguro â€” seus dados estÃ£o protegidos
                </div>
              </form>
            </TabsContent>

            <TabsContent value="cadastro" className="mt-0 flex-1 min-h-0">
              <form
                onSubmit={handleSignUp}
                className="mt-5 flex min-h-full flex-col space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <AuthField
                    id="signup-name"
                    label="Nome completo"
                    placeholder="Seu nome"
                    value={customerForm.name}
                    onChange={(value) => setCustomerForm((prev) => ({ ...prev, name: value }))}
                    required
                    icon={UserRound}
                  />

                  <AuthField
                    id="signup-company"
                    label="Empresa"
                    placeholder="Nome da empresa"
                    value={customerForm.company}
                    onChange={(value) => setCustomerForm((prev) => ({ ...prev, company: value }))}
                    required
                    icon={Building2}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <AuthField
                    id="signup-cnpj"
                    label="CNPJ"
                    placeholder="00.000.000/0001-00"
                    value={customerForm.cnpj}
                    onChange={(value) => setCustomerForm((prev) => ({ ...prev, cnpj: value }))}
                    onBlur={() => setCnpjTouched(true)}
                    required
                    icon={Building2}
                  />

                  <AuthField
                    id="signup-phone"
                    label="Telefone"
                    placeholder="(11) 99999-9999"
                    value={customerForm.phone}
                    onChange={(value) => setCustomerForm((prev) => ({ ...prev, phone: value }))}
                    required
                    icon={Phone}
                  />
                </div>

                <AuthField
                  id="signup-email"
                  label="E-mail corporativo"
                  placeholder="seu@empresa.com"
                  value={signUpEmail}
                  onChange={setSignUpEmail}
                  type="email"
                  autoComplete="email"
                  required
                  icon={Mail}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <AuthField
                    id="signup-password"
                    label="Senha"
                    placeholder="MÃ­nimo 6 caracteres"
                    value={signUpPassword}
                    onChange={setSignUpPassword}
                    type="password"
                    autoComplete="new-password"
                    required
                    icon={LockKeyhole}
                  />

                  <AuthField
                    id="signup-password-confirm"
                    label="Confirmar senha"
                    placeholder="Repita a senha"
                    value={signUpPasswordConfirm}
                    onChange={setSignUpPasswordConfirm}
                    type="password"
                    autoComplete="new-password"
                    required
                    icon={LockKeyhole}
                  />
                </div>

                <div className="pt-1">
                  <Button type="submit" className="h-12 w-full rounded-2xl text-[15px] font-semibold" disabled={submitting}>
                    {submitting ? "Criando conta..." : "Criar conta"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ClientAuthStage>
  );
}








