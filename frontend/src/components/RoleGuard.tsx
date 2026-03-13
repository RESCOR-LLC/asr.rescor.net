// ════════════════════════════════════════════════════════════════════
// RoleGuard — conditionally renders children based on user roles
// ════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';
import type { UserRole } from '../hooks/useCurrentUser';

interface RoleGuardProps {
  roles: UserRole[];
  isAdmin: boolean;
  userRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RoleGuard({ roles, isAdmin, userRoles, children, fallback = null }: RoleGuardProps) {
  if (isAdmin || roles.some((role) => userRoles.includes(role))) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
