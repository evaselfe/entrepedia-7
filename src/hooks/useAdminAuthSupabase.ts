import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AdminRole = 'super_admin' | 'content_moderator' | 'category_manager';

interface AdminUser {
  id: string;
  mobile_number: string;
  full_name: string | null;
}

interface AdminAuthState {
  user: AdminUser | null;
  isAdmin: boolean;
  roles: AdminRole[];
  sessionToken: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isContentModerator: boolean;
  isCategoryManager: boolean;
  signOut: () => Promise<void>;
}

const ADMIN_STORAGE_KEY = 'admin_session';

export function useAdminAuthSupabase(): AdminAuthState {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdminSession = async () => {
      try {
        const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
        if (stored) {
          const { user: storedUser, session_token } = JSON.parse(stored);
          
          if (storedUser && session_token) {
            // IMPORTANT: Admin panel uses a custom session token (not supabase.auth).
            // We must validate roles via a server-side check (edge function w/ service role)
            // instead of querying user_roles from the browser (RLS will block it).
            const res = await supabase.functions.invoke('mobile-auth', {
              body: {
                action: 'admin_validate',
                session_token,
              },
            });

            const data = res.data as any;

            if (res.error || !data?.success) {
              console.warn('Admin session token is invalid/expired. Clearing session.');
              localStorage.removeItem(ADMIN_STORAGE_KEY);
              setUser(null);
              setRoles([]);
              setSessionToken(null);
              return;
            }

            const validatedRoles = (data.roles || []) as AdminRole[];
            const validatedUser = (data.user || storedUser) as AdminUser;

            if (!validatedRoles.length) {
              console.warn('User no longer has admin roles. Clearing session.');
              localStorage.removeItem(ADMIN_STORAGE_KEY);
              setUser(null);
              setRoles([]);
              setSessionToken(null);
              return;
            }

            // Keep storage in sync with server
            localStorage.setItem(
              ADMIN_STORAGE_KEY,
              JSON.stringify({ user: validatedUser, session_token, roles: validatedRoles })
            );
            setUser(validatedUser);
            setRoles(validatedRoles);
            setSessionToken(session_token);
          }
        } else {
          setSessionToken(null);
        }
      } catch (error) {
        console.error('Failed to load admin session:', error);
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        setSessionToken(null);
      } finally {
        setLoading(false);
      }
    };

    loadAdminSession();
  }, []);

  const signOut = async () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setUser(null);
    setRoles([]);
    setSessionToken(null);
  };

  return {
    user,
    isAdmin: roles.length > 0,
    roles,
    sessionToken,
    loading,
    isSuperAdmin: roles.includes('super_admin'),
    isContentModerator: roles.includes('content_moderator') || roles.includes('super_admin'),
    isCategoryManager: roles.includes('category_manager') || roles.includes('super_admin'),
    signOut,
  };
}
