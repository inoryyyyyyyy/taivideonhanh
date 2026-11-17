import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: 'admin' | 'user' | 'editor' | null;
  signOut: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  signOut: () => {},
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | 'editor' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase.from('wallets').select('role').eq('user_id', userId).single();
    if (data) {
      setRole(data.role);
    } else {
      setRole('user');
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          if (_event === 'SIGNED_IN') {
             // Check if it's a new registration
             const createdAt = new Date(session.user.created_at).getTime();
             if (Date.now() - createdAt < 60000) { // within 60 seconds
                // Track CompleteRegistration
                if (typeof window !== 'undefined') {
                   const fbq = (window as any).fbq;
                   const ttq = (window as any).ttq;
                   if (fbq) fbq('track', 'CompleteRegistration', { currency: 'VND', value: 0 });
                   if (ttq) ttq.track('CompleteRegistration', { currency: 'VND', value: 0 });
                }
             }
          }
          await fetchRole(session.user.id);
          setLoading(false);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
