import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  CUSTOMER_PROFILES_TABLE,
  addressFormToProfileColumns,
  type CustomerProfile,
  type CustomerRegistrationData,
} from "@/lib/customerProfile";
import { normalizeCustomerType, type CustomerType } from "@/lib/pricing";

type AuthContextValue = {
  user: User | null;
  isAdmin: boolean;
  isCustomer: boolean;
  customerProfile: CustomerProfile | null;
  loading: boolean;
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

function normalizeCustomerProfile(profile: CustomerProfile): CustomerProfile {
  return {
    ...profile,
    customer_type: normalizeCustomerType(profile.customer_type),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCustomerProfile = useCallback(async (userId: string, resolutionId?: number) => {
    const { data, error } = await supabase
      .from(CUSTOMER_PROFILES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (typeof resolutionId === "number" && resolutionId !== authResolutionCounter) {
      return;
    }

    if (error || !data) {
      setCustomerProfile(null);
      return;
    }

    setCustomerProfile(normalizeCustomerProfile(data as CustomerProfile));
  }, []);

  const resolveAuthState = useCallback(async (nextUser: User | null) => {
    const resolutionId = ++authResolutionCounter;

    if (!nextUser) {
      if (resolutionId !== authResolutionCounter) return;
      setUser(null);
      setIsAdmin(false);
      setCustomerProfile(null);
      return;
    }

    try {
      const roleResult = await supabase.rpc("has_role", {
        _user_id: nextUser.id,
        _role: "admin",
      });

      if (resolutionId !== authResolutionCounter) return;

      setUser(nextUser);
      setIsAdmin(!roleResult.error && !!roleResult.data);
      // O perfil do cliente pode hidratar em segundo plano sem travar a navegação do admin.
      void fetchCustomerProfile(nextUser.id, resolutionId);
    } catch {
      if (resolutionId !== authResolutionCounter) return;
      setUser(nextUser);
      setIsAdmin(false);
      void fetchCustomerProfile(nextUser.id, resolutionId);
    }
  }, [fetchCustomerProfile]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        await resolveAuthState(currentUser);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      await resolveAuthState(session?.user ?? null);
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      if (sessionUser) await fetchCustomerProfile(sessionUser.id);
    }

    return { error: null, needsEmailConfirmation };
  };

  const signOut = async () => {
    authResolutionCounter += 1;
    setUser(null);
    setIsAdmin(false);
    setCustomerProfile(null);
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const value: AuthContextValue = {
    user,
    isAdmin,
    isCustomer: !!customerProfile,
    customerProfile,
    loading,
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
