import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerDataFields } from "@/components/pedido/CustomerDataFields";
import { useAuth } from "@/hooks/useAuth";
import { AuthStatusScreen } from "@/components/auth/AuthStatusScreen";
import { useCnpjValidation } from "@/hooks/useCnpjValidation";
import { toast } from "sonner";
import { ClientAuthStage } from "@/components/auth/ClientAuthStage";
import { getSafeReturnToPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { DEFAULT_CUSTOMER_TYPE } from "@/lib/pricing";
import { LockKeyhole, Mail, ShieldCheck, Eye, EyeOff } from "lucide-react";

const emptyCustomerForm = {
  name: "",
  phone: "",
  company: "",
  cnpj: "",
  customer_type: DEFAULT_CUSTOMER_TYPE,
};

const AUTH_FEEDBACK_MIN_MS = 700;

type AuthFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
  autoComplete: string;
  required: boolean;
  icon: LucideIcon;
  maxLength?: number;
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
  maxLength,
  onBlur,
}: AuthFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

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
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur ?? (() => {})}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className={cn("h-12 rounded-2xl border-border/70 bg-background pl-14 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30", isPassword && "pr-12")}
        />
        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const returnTo = getSafeReturnToPath(searchParams.get("returnTo"));

  const cnpjValidation = useCnpjValidation(customerForm.cnpj, cnpjTouched);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const startedAt = Date.now();
    setSubmitting(true);
    try {
      const error = await signIn(signInEmail.trim(), signInPassword);
      const elapsed = Date.now() - startedAt;
      if (elapsed < AUTH_FEEDBACK_MIN_MS) {
        await new Promise((resolve) => window.setTimeout(resolve, AUTH_FEEDBACK_MIN_MS - elapsed));
      }
      if (error) {
        console.error("Erro ao fazer login", error);
        const msg = error.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("confirme") || msg.includes("confirm")) {
          toast.error("Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.");
        } else if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("incorret")) {
          toast.error("E-mail ou senha incorretos.");
        } else {
          toast.error(error.message || "Erro ao fazer login.");
        }
      }
    } catch (err) {
      console.error("Exceção ao fazer login", err);
      toast.error("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
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

    if (signUpPassword.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (signUpPassword.length > 64) {
      toast.error("A senha deve ter no máximo 64 caracteres.");
      return;
    }

    if (!/[A-Z]/.test(signUpPassword)) {
      toast.error("A senha deve conter pelo menos uma letra maiúscula.");
      return;
    }

    if (!/[a-z]/.test(signUpPassword)) {
      toast.error("A senha deve conter pelo menos uma letra minúscula.");
      return;
    }

    if (!/\d/.test(signUpPassword)) {
      toast.error("A senha deve conter pelo menos um número.");
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(signUpPassword)) {
      toast.error("A senha deve conter pelo menos um caractere especial.");
      return;
    }

    if (signUpPassword !== signUpPasswordConfirm) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    const { error, needsEmailConfirmation } = await signUpCustomer({
      ...customerForm,
      email: signUpEmail.trim(),
      password: signUpPassword,
    });

    if (error) {
      const message = error.message.toLowerCase() ?? "";
      if (message.includes("customer_profiles_cnpj_unique") || message.includes("duplicate")) {
        toast.error("Este CNPJ ja possui cadastro.");
      } else {
        console.error("Erro ao criar conta", error);
        toast.error("Erro ao criar conta");
      }
      setSubmitting(false);
      return;
    }

    if (needsEmailConfirmation) {
      toast.success("Conta criada! Confirme seu e-mail para concluir o cadastro.");
    } else {
      toast.success("Conta criada com sucesso!");
      navigate(returnTo ?? "/conta", { replace: true, viewTransition: true });
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
    return <Navigate to={isAdmin ? "/admin" : returnTo ?? "/conta"} replace />;
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
          <Tabs value={authTab} onValueChange={(value) => setAuthTab(value as "entrar" | "cadastro")} className="flex min-h-0 w-full flex-1 flex-col">
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
                    Esqueceu a senha
                  </a>
                </div>

                <Button type="submit" className="h-12 w-full rounded-2xl text-[15px] font-semibold" disabled={submitting}>
                  {submitting ? "Autenticando..." : "Entrar"}
                </Button>

                <div className="flex items-center justify-center gap-2 pt-1 text-[12px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Ambiente seguro - seus dados estão protegidos
                </div>
              </form>
            </TabsContent>

            <TabsContent value="cadastro" className="mt-0 flex-1 min-h-0">
              <form
                onSubmit={handleSignUp}
                className="mt-5 flex min-h-full flex-col space-y-4 rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_12px_32px_rgba(16,24,40,0.08)]"
              >
                <CustomerDataFields
                  form={customerForm}
                  onChange={(patch) => setCustomerForm((prev) => ({ ...prev, ...patch }))}
                  onCnpjBlur={() => setCnpjTouched(true)}
                  cnpjValidation={cnpjValidation}
                />

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
                    placeholder="Mínimo 8 caracteres"
                    value={signUpPassword}
                    onChange={setSignUpPassword}
                    type="password"
                    autoComplete="new-password"
                    required
                    maxLength={64}
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
                    maxLength={64}
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








