import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
    fullScreen?: boolean;
    className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
    message = 'Loading...',
    size = 'md',
    fullScreen = false,
    className = ''
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    const textSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    const containerClasses = fullScreen
        ? 'fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50'
        : 'flex items-center justify-center p-8';

    return (
        <div className={`${containerClasses} ${className}`}>
            <div className="flex flex-col items-center gap-3">
                <Loader2 className={`${sizeClasses[size]} text-[#008060] animate-spin`} />
                {message && (
                    <p className={`${textSizeClasses[size]} text-gray-600 font-medium`}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
};

interface AsyncContentProps {
    isLoading: boolean;
    error?: Error | null;
    loadingMessage?: string;
    errorMessage?: string;
    onRetry?: () => void;
    children: React.ReactNode;
    loadingSize?: 'sm' | 'md' | 'lg';
    fullScreen?: boolean;
}

export const AsyncContent: React.FC<AsyncContentProps> = ({
    isLoading,
    error,
    loadingMessage,
    errorMessage,
    onRetry,
    children,
    loadingSize = 'md',
    fullScreen = false
}) => {
    if (isLoading) {
        return <LoadingState message={loadingMessage} size={loadingSize} fullScreen={fullScreen} />;
    }

    if (error) {
        return (
            <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'p-8'}`}>
                <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 border border-red-200">
                    <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                        {errorMessage || 'Something went wrong'}
                    </h3>
                    <p className="text-sm text-gray-600 text-center mb-4">
                        {error.message || 'An unexpected error occurred'}
                    </p>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="w-full bg-[#008060] text-white py-2 px-4 rounded-lg hover:bg-[#006b51] transition-colors font-medium"
                        >
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

// Skeleton loaders for different content types
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse ${className}`}>
        <div className="bg-gray-200 rounded-lg h-48 mb-4"></div>
        <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
    </div>
);

export const SkeletonList: React.FC<{ count?: number; className?: string }> = ({
    count = 3,
    className = ''
}) => (
    <div className={`space-y-4 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="animate-pulse flex gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        ))}
    </div>
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
    lines = 3,
    className = ''
}) => (
    <div className={`animate-pulse space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
            <div
                key={i}
                className="h-4 bg-gray-200 rounded"
                style={{ width: `${Math.random() * 30 + 60}%` }}
            ></div>
        ))}
    </div>
);
