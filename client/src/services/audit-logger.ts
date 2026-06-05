import { getCurrentUTCTimestamp } from "../../../shared/time-utils";

/**
 * Audit Log Event Types
 */
export enum AuditEventType {
    // Authentication Events
    USER_LOGIN = 'user.login',
    USER_LOGOUT = 'user.logout',
    USER_REGISTER = 'user.register',
    PASSWORD_RESET_REQUEST = 'user.password_reset_request',
    PASSWORD_RESET_COMPLETE = 'user.password_reset_complete',
    PASSWORD_CHANGE = 'user.password_change',

    // Profile Events
    PROFILE_UPDATE = 'profile.update',
    PROFILE_VIEW = 'profile.view',
    EMAIL_CHANGE = 'user.email_change',
    USERNAME_CHANGE = 'user.username_change',

    // Forum Events
    FORUM_THREAD_CREATE = 'forum.thread.create',
    FORUM_THREAD_UPDATE = 'forum.thread.update',
    FORUM_THREAD_DELETE = 'forum.thread.delete',
    FORUM_POST_CREATE = 'forum.post.create',
    FORUM_POST_UPDATE = 'forum.post.update',
    FORUM_POST_DELETE = 'forum.post.delete',
    FORUM_VOTE = 'forum.vote',

    // Connection Events
    CONNECTION_REQUEST = 'connection.request',
    CONNECTION_ACCEPT = 'connection.accept',
    CONNECTION_REJECT = 'connection.reject',
    CONNECTION_WITHDRAW = 'connection.withdraw',

    // Admin Events
    ADMIN_USER_BLOCK = 'admin.user.block',
    ADMIN_USER_UNBLOCK = 'admin.user.unblock',
    ADMIN_POST_APPROVE = 'admin.post.approve',
    ADMIN_POST_REJECT = 'admin.post.reject',

    // Security Events
    FAILED_LOGIN_ATTEMPT = 'security.failed_login',
    SUSPICIOUS_ACTIVITY = 'security.suspicious_activity',
    ACCOUNT_LOCKED = 'security.account_locked',
}

/**
 * Audit Log Entry Interface
 */
export interface AuditLogEntry {
    id?: string;
    event_type: AuditEventType;
    user_id: string | null;
    target_user_id?: string | null;
    target_resource_type?: string;
    target_resource_id?: string;
    action: string;
    details?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
    status: 'success' | 'failure' | 'pending';
    error_message?: string;
    timestamp: string; // ISO 8601 UTC timestamp
    created_at?: string;
}

/**
 * Audit Logger Class
 */
export class AuditLogger {
    private static instance: AuditLogger;
    private logQueue: AuditLogEntry[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private readonly FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
    private readonly MAX_QUEUE_SIZE = 50;

    private constructor() {
        this.startAutoFlush();
    }

    public static getInstance(): AuditLogger {
        if (!AuditLogger.instance) {
            AuditLogger.instance = new AuditLogger();
        }
        return AuditLogger.instance;
    }

    /**
     * Log an audit event
     */
    public async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
        const logEntry: AuditLogEntry = {
            ...entry,
            timestamp: getCurrentUTCTimestamp(),
        };

        // Add to queue
        this.logQueue.push(logEntry);

        // Flush if queue is full
        if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
            await this.flush();
        }

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.log('[AUDIT]', logEntry);
        }
    }

    /**
     * Flush the log queue to the database
     */
    private async flush(): Promise<void> {
        if (this.logQueue.length === 0) return;

        const logsToFlush = [...this.logQueue];
        this.logQueue = [];

        try {
            // Send to backend API
            const response = await fetch('/api/audit-logs/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ logs: logsToFlush }),
            });

            if (!response.ok) {
                console.error('Failed to flush audit logs:', await response.text());
                // Re-add to queue on failure
                this.logQueue.unshift(...logsToFlush);
            }
        } catch (error) {
            console.error('Error flushing audit logs:', error);
            // Re-add to queue on error
            this.logQueue.unshift(...logsToFlush);
        }
    }

    /**
     * Start auto-flush interval
     */
    private startAutoFlush(): void {
        this.flushInterval = setInterval(() => {
            this.flush();
        }, this.FLUSH_INTERVAL_MS);
    }

    /**
     * Stop auto-flush and flush remaining logs
     */
    public async shutdown(): Promise<void> {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        await this.flush();
    }

    /**
     * Helper method to log user authentication events
     */
    public logAuth(
        eventType: AuditEventType,
        userId: string | null,
        status: 'success' | 'failure',
        details?: Record<string, any>
    ): void {
        this.log({
            event_type: eventType,
            user_id: userId,
            action: eventType.split('.').pop() || 'unknown',
            status,
            details,
        });
    }

    /**
     * Helper method to log resource modifications
     */
    public logResourceChange(
        eventType: AuditEventType,
        userId: string,
        resourceType: string,
        resourceId: string,
        action: string,
        details?: Record<string, any>
    ): void {
        this.log({
            event_type: eventType,
            user_id: userId,
            target_resource_type: resourceType,
            target_resource_id: resourceId,
            action,
            status: 'success',
            details,
        });
    }

    /**
     * Helper method to log security events
     */
    public logSecurity(
        eventType: AuditEventType,
        userId: string | null,
        details: Record<string, any>,
        ipAddress?: string
    ): void {
        this.log({
            event_type: eventType,
            user_id: userId,
            action: 'security_event',
            status: 'success',
            details,
            ip_address: ipAddress,
        });
    }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Cleanup on process exit
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        auditLogger.shutdown();
    });
}
