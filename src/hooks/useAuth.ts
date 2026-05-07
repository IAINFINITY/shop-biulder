import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const resolveAdminRole = async (u: User | null) => {
      if (!mounted) return;
      setUser(u);

      if (!u) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: u.id,
          _role: "admin",
        });
        if (error) {
          setIsAdmin(false);
          return;
        }
        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      }
    };

    const initAuth = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        await resolveAdminRole(data.session?.user ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true);
        try {
          await resolveAdminRole(session?.user ?? null);
        } finally {
          if (mounted) setLoading(false);
        }
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

  return { user, isAdmin, loading, signIn, signUp, signOut };
}
