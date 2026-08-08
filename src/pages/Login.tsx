import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCnpj, formatPhone, onlyDigits } from "@/lib/brazilianIds";
import { useAuth } from "@/hooks/useAuth";
import { useCnpjValidation } from "@/hooks/useCnpjValidation";
import { toast } from "sonner";
import { ClientAuthStage } from "@/components/auth/ClientAuthStage";
import { getSafeReturnToPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { DEFAULT_CUSTOMER_TYPE } from "@/lib/pricing";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import { translateAuthErrorMessage } from "@/lib/authErrors";
import { sugerirCorrecaoDeEmail } from "@/lib/emailTypo";
import { LockKeyhole, Mail, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { validarSenha } from "@/lib/validarSenha";
import { comTransicaoDeTela } from "@/lib/transicaoDeTela";

const emptyCustomerForm = {
  name: "",
  phone: "",
  company: "",
  cnpj: "",
  customer_type: DEFAULT_CUSTOMER_TYPE,
};

const AUTH_FEEDBACK_MIN_MS = 700;

type EmailAvailabilityState = "idle" | "checking" | "available" | "registered" | "error";

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
      <Label htmlFor={id} className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
  const { user, isAdmin, loading, isResolvingAccess, acessoResolvidoPara, signIn, signUpCustomer } = useAuth();

  const returnTo = getSafeReturnToPath(searchParams.get("returnTo"));

  /**
   * Para onde sair — ou `null` enquanto ainda nao da para saber.
   *
   * A condicao e `acessoResolvidoPara === user.id`, e nao `!isResolvingAccess`.
   * A diferenca decide o destino: o segundo e verdadeiro tambem ANTES de a
   * consulta de papel comecar, e nessa janela `isAdmin` vale `false`. Era o que
   * mandava admin para `/conta` e deixava o `Account` corrigir para `/admin`
   * logo em seguida — duas navegacoes, duas telas em branco.
   */
  const destinoDeSaida =
    user && acessoResolvidoPara === user.id ? (isAdmin ? "/admin" : returnTo ?? "/conta") : null;

  /**
   * A saida do login é animada, e o `<Navigate>` nao anima.
   *
   * O projeto ja tem View Transitions montadas: o CSS define
   * `::view-transition-old(root)` e `-new(root)` com fade e `scale(0.992)` de
   * 240ms. So esta tela ficava de fora — saia por `<Navigate>`, que em
   * react-router 6.30 aceita apenas `to`, `replace`, `state` e `relative`.
   *
   * ## Por que efeito, e nao um `return` antes do formulario
   *
   * A versao anterior devolvia um componente com um spinner assim que `user`
   * aparecia. O comentario dela dizia "mantem o cartao desenhado" — mas o
   * componente renderizava o spinner, nao o cartao. Entao a transicao fotografava
   * **o spinner** como quadro inicial e cruzava para o carregador da proxima
   * rota: dois quadros quase brancos. A animacao rodava (medido:
   * `startViewTransition` chamado 1x) e nao havia nada visivel para animar.
   *
   * Como efeito, o formulario continua na tela ate a navegacao acontecer, e e
   * ele que vira o quadro "antes".
   */
  useEffect(() => {
    if (!destinoDeSaida) return;
    comTransicaoDeTela(() => navigate(destinoDeSaida, { replace: true }));
  }, [destinoDeSaida, navigate]);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState("");
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [cnpjTouched, setCnpjTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authTab, setAuthTab] = useState<"entrar" | "cadastro">("entrar");
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  /**
   * Passo do cadastro.
   *
   * Os 7 campos numa tela so nao cabiam: o formulario pedia ~1136px de uma area
   * util de ~700px. Dividir em dois nao e enfeite — e o que faz cada passo caber
   * sem rolagem na maioria das telas, que era o problema relatado.
   *
   * O corte segue o assunto, e nao a contagem: primeiro **qual empresa**, depois
   * **quem acessa**. O CNPJ vem antes de proposito, porque e ele que preenche a
   * razao social e poupa digitacao no resto.
   */
  const [signUpStep, setSignUpStep] = useState<1 | 2>(1);
  const [signupEmailStatus, setSignupEmailStatus] = useState<EmailAvailabilityState>("idle");
  const recoveryLink = signInEmail.trim()
    ? `/recuperar-senha?email=${encodeURIComponent(signInEmail.trim())}`
    : "/recuperar-senha";

  const cnpjValidation = useCnpjValidation(customerForm.cnpj, cnpjTouched);

  /**
   * Sugestao de dominio, quando o e-mail parece ter erro de digitacao.
   *
   * Nao consulta nada: e comparacao contra lista fixa, no navegador. Por isso
   * nao fura o §21 — a resposta e a mesma para quem tem conta e para quem nao
   * tem. Ver `src/lib/emailTypo.ts`.
   */
  const sugestaoEmailEntrar = sugerirCorrecaoDeEmail(signInEmail);
  const sugestaoEmailCadastro = sugerirCorrecaoDeEmail(signUpEmail);

  useEffect(() => {
    const emailParam = searchParams.get("email")?.trim();
    if (emailParam && !signInEmail) {
      setSignInEmail(emailParam);
    }
  }, [searchParams, signInEmail]);

  useEffect(() => {
    if (authTab !== "cadastro") {
      setSignupEmailStatus("idle");
      return;
    }

    const email = signUpEmail.trim();
    if (!email) {
      setSignupEmailStatus("idle");
      return;
    }

    const isEmailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isEmailLike) {
      setSignupEmailStatus("idle");
      return;
    }

    let cancelled = false;
    setSignupEmailStatus("checking");

    const timer = window.setTimeout(async () => {
      try {
        const supabase = await loadSupabaseClient();
        const { data, error } = await supabase.rpc("check_auth_email_exists", { p_email: email });
        if (cancelled) return;
        if (error) {
          setSignupEmailStatus("error");
          return;
        }
        setSignupEmailStatus(data ? "registered" : "available");
      } catch {
        if (!cancelled) setSignupEmailStatus("error");
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authTab, signUpEmail]);

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
        toast.error(
          translateAuthErrorMessage(error.message || "Erro ao fazer login.", {
            duplicateEmailText: "Este e-mail já está cadastrado. Entre com sua senha ou recupere o acesso.",
          }),
        );
      }
    } catch (err) {
      console.error("Exceção ao fazer login", err);
      toast.error("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * A razao social da Receita preenche a empresa, uma vez so.
   *
   * `company` continua editavel: a razao social nem sempre e o nome pelo qual a
   * empresa se reconhece, e sobrescrever o que a pessoa digitou seria pior do
   * que nao preencher nada. Por isso so entra quando o campo esta vazio.
   */
  useEffect(() => {
    const razao = cnpjValidation.dados?.razaoSocial ?? "";
    if (!razao) return;
    setCustomerForm((prev) => (prev.company.trim() ? prev : { ...prev, company: razao }));
  }, [cnpjValidation.dados]);

  /** Avanca do passo 1 para o 2, se a empresa estiver identificada. */
  const irParaDadosDeAcesso = () => {
    setCnpjTouched(true);

    const docMessage = cnpjValidation.assertDocReady();
    if (docMessage) {
      if (docMessage === "Validando documento...") toast.info(docMessage);
      else toast.error(docMessage);
      return;
    }

    if (!customerForm.company.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }

    setSignUpStep(2);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setCnpjTouched(true);

    const docMessage = cnpjValidation.assertDocReady();
    if (docMessage) {
      // Volta ao passo 1 junto com o aviso: mandar corrigir sem mostrar o campo
      // deixaria a pessoa procurando o que consertar.
      setSignUpStep(1);
      if (docMessage === "Validando documento...") toast.info(docMessage);
      else toast.error(docMessage);
      return;
    }

    // Politica unica em `src/lib/senha.ts`. As seis checagens que havia aqui
    // — maiuscula, minuscula, digito, especial — sao "regras arbitrarias de
    // composicao", proibidas pela §10 do padrao de autenticacao.
    const validacaoDeSenha = await validarSenha(signUpPassword, { email: signUpEmail });
    if (!validacaoDeSenha.ok) {
      toast.error(validacaoDeSenha.problema!);
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
      // Trocar para a aba "entrar" e preencher o e-mail quando a conta ja existe
      // era um sinal **comportamental**: mesmo com mensagem neutra, a tela
      // denunciava o que a mensagem calava. A §21 diz que a equivalencia inclui
      // "status, headers, corpo, tamanho aproximado, redirects, timing" — mudanca
      // de estado da tela entra nessa lista.
      //
      // Hoje o caso nem chega aqui: `signUpCustomer` responde e-mail existente
      // como cadastro novo. O trecho saiu para nao voltar por descuido.
      console.error("Erro ao criar conta", error);
      toast.error(translateAuthErrorMessage(error.message || "Erro ao criar conta."));
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

  /**
   * O spinner e so para quem AINDA NAO TEM sessao.
   *
   * Era `loading || isResolvingAccess`, e isso incluia o intervalo logo depois de
   * `signIn` — quando `user` ja existe e o papel esta sendo consultado. Nesse
   * intervalo o cartao sumia e dava lugar ao spinner, que virava o quadro "antes"
   * da transicao. Com `!user`, o formulario fica na tela ate a navegacao; o botao
   * ja mostra "Autenticando...", entao nao falta retorno visual.
   */
  if ((loading || isResolvingAccess) && !user) {
    return (
      <ClientAuthStage>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </ClientAuthStage>
    );
  }

  return (
    <ClientAuthStage>
      {/* Um cartao so.
          Antes havia cartao dentro de cartao — este, com borda e sombra, e outro
          igual em volta de cada formulario. As duas bordas somadas comiam ~88px
          de largura util, e o campo ficava mais estreito do que a coluna. */}
      <div className="flex flex-col rounded-[2.25rem] border border-border/70 bg-background text-foreground shadow-[0_16px_40px_rgba(16,24,40,0.08)]">
        {/* Sem cabecalho proprio.

            Havia aqui um circulo de 96px com a logo, um "ACESSO CLIENTE" em
            caixa alta, um titulo grande e um paragrafo — e as abas logo abaixo
            ja diziam "Entrar" e "Criar conta". Era o mesmo recado tres vezes.

            A logo saiu porque a barra do topo ja mostra uma: eram duas na mesma
            tela, a 100px de distancia.

            Medido depois: a pagina caiu de 101 para ~30 palavras, que e a faixa
            das lojas de referencia (Shopify 10, Mercado Livre 21, Amazon 25). */}
          <div className="flex flex-col gap-5 px-6 py-6 sm:px-8">
          <Tabs value={authTab} onValueChange={(value) => {
            setSlideDir(value === "cadastro" ? "right" : "left");
            setAuthTab(value as "entrar" | "cadastro");
            // Voltar para a aba de cadastro recomeca do passo 1: retomar no
            // passo 2 mostraria campos de acesso sem a empresa a vista.
            if (value === "cadastro") setSignUpStep(1);
          }} className="flex w-full flex-col">
            <TabsList className="grid h-12 w-full grid-cols-2 items-stretch rounded-full border border-border/70 bg-muted/60 p-1">
              <TabsTrigger
                value="entrar"
                className="flex h-10 w-full items-center justify-center rounded-full px-5 text-[0.8125rem] font-medium leading-none text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                Entrar
              </TabsTrigger>
              <TabsTrigger
                value="cadastro"
                className="flex h-10 w-full items-center justify-center rounded-full px-5 text-[0.8125rem] font-medium leading-none text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                Criar conta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="entrar" className="mt-0">
              <form
                onSubmit={handleSignIn}
                className={cn(
                  "mt-6 flex flex-col space-y-5",
                  "animate-in fade-in duration-300",
                  slideDir === "left" ? "slide-in-from-left-5" : "slide-in-from-right-5",
                )}
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

                {/* Erro de digitacao no dominio fica indistinguivel de senha
                    errada, porque a mensagem de login e generica de proposito.
                    Este aviso desfaz o empate sem revelar se a conta existe. */}
                {sugestaoEmailEntrar ? (
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Você quis dizer{" "}
                    <button
                      type="button"
                      onClick={() => setSignInEmail(sugestaoEmailEntrar)}
                      className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      {sugestaoEmailEntrar}
                    </button>
                    ?
                  </p>
                ) : null}

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

                {/* O "Lembrar acesso" saiu daqui.
                    Era um checkbox sem estado e sem efeito nenhum: a sessao ja
                    persiste por padrao (`persistSession: true`), entao a caixa
                    aparecia desmarcada enquanto o comportamento era o oposto.
                    Controle que promete o que nao faz e pior do que controle
                    nenhum. */}
                <div className="flex justify-end text-[0.8125rem]">
                  <Link to={recoveryLink} className="text-primary transition-colors hover:text-primary/80">
                    Esqueceu a senha?
                  </Link>
                </div>

                <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-semibold" disabled={submitting}>
                  {submitting ? "Autenticando..." : "Entrar"}
                </Button>

              </form>
            </TabsContent>

            <TabsContent value="cadastro" className="mt-0">
              <form
                onSubmit={handleSignUp}
                className={cn(
                  "mt-6 flex flex-col space-y-5",
                  "animate-in fade-in duration-300",
                  slideDir === "right" ? "slide-in-from-right-5" : "slide-in-from-left-5",
                )}
              >
                {/* Onde a pessoa esta, e quanto falta. Sem isto, dividir em dois
                    passos parece um formulario que engoliu campos. */}
                <div className="flex items-center gap-3">
                  {([1, 2] as const).map((passo) => (
                    <div key={passo} className="flex flex-1 flex-col gap-1.5">
                      <span
                        className={cn(
                          "h-1 rounded-full transition-colors",
                          passo <= signUpStep ? "bg-primary" : "bg-border",
                        )}
                      />
                      <span
                        className={cn(
                          "text-[0.6875rem] font-medium",
                          passo === signUpStep ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {passo}. {passo === 1 ? "Sua empresa" : "Seus dados"}
                      </span>
                    </div>
                  ))}
                </div>

                {signUpStep === 1 ? (
                  <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-right-3 duration-300">
                    <div className="space-y-2">
                      <Label
                        htmlFor="signup-cnpj"
                        className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        CNPJ da empresa
                      </Label>
                      <Input
                        id="signup-cnpj"
                        value={customerForm.cnpj}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({ ...prev, cnpj: formatCnpj(e.target.value) }))
                        }
                        onBlur={() => setCnpjTouched(true)}
                        placeholder="00.000.000/0000-00"
                        inputMode="numeric"
                        maxLength={18}
                        required
                        aria-invalid={
                          cnpjValidation.shouldShowError &&
                          (cnpjValidation.isDocIncomplete || cnpjValidation.isDocInvalid || cnpjValidation.isDocError)
                        }
                        className={cn(
                          "h-12 rounded-2xl border-border/70 bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30",
                          cnpjValidation.shouldShowError &&
                            (cnpjValidation.isDocIncomplete || cnpjValidation.isDocInvalid || cnpjValidation.isDocError) &&
                            "border-destructive focus-visible:ring-destructive",
                        )}
                      />

                      {cnpjValidation.isDocChecking ? (
                        <p className="text-xs text-muted-foreground">Consultando a Receita...</p>
                      ) : null}
                      {cnpjValidation.shouldShowError && cnpjValidation.isDocIncomplete ? (
                        <p className="text-xs text-destructive">CNPJ incompleto. Preencha 14 dígitos.</p>
                      ) : null}
                      {cnpjValidation.shouldShowError && cnpjValidation.isDocInvalid ? (
                        <p className="text-xs text-destructive">CNPJ inválido. Verifique o número informado.</p>
                      ) : null}
                      {cnpjValidation.shouldShowError && cnpjValidation.isDocError ? (
                        <p className="text-xs text-muted-foreground">
                          Não foi possível consultar agora. Você pode preencher a empresa manualmente.
                        </p>
                      ) : null}

                      {cnpjValidation.dados?.razaoSocial ? (
                        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <p className="text-xs leading-5 text-emerald-900">
                            <span className="font-medium">{cnpjValidation.dados.razaoSocial}</span>
                            <br />
                            Encontramos esta empresa na Receita Federal.
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="signup-company"
                        className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        Nome da empresa
                      </Label>
                      <Input
                        id="signup-company"
                        value={customerForm.company}
                        onChange={(e) => setCustomerForm((prev) => ({ ...prev, company: e.target.value }))}
                        placeholder="Como sua empresa é conhecida"
                        required
                        autoComplete="organization"
                        className="h-12 rounded-2xl border-border/70 bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
                      />
                      <p className="text-xs leading-5 text-muted-foreground">
                        Preenchemos com a razão social. Você pode trocar pelo nome que usam no dia a dia.
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={irParaDadosDeAcesso}
                      className="h-12 w-full rounded-2xl text-sm font-semibold"
                    >
                      Continuar
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-right-3 duration-300">
                    <div className="space-y-2">
                      <Label
                        htmlFor="signup-name"
                        className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        Seu nome
                      </Label>
                      <Input
                        id="signup-name"
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Nome completo"
                        required
                        autoComplete="name"
                        className="h-12 rounded-2xl border-border/70 bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="signup-phone"
                        className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        Telefone
                      </Label>
                      <Input
                        id="signup-phone"
                        value={customerForm.phone}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({ ...prev, phone: formatPhone(onlyDigits(e.target.value)) }))
                        }
                        placeholder="(00) 00000-0000"
                        inputMode="numeric"
                        type="tel"
                        maxLength={15}
                        required
                        autoComplete="tel"
                        className="h-12 rounded-2xl border-border/70 bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
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

                    {/* No cadastro o erro de digitacao custa mais caro: o e-mail
                        de confirmacao vai para um endereco que nao existe, e a
                        conta fica presa sem que ninguem entenda por que. */}
                    {sugestaoEmailCadastro ? (
                      <p className="-mt-2 text-xs text-muted-foreground">
                        Você quis dizer{" "}
                        <button
                          type="button"
                          onClick={() => setSignUpEmail(sugestaoEmailCadastro)}
                          className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          {sugestaoEmailCadastro}
                        </button>
                        ?
                      </p>
                    ) : null}

                    {signupEmailStatus === "checking" ? (
                      <p className="text-xs text-muted-foreground">Verificando se este e-mail já está cadastrado...</p>
                    ) : null}

                    {signupEmailStatus === "available" ? (
                      <p className="text-xs text-emerald-600">E-mail disponível para cadastro.</p>
                    ) : null}

                    {signupEmailStatus === "registered" ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                        Este e-mail já está cadastrado. Você pode entrar com a conta existente ou recuperar o acesso.
                      </div>
                    ) : null}

                    {signupEmailStatus === "error" ? (
                      <p className="text-xs text-muted-foreground">
                        Não foi possível checar este e-mail agora. Você ainda pode continuar o cadastro.
                      </p>
                    ) : null}

                    <AuthField
                      id="signup-password"
                      label="Senha"
                      placeholder="Mínimo 10 caracteres"
                      value={signUpPassword}
                      onChange={setSignUpPassword}
                      type="password"
                      autoComplete="new-password"
                      required
                      maxLength={64}
                      icon={LockKeyhole}
                    />

                    {/* Uma coluna, e nao duas.
                        Senha e confirmacao lado a lado davam ~200px por campo no
                        celular, e o erro de digitacao so aparecia no envio. */}
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

                    <div className="flex flex-col gap-3 pt-1 sm:flex-row-reverse">
                      <Button
                        type="submit"
                        className="h-12 w-full rounded-2xl text-sm font-semibold sm:flex-1"
                        disabled={submitting}
                      >
                        {submitting ? "Criando conta..." : "Criar minha conta"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSignUpStep(1)}
                        disabled={submitting}
                        className="h-12 rounded-2xl text-sm font-medium sm:w-auto sm:px-6"
                      >
                        Voltar
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ClientAuthStage>
  );
}











