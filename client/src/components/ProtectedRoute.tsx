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
    const { user, isLoading, isAdministrator } = useAuth();

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
                        return <Redirect to={`/admin/login?redirect=${encodeURIComponent(path)}`} />;
                    }
                } else {
                    if (!user) {
                        return <Redirect to={`/login?redirect=${encodeURIComponent(path)}`} />;
                    }
                }

                return <Component {...params} />;
            }}
        </Route>
    );
};
