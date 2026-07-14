import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useLocation } from "react-router-dom";
import {
  CUSTOMER_PROFILES_TABLE,
  type CustomerProfile,
  type CustomerRegistrationData,
} from "@/lib/customerProfile";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import { syncCustomerProxisLink } from "@/lib/proxisCustomer";
import { normalizeCustomerType } from "@/lib/pricing";
import { onlyDigits } from "@/lib/brazilianIds";
import { translateAuthErrorMessage as translateAuthErrorMessageShared } from "@/lib/authErrors";

type AuthContextValue = {
  user: User | null;
  isAdmin: boolean;
  isSuperadmin: boolean;
  isCustomer: boolean;
  customerProfile: CustomerProfile | null;
  loading: boolean;
  isResolvingAccess: boolean;
  signIn: (email: string, password: string) => Promise<Error | null>;
  signUp: (email: string, password: string) => Promise<Error | null>;
  signUpCustomer: (data: CustomerRegistrationData) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  registerCustomerProfile: (
    data: Omit<CustomerRegistrationData, "email" | "password">,
  ) => Promise<Error | null>;
  signOut: () => Promise<{ error: Error | null }>;
  updateCustomerType: (customerType: string) => Promise<Error | null>;
  refreshCustomerProfile: (userId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
let authResolutionCounter = 0;
const AUTH_BOOTSTRAP_STORAGE_KEY = "clinicplus_auth_bootstrap";
const AUTH_PROFILE_STORAGE_KEY = "clinicplus_customer_profile_cache";

function normalizeCustomerProfile(profile: CustomerProfile): CustomerProfile {
  return {
    ...profile,
    customer_type: normalizeCustomerType(profile.customer_type),
    proxis_pes_id: profile.proxis_pes_id ?? null,
    proxis_tpr_id: profile.proxis_tpr_id ?? null,
    proxis_found: profile.proxis_found ?? false,
    proxis_synced_at: profile.proxis_synced_at ?? null,
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
  if (
    normalized.includes("user already registered") ||
    normalized.includes("already registered") ||
    normalized.includes("email already exists") ||
    normalized.includes("email exists")
  ) {
    return "Este e-mail já está cadastrado. Entre com sua senha ou recupere o acesso.";
  }
  if (normalized.includes("email not confirmed") || normalized.includes("email not verified")) {
    return "Confirme seu e-mail antes de fazer login.";
  }

  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const bootstrapSnapshot = readAuthBootstrap();
  const [user, setUser] = useState<User | null>(bootstrapSnapshot?.user ?? null);
  const [isAdmin, setIsAdmin] = useState(bootstrapSnapshot?.isAdmin ?? false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(
    bootstrapSnapshot?.user ? readCachedCustomerProfile(bootstrapSnapshot.user.id) : null,
  );
  const [loading, setLoading] = useState(true);
  const [isResolvingAccess, setIsResolvingAccess] = useState(false);
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
  }, []);

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
        setIsResolvingAccess(false);
      }
    }
  }, [fetchCustomerProfile]);

  const resolveAuthState = useCallback(async (nextUser: User | null, forceRefresh = false) => {
    if (!nextUser) {
      authResolutionCounter += 1;
      activeUserIdRef.current = null;
      userRef.current = null;
      isAdminRef.current = false;
      isSuperadminRef.current = false;
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

    if (!forceRefresh && activeUserIdRef.current === nextUser.id && userRef.current?.id === nextUser.id) {
      userRef.current = nextUser;
      setUser(nextUser);
      setIsResolvingAccess(false);
      setLoading(false);
      return;
    }

    const resolutionId = ++authResolutionCounter;
    activeUserIdRef.current = nextUser.id;
    userRef.current = nextUser;
    setLoading(true);
    setUser(nextUser);
    isAdminRef.current = false;
    isSuperadminRef.current = false;
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
    const isPublicHome = location.pathname === "/";

    if (isPublicHome) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    if (authInitializedRef.current) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    authInitializedRef.current = true;

    const initAuth = async () => {
      const supabase = await loadSupabaseClient();
      try {
        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        await resolveAuthState(currentUser, true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initAuth();

    void loadSupabaseClient().then((supabase) => {
      if (!mounted) return;
      const result = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        if (!session?.user && activeUserIdRef.current && event !== "SIGNED_OUT") {
          return;
        }
        if (event === "TOKEN_REFRESHED" && session?.user && activeUserIdRef.current === session.user.id) {
          return;
        }
        void resolveAuthState(session?.user ?? null);
      });
      authSubscriptionRef.current = result.data.subscription;
    });

    return () => {
      mounted = false;
    };
  }, [location.pathname, resolveAuthState]);

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
    authResolutionCounter += 1;
    setUser(null);
    setIsAdmin(false);
    setIsSuperadmin(false);
    setCustomerProfile(null);
    setIsResolvingAccess(false);
    activeUserIdRef.current = null;
    userRef.current = null;
    isAdminRef.current = false;
    isSuperadminRef.current = false;
    clearAuthBootstrap();
    clearCachedCustomerProfile();
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value: AuthContextValue = {
    user,
    isAdmin,
    isSuperadmin,
    isCustomer: !!customerProfile,
    customerProfile,
    loading,
    isResolvingAccess,
    signIn,
    signUp,
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
