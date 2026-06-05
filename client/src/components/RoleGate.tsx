
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'wouter';

interface RoleGateProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const RoleGate: React.FC<RoleGateProps> = ({ 
  allowedRoles, 
  children, 
  fallback = null,
  redirectTo 
}) => {
  const { user, hasRole } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (redirectTo && user && !hasRole(allowedRoles)) {
      setLocation(redirectTo);
    }
  }, [user, hasRole, allowedRoles, redirectTo, setLocation]);

  if (!user) {
    return fallback as React.ReactElement;
  }

  if (!hasRole(allowedRoles)) {
    return fallback as React.ReactElement;
  }

  return <>{children}</>;
};

interface RoleBasedProps {
  roles: string[];
  children: React.ReactNode;
}

export const ShowForRoles: React.FC<RoleBasedProps> = ({ roles, children }) => {
  const { hasRole } = useAuth();
  
  if (!hasRole(roles)) {
    return null;
  }

  return <>{children}</>;
};

export const HideForRoles: React.FC<RoleBasedProps> = ({ roles, children }) => {
  const { hasRole } = useAuth();
  
  if (hasRole(roles)) {
    return null;
  }

  return <>{children}</>;
};
