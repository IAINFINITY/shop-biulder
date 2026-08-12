import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  CUSTOMER_PROFILES_TABLE,
  saveCustomerProfileAddress,
  type CustomerProfile,
  type CustomerRegistrationData,
} from "@/lib/customerProfile";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import { syncCustomerProxisLink } from "@/lib/proxisCustomer";
import { normalizeCustomerType } from "@/lib/pricing";
import { buscarEnderecoDaReceita } from "@/lib/enderecoDaReceita";
import { onlyDigits } from "@/lib/brazilianIds";
import { translateAuthErrorMessage as translateAuthErrorMessageShared } from "@/lib/authErrors";
import {
  PASSWORD_RECOVERY_STORAGE_KEY,
  capturePasswordRecoveryIntent,
  clearPasswordRecoveryMarker,
  isPasswordRecoveryPendingFor,
  writePasswordRecoveryMarker,
} from "@/lib/passwordRecovery";

type AuthContextValue = {
  user: User | null;
  isAdmin: boolean;
  isSuperadmin: boolean;
  isCustomer: boolean;
  customerProfile: CustomerProfile | null;
  isPasswordRecovery: boolean;
  loading: boolean;
  isResolvingAccess: boolean;
  /** Id do usuario cujo papel ja foi consultado. `null` = ainda nao se sabe. */
  acessoResolvidoPara: string | null;
  signIn: (email: string, password: string) => Promise<Error | null>;
  signUp: (email: string, password: string) => Promise<Error | null>;
  requestPasswordReset: (email: string) => Promise<Error | null>;
  signUpCustomer: (data: CustomerRegistrationData) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  registerCustomerProfile: (
    data: Omit<CustomerRegistrationData, "email" | "password">,
  ) => Promise<Error | null>;
  signOut: () => Promise<{ error: Error | null }>;
  /** Senha provisoria ainda nao trocada — o site bloqueia ate ela trocar. */
  deveTrocarSenha: boolean;
  updateCustomerType: (customerType: string) => Promise<Error | null>;
  refreshCustomerProfile: (userId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
let authResolutionCounter = 0;
const AUTH_BOOTSTRAP_STORAGE_KEY = "clinicplus_auth_bootstrap";
const AUTH_PROFILE_STORAGE_KEY = "clinicplus_customer_profile_cache";

capturePasswordRecoveryIntent();

function normalizeCustomerProfile(profile: CustomerProfile): CustomerProfile {
  return {
    ...profile,
    customer_type: normalizeCustomerType(profile.customer_type),
    proxis_pes_id: profile.proxis_pes_id ?? null,
    proxis_tpr_id: profile.proxis_tpr_id ?? null,
    proxis_found: profile.proxis_found ?? false,
    proxis_synced_at: profile.proxis_synced_at ?? null,
    linked_company_cnpj: profile.linked_company_cnpj ?? null,
  };
}

type AuthBootstrapSnapshot = {
  user: User;
  isAdmin: boolean;
};

function readAuthBootstrap(): AuthBootstrapSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(AUTH_BOOTSTRAP_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthBootstrapSnapshot> | null;
    if (!parsed.user || typeof parsed.user !== "object") return null;

    return {
      user: parsed.user as User,
      isAdmin: Boolean(parsed.isAdmin),
    };
  } catch {
    return null;
  }
}

function writeAuthBootstrap(snapshot: AuthBootstrapSnapshot): void {
  try {
    sessionStorage.setItem(AUTH_BOOTSTRAP_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // noop
  }
}

function clearAuthBootstrap(): void {
  try {
    sessionStorage.removeItem(AUTH_BOOTSTRAP_STORAGE_KEY);
  } catch {
    // noop
  }
}

function readCachedCustomerProfile(userId: string): CustomerProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(AUTH_PROFILE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CustomerProfile> | null;
    if (!parsed || parsed.user_id !== userId) return null;

    return normalizeCustomerProfile(parsed as CustomerProfile);
  } catch {
    return null;
  }
}

function writeCachedCustomerProfile(profile: CustomerProfile): void {
  try {
    sessionStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // noop
  }
}

function clearCachedCustomerProfile(): void {
  try {
    sessionStorage.removeItem(AUTH_PROFILE_STORAGE_KEY);
  } catch {
    // noop
  }
}

function translateAuthErrorMessage(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (!normalized) return "Erro ao autenticar.";
  if (normalized.includes("invalid login credentials") || normalized.includes("invalid credentials")) {
    return "E-mail ou senha incorretos.";
  }
  // "Este e-mail ja esta cadastrado" e "Confirme seu e-mail antes de fazer
  // login" saíram daqui de propósito: as duas contam a quem perguntou que a conta
  // existe. A §21 exige comportamento observável equivalente para "conta
  // inexistente", "senha incorreta", "conta suspensa" e "cadastro com
  // identificador existente" — e uma mensagem diferente é diferença observável.
  //
  // Com elas, bastava um formulário e uma lista de e-mails para descobrir quem é
  // cliente da Clinic+. O cadastro passou a responder igual nos dois casos (ver
  // `signUpCustomer`), e o login não distingue mais e-mail não confirmado de
  // credencial errada.
  if (
    normalized.includes("user already registered") ||
    normalized.includes("already registered") ||
    normalized.includes("email already exists") ||
    normalized.includes("email exists") ||
    normalized.includes("email not confirmed") ||
    normalized.includes("email not verified")
  ) {
    return "E-mail ou senha incorretos.";
  }

  // Mensagem crua do provedor pode descrever estado interno da conta. Sem
  // tradução conhecida, é melhor um texto genérico do que vazar o original.
  console.warn("[auth] mensagem sem tradução:", message);
  return "Não foi possível concluir. Verifique os dados e tente de novo.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const bootstrapSnapshot = readAuthBootstrap();
  const [user, setUser] = useState<User | null>(bootstrapSnapshot?.user ?? null);
  const [isAdmin, setIsAdmin] = useState(bootstrapSnapshot?.isAdmin ?? false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    Boolean(bootstrapSnapshot?.user && isPasswordRecoveryPendingFor(bootstrapSnapshot.user.id)),
  );
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(
    bootstrapSnapshot?.user ? readCachedCustomerProfile(bootstrapSnapshot.user.id) : null,
  );
  const [loading, setLoading] = useState(true);
  const [isResolvingAccess, setIsResolvingAccess] = useState(false);

  /**
   * De QUEM ja sabemos o papel — nao "estou resolvendo agora".
   *
   * `isResolvingAccess` comeca `false`, entao "ainda nao comecei" e "ja terminei"
   * sao o mesmo valor. Quem so pergunta "esta resolvendo?" acredita saber o papel
   * durante a janela entre o usuario aparecer e a consulta comecar — e nessa
   * janela `isAdmin` ainda e `false`.
   *
   * Foi o que mandou o admin para `/conta` no login: destino escolhido com
   * `isAdmin` falso, e o `Account` corrigindo para `/admin` logo depois. Duas
   * navegacoes, duas telas em branco, e a View Transition fotografando o meio do
   * caminho.
   *
   * Guardar o **id** em vez de um booleano e o que fecha a porta: trocar de conta
   * invalida a resposta sozinho, sem precisar lembrar de limpar a flag.
   */
  const [acessoResolvidoPara, setAcessoResolvidoPara] = useState<string | null>(
    bootstrapSnapshot?.user?.id ?? null,
  );
  const activeUserIdRef = useRef<string | null>(bootstrapSnapshot?.user?.id ?? null);
  const userRef = useRef<User | null>(bootstrapSnapshot?.user ?? null);
  const isAdminRef = useRef(bootstrapSnapshot?.isAdmin ?? false);
  const isSuperadminRef = useRef(false);
  const authInitializedRef = useRef(false);
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  const fetchCustomerProfile = useCallback(async (userId: string, resolutionId?: number) => {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from(CUSTOMER_PROFILES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (typeof resolutionId === "number" && resolutionId !== authResolutionCounter) {
      return;
    }

    if (error || !data) {
      if (activeUserIdRef.current === userId) {
        setCustomerProfile((currentProfile) =>
          currentProfile?.user_id === userId ? currentProfile : null,
        );
      }
      return;
    }

    const normalizedProfile = normalizeCustomerProfile(data as CustomerProfile);
    setCustomerProfile(normalizedProfile);
    writeCachedCustomerProfile(normalizedProfile);
    if (activeUserIdRef.current === userId && userRef.current) {
      writeAuthBootstrap({ user: userRef.current, isAdmin: isAdminRef.current });
    }

    /**
     * Endereco da empresa vazio: busca na Receita pelo CNPJ, uma vez.
     *
     * As colunas `address_*` do perfil sao o **endereco cadastral da empresa** —
     * o que "Dados da empresa" mostra e o que o painel do admin le na ficha do
     * cliente. Elas nao tem relacao com os enderecos de entrega, que vivem em
     * `clinic+b2b_customer_addresses` e podem ser ate cinco.
     *
     * Ate agora so o fechamento de pedido escrevia aqui, entao quem nunca
     * comprou aparecia como "Endereço não cadastrado" — e quem comprou ficava
     * com o endereco de **entrega** no campo da empresa, que e pior: a ficha
     * cadastral passa a mentir.
     *
     * A consulta ja e feita no cadastro para validar o CNPJ e trazer a razao
     * social; o endereco vinha junto e era descartado.
     *
     * **Uma tentativa por sessao, e nunca em lote.** O limite da BrasilAPI e
     * real e foi medido: quatro chamadas seguidas da mesma origem devolveram
     * `429` e depois `403`. Preenchendo quando a pessoa entra, as consultas se
     * espalham sozinhas no tempo. A trava tambem impede o laco de um CNPJ sem
     * endereco utilizavel na Receita, que deixaria a condicao verdadeira para
     * sempre.
     */
    if (
      !normalizedProfile.address_cep &&
      normalizedProfile.cnpj &&
      !enderecoReceitaTentadoRef.current.has(userId)
    ) {
      const documentDigits = onlyDigits(normalizedProfile.cnpj);
      if (documentDigits.length === 14) {
        enderecoReceitaTentadoRef.current.add(userId);
        // Sem `await`: isto enriquece a ficha, e a tela nao deve esperar por
        // uma API de terceiro para aparecer.
        void buscarEnderecoDaReceita(documentDigits)
          .then(async (endereco) => {
            if (!endereco) return;
            await saveCustomerProfileAddress(userId, endereco);
            await fetchCustomerProfileRef.current?.(userId);
          })
          .catch((erro) => {
            console.error("[perfil] não foi possível preencher o endereço da empresa:", erro);
          });
      }
    }

    // Perfil sem vinculo com o Proxis: liga agora, uma vez.
    //
    // O vinculo e o que traz a tabela de preco negociada (`proxis_tpr_id`). Ele
    // era feito no cadastro, mas dentro do ramo que so roda quando o `signUp`
    // devolve sessao — e com confirmacao de e-mail ligada ele nunca devolve.
    // O perfil passou a ser criado por gatilho (migration 20260808140000), e o
    // gatilho nao tem como falar com o ERP: e uma funcao de banco.
    //
    // Sem isto, a pessoa navegava com preco padrao ate abrir a propria conta ou
    // fechar um pedido, que sao os outros pontos onde a sincronia acontece.
    // **Uma tentativa por sessao.** `syncCustomerProxisLink` nao garante gravar
    // `proxis_synced_at` — CNPJ que o ERP nao conhece pode deixar o campo nulo.
    // Sem esta trava, a condicao continuaria verdadeira e cada carregamento de
    // perfil dispararia uma ida ao ERP, para sempre.
    if (
      !normalizedProfile.proxis_synced_at &&
      normalizedProfile.cnpj &&
      !proxisSyncAttemptedRef.current.has(userId)
    ) {
      const documentDigits = onlyDigits(normalizedProfile.cnpj);
      if (documentDigits.length === 14) {
        proxisSyncAttemptedRef.current.add(userId);
        // Sem `await`: a tela nao deve esperar o ERP para renderizar.
        void syncCustomerProxisLink(documentDigits)
          .then(() => fetchCustomerProfileRef.current?.(userId))
          .catch(() => null);
      }
    }
  }, []);

  /** Quem ja teve a sincronia com o ERP tentada nesta sessao. */
  const proxisSyncAttemptedRef = useRef<Set<string>>(new Set());

  /** Quem ja teve o endereco da empresa buscado na Receita nesta sessao. */
  const enderecoReceitaTentadoRef = useRef<Set<string>>(new Set());

  // O `fetchCustomerProfile` precisa se rechamar depois da sincronia, para a
  // tela receber o `proxis_tpr_id` que acabou de ser gravado. A `ref` evita a
  // dependencia circular que isso criaria no `useCallback`.
  const fetchCustomerProfileRef = useRef<typeof fetchCustomerProfile | null>(null);
  fetchCustomerProfileRef.current = fetchCustomerProfile;

  const hydrateSessionDetails = useCallback(async (nextUser: User, resolutionId: number) => {
    setIsResolvingAccess(true);
    try {
      const supabase = await loadSupabaseClient();
      activeUserIdRef.current = nextUser.id;
      userRef.current = nextUser;
      const roleResult = await supabase.rpc("has_role", {
        _user_id: nextUser.id,
        _role: "admin",
      });

      if (resolutionId !== authResolutionCounter) return;

      const nextIsAdmin = !roleResult.error && !!roleResult.data;
      isAdminRef.current = nextIsAdmin;
      userRef.current = nextUser;
      setIsAdmin(nextIsAdmin);

      // Check superadmin
      if (nextIsAdmin) {
        const superResult = await supabase.rpc("has_role", {
          _user_id: nextUser.id,
          _role: "superadmin",
        });
        const nextSuperadmin = !superResult.error && !!superResult.data;
        isSuperadminRef.current = nextSuperadmin;
        setIsSuperadmin(nextSuperadmin);
      } else {
        isSuperadminRef.current = false;
        setIsSuperadmin(false);
      }

      writeAuthBootstrap({
        user: nextUser,
        isAdmin: nextIsAdmin,
      });
      // O perfil do cliente pode hidratar em segundo plano sem travar a navegação do admin.
      void fetchCustomerProfile(nextUser.id, resolutionId);
    } catch {
      if (resolutionId !== authResolutionCounter) return;
      isAdminRef.current = false;
      isSuperadminRef.current = false;
      userRef.current = nextUser;
      setIsAdmin(false);
      setIsSuperadmin(false);
      writeAuthBootstrap({
        user: nextUser,
        isAdmin: false,
      });
      void fetchCustomerProfile(nextUser.id, resolutionId);
    } finally {
      if (resolutionId === authResolutionCounter) {
        // Depois do `catch` de proposito: papel que falhou ao carregar vale
        // `false` e **esta resolvido**. Sem isto, uma consulta com erro deixaria
        // a tela de login girando para sempre em vez de entrar como cliente.
        setAcessoResolvidoPara(nextUser.id);
        setIsResolvingAccess(false);
      }
    }
  }, [fetchCustomerProfile]);

  const resolveAuthState = useCallback(async (nextUser: User | null, forceRefresh = false, passwordRecovery = false) => {
    if (!nextUser) {
      authResolutionCounter += 1;
      activeUserIdRef.current = null;
      userRef.current = null;
      isAdminRef.current = false;
      isSuperadminRef.current = false;
      setIsPasswordRecovery(false);
      setUser(null);
      setIsAdmin(false);
      setIsSuperadmin(false);
      setCustomerProfile(null);
      setIsResolvingAccess(false);
      clearAuthBootstrap();
      clearCachedCustomerProfile();
      setLoading(false);
      return;
    }

    if (passwordRecovery) {
      writePasswordRecoveryMarker(nextUser.id);
    }
    const nextIsPasswordRecovery = passwordRecovery || isPasswordRecoveryPendingFor(nextUser.id);

    if (nextIsPasswordRecovery) {
      authResolutionCounter += 1;
      activeUserIdRef.current = nextUser.id;
      userRef.current = nextUser;
      isAdminRef.current = false;
      isSuperadminRef.current = false;
      setUser(nextUser);
      setIsAdmin(false);
      setIsSuperadmin(false);
      setCustomerProfile(null);
      setIsPasswordRecovery(true);
      setAcessoResolvidoPara(null);
      setIsResolvingAccess(false);
      setLoading(false);
      return;
    }

    if (!forceRefresh && activeUserIdRef.current === nextUser.id && userRef.current?.id === nextUser.id) {
      userRef.current = nextUser;
      setUser(nextUser);
      setIsPasswordRecovery(nextIsPasswordRecovery);
      // **Nao** marca o acesso como resolvido aqui.
      //
      // A condicao deste atalho e `activeUserIdRef.current === nextUser.id`, e
      // essa ref e preenchida no INICIO de `resolveAuthState` — antes de a
      // consulta de papel terminar. O Supabase emite mais de um evento por login
      // (`SIGNED_IN`, `INITIAL_SESSION`, `TOKEN_REFRESHED`), entao o segundo
      // evento cai aqui enquanto o primeiro ainda esta consultando.
      //
      // Marcar resolvido neste ponto foi o que mandou o admin para `/conta`
      // mesmo depois da correcao: a tela via "papel resolvido" com `isAdmin`
      // ainda `false`. Quem resolve e so o `finally` do `hydrateSessionDetails`.
      //
      // Nao precisa restaurar nada: se ja estava resolvido para este usuario, o
      // valor continua la — ninguem o apagou.
      setIsResolvingAccess(false);
      setLoading(false);
      return;
    }

    const resolutionId = ++authResolutionCounter;
    activeUserIdRef.current = nextUser.id;
    userRef.current = nextUser;
    setLoading(true);
    setUser(nextUser);
    // Ainda nao sabemos o papel DESTE usuario. Se ficasse o id anterior, a tela
    // decidiria o destino com o `isAdmin` de quem saiu.
    setAcessoResolvidoPara(null);
    isAdminRef.current = false;
    isSuperadminRef.current = false;
    setIsPasswordRecovery(nextIsPasswordRecovery);
    setIsAdmin(false);
    setIsSuperadmin(false);
    setCustomerProfile(readCachedCustomerProfile(nextUser.id));
    await hydrateSessionDetails(nextUser, resolutionId);
    if (resolutionId === authResolutionCounter) {
      setLoading(false);
    }
  }, [hydrateSessionDetails]);

  useEffect(() => {
    let mounted = true;

    // O catalogo tambem inicializa a sessao.
    //
    // Antes a home era pulada para ganhar carregamento, e o estado vinha apenas
    // do snapshot em sessionStorage. Como sessionStorage e por aba, um cliente
    // logado que abrisse o catalogo numa aba nova era tratado como visitante:
    // via o preco de tabela base em vez do preco negociado dele, e os produtos
    // restritos ao seu tipo de cliente sumiam da listagem. Num catalogo B2B em
    // que o preco por cliente e o ponto central, o custo disso e maior que o da
    // consulta de sessao — que nem bloqueia a renderizacao, ja que o catalogo
    // pinta a partir do cache e o cliente Supabase ja e carregado aqui para
    // buscar os produtos.
    if (authInitializedRef.current) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    authInitializedRef.current = true;

    const initAuth = async () => {
      const supabase = await loadSupabaseClient();
      if (!mounted) return;

      const result = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT") {
          clearPasswordRecoveryMarker();
        }
        if (!session?.user && activeUserIdRef.current && event !== "SIGNED_OUT") {
          return;
        }
        if (event === "TOKEN_REFRESHED" && session?.user && activeUserIdRef.current === session.user.id) {
          return;
        }
        void resolveAuthState(session?.user ?? null, false, event === "PASSWORD_RECOVERY");
      });
      authSubscriptionRef.current = result.data.subscription;

      try {
        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        await resolveAuthState(currentUser, true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initAuth();

    return () => {
      mounted = false;
    };
  }, [resolveAuthState]);

  useEffect(() => {
    const syncPasswordRecovery = (event: StorageEvent) => {
      if (event.key !== PASSWORD_RECOVERY_STORAGE_KEY) return;
      setIsPasswordRecovery(Boolean(userRef.current && isPasswordRecoveryPendingFor(userRef.current.id)));
    };

    window.addEventListener("storage", syncPasswordRecovery);
    return () => window.removeEventListener("storage", syncPasswordRecovery);
  }, []);

  useEffect(() => {
    return () => {
      authSubscriptionRef.current?.unsubscribe();
      authSubscriptionRef.current = null;
    };
  }, []);

  const updateCustomerType = async (customerType: string) => {
    if (!user) return new Error("Usuário não autenticado");

    const normalizedType = normalizeCustomerType(customerType);
    const supabase = await loadSupabaseClient();
    const { error } = await supabase
      .from(CUSTOMER_PROFILES_TABLE)
      .update({ customer_type: normalizedType } as never)
      .eq("user_id", user.id);

    if (!error) {
      await fetchCustomerProfile(user.id);
    }

    return error;
  };

  const signIn = async (email: string, password: string) => {
    clearPasswordRecoveryMarker();
    setIsPasswordRecovery(false);
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (data?.session?.user) {
      resolveAuthState(data.session.user);
      return null;
    }

    if (error) return new Error(translateAuthErrorMessageShared(error.message || "Erro ao autenticar."));

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      resolveAuthState(sessionData.session.user);
      return null;
    }

    return new Error("Falha ao autenticar. Nenhuma sessão foi criada.");
  };

  const signUp = async (email: string, password: string) => {
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.auth.signUp({ email, password });
    return error;
  };

  const requestPasswordReset = async (email: string) => {
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/recuperar-senha`,
    });

    if (error) {
      return new Error(translateAuthErrorMessageShared(error.message || "Erro ao enviar link de recuperação."));
    }

    return null;
  };

  const registerCustomerProfile = async (data: Omit<CustomerRegistrationData, "email" | "password">) => {
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.rpc("register_customer_profile", {
      p_name: data.name.trim(),
      p_phone: data.phone.trim(),
      p_company: data.company.trim(),
      p_cnpj: data.cnpj.trim(),
      p_customer_type: normalizeCustomerType(data.customer_type),
    });
    const documentDigits = onlyDigits(data.cnpj.trim());
    if (!error && user) {
      if (documentDigits.length === 14) {
        await syncCustomerProxisLink(documentDigits).catch(() => null);
      }
      await fetchCustomerProfile(user.id);
    }
    return error;
  };

  const signUpCustomer = async (data: CustomerRegistrationData) => {
    const supabase = await loadSupabaseClient();
    const documentDigits = onlyDigits(data.cnpj.trim());
    if (documentDigits.length !== 14) {
      return {
        error: new Error("CNPJ inválido. Preencha 14 dígitos."),
        needsEmailConfirmation: false,
      };
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        data: {
          name: data.name.trim(),
          phone: data.phone.trim(),
          company: data.company.trim(),
          cnpj: data.cnpj.trim(),
          customer_type: normalizeCustomerType(data.customer_type),
        },
      },
    });
    if (signUpError) {
      /**
       * E-mail ja cadastrado responde como cadastro novo.
       *
       * A §21 lista "cadastro com identificador existente" entre os casos que
       * devem ser indistinguiveis. Devolver erro aqui — com qualquer texto —
       * confirma a existencia da conta pelo simples fato de ser erro.
       *
       * Quem ja tem conta nao fica sem saida: o fluxo "Esqueci minha senha" leva
       * ao mesmo lugar, e ele ja responde sem revelar nada.
       */
      const jaCadastrado = /already registered|email already exists|email exists/i.test(
        signUpError.message ?? "",
      );
      if (jaCadastrado) {
        console.warn("[auth] cadastro com e-mail existente respondido como novo (§21).");
        return { error: null, needsEmailConfirmation: true };
      }

      return {
        error: new Error(translateAuthErrorMessageShared(signUpError.message || "Erro ao criar conta.")),
        needsEmailConfirmation: false,
      };
    }

    const sessionUser = signUpData.user;
    const needsEmailConfirmation = !signUpData.session;

    if (signUpData.session?.user) {
      const { error: profileError } = await supabase.rpc("register_customer_profile", {
        p_name: data.name.trim(),
        p_phone: data.phone.trim(),
        p_company: data.company.trim(),
        p_cnpj: data.cnpj.trim(),
        p_customer_type: normalizeCustomerType(data.customer_type),
      });
      if (profileError) return { error: profileError, needsEmailConfirmation: false };
      if (sessionUser) {
        const documentDigits = onlyDigits(data.cnpj.trim());
        if (documentDigits.length === 14) {
          await syncCustomerProxisLink(documentDigits).catch(() => null);
        }
        await fetchCustomerProfile(sessionUser.id);
      }
    }

    return { error: null, needsEmailConfirmation };
  };

  const signOut = async () => {
    const supabase = await loadSupabaseClient();
    /**
     * `scope: "global"` — revoga a sessao **no servidor**, em todos os
     * dispositivos.
     *
     * O padrao do SDK e `"local"`: limpa o armazenamento desta aba e pronto. O
     * refresh token continua valido, entao a sessao aberta no computador da loja
     * ou no celular emprestado segue de pe depois de a pessoa clicar em "Sair" e
     * ir embora achando que fechou.
     *
     * A §20 do padrao de autenticacao exige que o logout "revogue sessao ou
     * familia de refresh tokens no servidor", e a §31 lista "sessao sem revogacao
     * ou expiracao server-side" como antipadrao. Enquanto o token vive em
     * `localStorage` (ver PERFIL-CLINIC-PLUS.md, item 3.1), esta e a unica forma
     * de o logout significar alguma coisa de verdade.
     */
    const { error } = await supabase.auth.signOut({ scope: "global" });
    // Erro de rede nao pode prender a pessoa logada na tela: o estado local e
    // limpo de qualquer jeito abaixo. O que se perde e a revogacao remota, e
    // isso e melhor do que um botao "Sair" que nao sai.
    if (error) console.error("[auth] signOut global falhou:", error.message);

    authResolutionCounter += 1;
    setUser(null);
    setIsAdmin(false);
    setIsSuperadmin(false);
    setIsPasswordRecovery(false);
    clearPasswordRecoveryMarker();
    setCustomerProfile(null);
    setAcessoResolvidoPara(null);
    setIsResolvingAccess(false);
    activeUserIdRef.current = null;
    userRef.current = null;
    isAdminRef.current = false;
    isSuperadminRef.current = false;
    clearAuthBootstrap();
    clearCachedCustomerProfile();
    return { error: null };
  };

  const value: AuthContextValue = {
    deveTrocarSenha: Boolean(customerProfile?.deve_trocar_senha),
    user,
    isAdmin,
    isSuperadmin,
    isCustomer: !!customerProfile,
    customerProfile,
    isPasswordRecovery,
    loading,
    isResolvingAccess,
    acessoResolvidoPara,
    signIn,
    signUp,
    requestPasswordReset,
    signUpCustomer,
    registerCustomerProfile,
    signOut,
    updateCustomerType,
    refreshCustomerProfile: fetchCustomerProfile,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
