// ════════════════════════════════════════════════════════════════════
// useCurrentUser — fetches /api/auth/me and exposes role helpers
// ════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { fetchCurrentUser, type CurrentUser } from '../lib/apiClient';

export type UserRole = 'admin' | 'reviewer' | 'user' | 'auditor';

export interface CurrentUserState {
  user: CurrentUser | null;
  loading: boolean;
  isAdmin: boolean;
  isReviewer: boolean;
  isUser: boolean;
  isAuditor: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  canEdit: boolean;
  canCreate: boolean;
}

export function useCurrentUser(): CurrentUserState {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const roles = user?.roles || [];
  const isAdmin = roles.includes('admin');
  const isReviewer = roles.includes('reviewer');
  const isUser = roles.includes('user');
  const isAuditor = roles.includes('auditor');

  function hasRole(...required: UserRole[]): boolean {
    return isAdmin || required.some((role) => roles.includes(role));
  }

  const canEdit = isAdmin || isReviewer;
  const canCreate = isAdmin || isReviewer;

  return { user, loading, isAdmin, isReviewer, isUser, isAuditor, hasRole, canEdit, canCreate };
}
