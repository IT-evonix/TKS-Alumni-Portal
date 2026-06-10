import React from 'react';
import { Route, Redirect } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    path: string;
    component: React.ComponentType<any>;
    adminOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    path,
    component: Component,
    adminOnly = false
}) => {
    const { user, adminUser, isLoading, isAdministrator } = useAuth();

    return (
        <Route path={path}>
            {(params) => {
                if (isLoading) {
                    return (
                        <div className="flex h-screen items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    );
                }

                if (adminOnly) {
                    if (!isAdministrator) {
                        // If they are a logged in user but not admin, send to their feed
                        if (user) {
                            return <Redirect to="/feed" />;
                        }
                        return <Redirect to={`/admin/login?redirect=${encodeURIComponent(path)}`} />;
                    }
                } else {
                    if (!user && !isAdministrator) {
                        return <Redirect to={`/login?redirect=${encodeURIComponent(path)}`} />;
                    }
                }

                return <Component {...params} />;
            }}
        </Route>
    );
};

interface PublicRouteProps {
    path: string;
    component: React.ComponentType<any>;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({
    path,
    component: Component
}) => {
    const { user, isAdministrator, isLoading } = useAuth();

    return (
        <Route path={path}>
            {(params) => {
                if (isLoading) {
                    return (
                        <div className="flex h-screen items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    );
                }

                // If user is already logged in, they should stay in the portal
                if (isAdministrator) {
                    return <Redirect to="/admin/dashboard" />;
                }
                
                if (user) {
                    return <Redirect to="/feed" />;
                }

                return <Component {...params} />;
            }}
        </Route>
    );
};
