import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  CUSTOMER_PROFILES_TABLE,
  addressFormToProfileColumns,
  type CustomerProfile,
  type CustomerRegistrationData,
} from "@/lib/customerProfile";
import { syncCustomerProxisLink } from "@/lib/proxisCustomer";
import { normalizeCustomerType, type CustomerType } from "@/lib/pricing";

type AuthContextValue = {
  user: User | null;
  isAdmin: boolean;
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
  updateCustomerType: (customerType: CustomerType) => Promise<Error | null>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const bootstrapSnapshot = readAuthBootstrap();
  const [user, setUser] = useState<User | null>(bootstrapSnapshot?.user ?? null);
  const [isAdmin, setIsAdmin] = useState(bootstrapSnapshot?.isAdmin ?? false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(
    bootstrapSnapshot?.user ? readCachedCustomerProfile(bootstrapSnapshot.user.id) : null,
  );
  const [loading, setLoading] = useState(true);
  const [isResolvingAccess, setIsResolvingAccess] = useState(false);
  const activeUserIdRef = useRef<string | null>(bootstrapSnapshot?.user?.id ?? null);
  const userRef = useRef<User | null>(bootstrapSnapshot?.user ?? null);
  const isAdminRef = useRef(bootstrapSnapshot?.isAdmin ?? false);

  const fetchCustomerProfile = useCallback(async (userId: string, resolutionId: number) => {
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
      writeAuthBootstrap({
        user: nextUser,
        isAdmin: nextIsAdmin,
      });
      // O perfil do cliente pode hidratar em segundo plano sem travar a navegação do admin.
      void fetchCustomerProfile(nextUser.id, resolutionId);
    } catch {
      if (resolutionId !== authResolutionCounter) return;
      isAdminRef.current = false;
      userRef.current = nextUser;
      setIsAdmin(false);
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
      setUser(null);
      setIsAdmin(false);
      setCustomerProfile(null);
      setIsResolvingAccess(false);
      clearAuthBootstrap();
      clearCachedCustomerProfile();
      setLoading(false);
      return;
    }

    if (!forceRefresh && activeUserIdRef.current === nextUser.id && userRef.current?.id === nextUser.id) {
      userRef.current = nextUser;
      setUser((currentUser) => currentUser ?? nextUser);
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
    setIsAdmin(false);
    setCustomerProfile(readCachedCustomerProfile(nextUser.id));
    await hydrateSessionDetails(nextUser, resolutionId);
    if (resolutionId === authResolutionCounter) {
      setLoading(false);
    }
  }, [hydrateSessionDetails]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        await resolveAuthState(currentUser, true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (!session?.user && activeUserIdRef.current && event !== "SIGNED_OUT") {
        return;
      }
      if (event === "TOKEN_REFRESHED" && session?.user && activeUserIdRef.current === session.user.id) {
        return;
      }
      void resolveAuthState(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [resolveAuthState]);

  const updateCustomerType = async (customerType: CustomerType) => {
    if (!user) return new Error("Usuário não autenticado");

    const normalizedType = normalizeCustomerType(customerType);
    const { error } = await supabase
      .from(CUSTOMER_PROFILES_TABLE)
      .update({ customer_type: normalizedType })
      .eq("user_id", user.id);

    if (!error) {
      await fetchCustomerProfile(user.id);
    }

    return error;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) {
      return null;
    }

    if (data.session?.user) {
      return null;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      return null;
    }

    return error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error;
  };

  const registerCustomerProfile = async (data: Omit<CustomerRegistrationData, "email" | "password">) => {
    const { error } = await supabase.rpc("register_customer_profile", {
      p_name: data.name.trim(),
      p_phone: data.phone.trim(),
      p_company: data.company.trim(),
      p_cnpj: data.cnpj.trim(),
      p_customer_type: normalizeCustomerType(data.customer_type),
      ...addressFormToProfileColumns(data),
    });
    if (!error && user) {
      await syncCustomerProxisLink(data.cnpj.trim()).catch(() => null);
      await fetchCustomerProfile(user.id);
    }
    return error;
  };

  const signUpCustomer = async (data: CustomerRegistrationData) => {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
    });
    if (signUpError) return { error: signUpError, needsEmailConfirmation: false };

    const sessionUser = signUpData.user;
    const needsEmailConfirmation = !signUpData.session;

    if (signUpData.session?.user) {
      const { error: profileError } = await supabase.rpc("register_customer_profile", {
        p_name: data.name.trim(),
        p_phone: data.phone.trim(),
        p_company: data.company.trim(),
        p_cnpj: data.cnpj.trim(),
        p_customer_type: normalizeCustomerType(data.customer_type),
        ...addressFormToProfileColumns(data),
      });
      if (profileError) return { error: profileError, needsEmailConfirmation: false };
      if (sessionUser) {
        await syncCustomerProxisLink(data.cnpj.trim()).catch(() => null);
        await fetchCustomerProfile(sessionUser.id);
      }
    }

    return { error: null, needsEmailConfirmation };
  };

  const signOut = async () => {
    authResolutionCounter += 1;
    setUser(null);
    setIsAdmin(false);
    setCustomerProfile(null);
    setIsResolvingAccess(false);
    activeUserIdRef.current = null;
    userRef.current = null;
    isAdminRef.current = false;
    clearAuthBootstrap();
    clearCachedCustomerProfile();
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value: AuthContextValue = {
    user,
    isAdmin,
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
