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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdminSession = async () => {
      try {
        const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
        if (stored) {
          const { user: storedUser, session_token, roles: storedRoles } = JSON.parse(stored);
          
          if (storedUser && session_token) {
            // Validate session token against DB
            const { data: validatedUserId, error: validateError } = await supabase
              .rpc('validate_session', { p_session_token: session_token });

            if (validateError || !validatedUserId) {
              console.warn('Admin session token is invalid/expired. Clearing session.');
              localStorage.removeItem(ADMIN_STORAGE_KEY);
              setUser(null);
              setRoles([]);
            } else {
              // Re-verify admin roles from DB
              const { data: currentRoles, error: rolesError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', storedUser.id);

              if (rolesError || !currentRoles || currentRoles.length === 0) {
                console.warn('User no longer has admin roles. Clearing session.');
                localStorage.removeItem(ADMIN_STORAGE_KEY);
                setUser(null);
                setRoles([]);
              } else {
                setUser(storedUser);
                setRoles(currentRoles.map(r => r.role as AdminRole));
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load admin session:', error);
        localStorage.removeItem(ADMIN_STORAGE_KEY);
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
  };

  return {
    user,
    isAdmin: roles.length > 0,
    roles,
    loading,
    isSuperAdmin: roles.includes('super_admin'),
    isContentModerator: roles.includes('content_moderator') || roles.includes('super_admin'),
    isCategoryManager: roles.includes('category_manager') || roles.includes('super_admin'),
    signOut,
  };
}
