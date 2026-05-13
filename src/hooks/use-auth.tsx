import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "sales";
export interface AuthProfile {
  id: string;
  full_name: string;
  sales_code: string | null;
  email: string | null;
}
interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CACHE_KEY = "binowo_auth_cache";

function saveCache(profile: AuthProfile, role: AppRole) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ profile, role }));
}

function loadCache(): { profile: AuthProfile; role: AppRole } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cached = loadCache();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(cached?.profile ?? null);
  const [role, setRole] = useState<AppRole | null>(cached?.role ?? null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    if (!navigator.onLine) {
      // Gunakan cache saat offline
      const cache = loadCache();
      if (cache) {
        setProfile(cache.profile);
        setRole(cache.role);
      }
      return;
    }
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, sales_code, email").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (prof) {
      setProfile(prof);
      const r = roles?.find((x) => x.role === "admin") ? "admin" : roles?.[0]?.role ?? null;
      setRole((r as AppRole) ?? null);
      // Simpan ke cache
      if (r) saveCache(prof, r as AppRole);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setLoading(true);
        setTimeout(() => {
          loadProfile(newSession.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        // Jangan clear state saat offline (mungkin hanya gagal refresh token)
        if (navigator.onLine) {
          setProfile(null);
          setRole(null);
          clearCache();
        }
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id).finally(() => setLoading(false));
      } else if (!navigator.onLine && loadCache()) {
        // Offline tapi ada cache — tetap izinkan masuk
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!navigator.onLine) {
      return { error: "Tidak ada koneksi internet. Silakan sambungkan ke internet untuk login pertama kali." };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    clearCache();
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, role, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
