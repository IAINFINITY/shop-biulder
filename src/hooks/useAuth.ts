import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  CUSTOMER_PROFILES_TABLE,
  addressFormToProfileColumns,
  type CustomerProfile,
  type CustomerRegistrationData,
} from "@/lib/customerProfile";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCustomerProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from(CUSTOMER_PROFILES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      setCustomerProfile(null);
      return;
    }
    setCustomerProfile(data as CustomerProfile | null);
  }, []);

  useEffect(() => {
    let mounted = true;

    const resolveRolesAndProfile = async (u: User | null) => {
      if (!mounted) return;
      setUser(u);

      if (!u) {
        setIsAdmin(false);
        setCustomerProfile(null);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: u.id,
          _role: "admin",
        });
        setIsAdmin(!error && !!data);
      } catch {
        setIsAdmin(false);
      }

      void fetchCustomerProfile(u.id);
    };

    const initAuth = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);
        setLoading(false);
        void resolveRolesAndProfile(currentUser);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
      void resolveRolesAndProfile(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchCustomerProfile]);

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
        ...addressFormToProfileColumns(data),
      });
      if (profileError) return { error: profileError, needsEmailConfirmation: false };
      if (sessionUser) await fetchCustomerProfile(sessionUser.id);
    }

    return { error: null, needsEmailConfirmation };
  };

  const signOut = () => supabase.auth.signOut();

  const isCustomer = !!customerProfile;

  return {
    user,
    isAdmin,
    isCustomer,
    customerProfile,
    loading,
    signIn,
    signUp,
    signUpCustomer,
    registerCustomerProfile,
    signOut,
    refreshCustomerProfile: fetchCustomerProfile,
  };
}
