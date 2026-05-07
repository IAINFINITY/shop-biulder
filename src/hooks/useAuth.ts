import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const resolveAdminRole = async (u: User | null) => {
      if (!mounted) return;
      setUser(u);

      if (!u) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      setAdminLoading(true);
      try {
        const rolePromise = supabase.rpc("has_role", {
          _user_id: u.id,
          _role: "admin",
        });

        // Avoid keeping admin screen blocked forever on flaky networks.
        const timeoutPromise = new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("role-check-timeout")), 7000);
        });

        const { data, error } = await Promise.race([rolePromise, timeoutPromise]);
        if (error) {
          setIsAdmin(false);
          return;
        }
        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      } finally {
        if (mounted) setAdminLoading(false);
      }
    };

    const initAuth = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);
        setLoading(false);
        void resolveAdminRole(currentUser);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        setLoading(false);
        void resolveAdminRole(session?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error;
  };

  const signOut = () => supabase.auth.signOut();

  return { user, isAdmin, loading, adminLoading, signIn, signUp, signOut };
}
