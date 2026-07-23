import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AlumniPrideVideo } from "@/components/common/AlumniPrideVideo";
import { Briefcase } from "lucide-react";

interface Event {
    id: string;
    title: string;
    event_date: string;
    event_time?: string;
    is_virtual?: boolean;
    location?: string;
    venue?: string;
    rsvp_count: number;
    user_rsvp?: { status: string };
    registration_deadline?: string;
}

interface Job {
    id: string;
    title: string;
    company: string;
    location: string;
    job_type?: string;
}

interface Connection {
    id: string;
    user_id?: string;
    username: string;
    first_name: string;
    last_name: string;
    profile_picture?: string;
    gender?: string;
    current_role?: string;
    current_company?: string;
    connection_score: number;
    connection_reasons?: string[];
}

interface SidebarSectionProps {
    title: string;
    viewAllPath: string;
    onViewAll: () => void;
    children: React.ReactNode;
    className?: string;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({ title, viewAllPath, onViewAll, children, className = "" }) => (
    <div className={`p-4 sm:p-4.5 ${className}`} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)', background: 'var(--surface-card)' }}>
        <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-semibold text-gray-900 text-[13px] tracking-tight">{title}</h3>
            <button
                onClick={onViewAll}
                className="text-[12px] font-medium flex items-center gap-0.5 transition-colors group hover:opacity-80"
                style={{ color: 'var(--brand-primary)' }}
            >
                <span>View all</span>
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
        </div>
        {children}
    </div>
);

export const SidebarEvents: React.FC<{
    events: Event[];
    onRSVP: (eventId: string, status: 'attending' | 'maybe' | 'not_attending') => void | Promise<void>;
    rsvpingEvent: string | null;
    eventRsvps: Map<string, string>;
    onNavigate: (path: string) => void;
    isMobile?: boolean;
}> = ({ events, onRSVP, rsvpingEvent, eventRsvps, onNavigate, isMobile }) => {
    // Show all upcoming events, regardless of RSVP status
    // Don't filter out events - display everything that comes from the API

    const renderEventCard = (event: Event) => {
        const userRsvpStatus = event.user_rsvp?.status || eventRsvps.get(event.id) || null;
        const isPast = new Date(event.event_date) < new Date();
        const isRegistrationClosed = event.registration_deadline && new Date(event.registration_deadline) < new Date();
        const isRsvping = rsvpingEvent === event.id;

        return (
            <div
                key={event.id}
                className={`${isMobile ? 'min-w-[280px] sm:min-w-[300px] snap-center' : ''} rounded-xl p-3 hover:shadow-sm transition-all duration-200 group cursor-pointer`}
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}
                onClick={() => onNavigate(`/events#event-${event.id}`)}
            >
                <div className="flex items-start gap-3 mb-3">
                    {/* Brand date box */}
                    <div className="w-10 h-10 flex flex-col items-center justify-center rounded-lg flex-shrink-0 text-white" style={{ background: 'var(--brand-primary)' }}>
                        <span className="text-[9px] font-semibold uppercase leading-none">
                            {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-[15px] font-bold leading-none mt-0.5">
                            {new Date(event.event_date).getDate()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[13px] text-gray-900 mb-0.5 line-clamp-2 group-hover:text-[#008060] transition-colors">
                            {event.title}
                        </h4>
                        <p className="text-[11px] text-gray-500 truncate">
                            {event.is_virtual ? '🌐 Virtual' : `📍 ${event.location || event.venue || 'TBD'}`}
                        </p>
                    </div>
                </div>

                {!isPast ? (
                    isRegistrationClosed ? (
                        <div className="w-full py-1 bg-orange-50 text-orange-600 text-center text-[10px] rounded-full font-medium border border-orange-100">
                            Registration Closed
                        </div>
                    ) : (
                        <div className="flex gap-1.5">
                            {(['attending', 'maybe', 'not_attending'] as const).map((status) => {
                                const labels: Record<string, string> = { attending: 'Going', maybe: 'Maybe', not_attending: 'No' };
                                const activeStyles: Record<string, string> = {
                                    attending: 'bg-[#008060] text-white border-[#008060]',
                                    maybe: 'bg-blue-500 text-white border-blue-500',
                                    not_attending: 'bg-gray-400 text-white border-gray-400',
                                };
                                const isActive = userRsvpStatus === status;
                                return (
                                    <Button
                                        key={status}
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); onRSVP(event.id, status); }}
                                        disabled={isRsvping}
                                        className={`flex-1 text-[10px] h-7 rounded-full border transition-all font-medium ${isActive ? activeStyles[status] : 'bg-white text-gray-600 border-gray-200 hover:border-[#008060] hover:text-[#008060]'}`}
                                    >
                                        {isRsvping ? '…' : isActive ? `✓ ${labels[status]}` : labels[status]}
                                    </Button>
                                );
                            })}
                        </div>
                    )
                ) : (
                    <div className="w-full py-1 bg-gray-100 text-gray-400 text-center text-[10px] rounded-full font-medium">
                        Ended
                    </div>
                )}
            </div>
        );
    };

    if (isMobile) {
        return (
            <div className="xl:hidden mb-6">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-semibold text-gray-900 text-base sm:text-lg">Upcoming Events</h3>
                    <button onClick={() => onNavigate("/events")} className="text-[#008060] text-sm font-medium hover:underline">View all</button>
                </div>
                {events.length > 0 ? (
                    <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
                        {events.map(renderEventCard)}
                    </div>
                ) : (
                    <div className="text-gray-500 text-sm p-6 text-center bg-gray-50 rounded-xl border border-gray-100">
                        No upcoming events at the moment
                    </div>
                )}
            </div>
        );
    }

    return (
        <SidebarSection title="Upcoming Events" viewAllPath="/events" onViewAll={() => onNavigate("/events")}>
            {events.length > 0 ? (
                <div className="space-y-2">
                    {events.slice(0, 3).map(renderEventCard)}
                </div>
            ) : (
                <p className="text-xs text-gray-400 text-center py-4">No upcoming events</p>
            )}
        </SidebarSection>
    );
};

export const SidebarJobs: React.FC<{
    jobs: Job[];
    onApply: (jobId: string) => void;
    applyingToJob: string | null;
    appliedJobs: Set<string>;
    onNavigate: (path: string) => void;
    isMobile?: boolean;
}> = ({ jobs, onApply, applyingToJob, appliedJobs, onNavigate, isMobile }) => {
    const renderJobCard = (job: Job) => {
        const hasApplied = appliedJobs.has(job.id);
        const isApplying = applyingToJob === job.id;

        return (
            <div
                key={job.id}
                className={`${isMobile ? 'min-w-[260px] sm:min-w-[300px] snap-center' : ''} rounded-xl p-3 hover:shadow-sm transition-all duration-200 border cursor-pointer group`}
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}
                onClick={() => onNavigate(`/job-portal?jobId=${job.id}`)}
            >
                <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-primary-light)' }}>
                        <Briefcase className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[13px] text-gray-900 truncate group-hover:text-[#008060] transition-colors">{job.title}</h4>
                        <p className="text-[11px] text-gray-500 truncate">{job.company} · {job.location}</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onApply(job.id); }}
                    disabled={hasApplied || isApplying}
                    className={`w-full text-[11px] h-7 rounded-full font-medium transition-all ${hasApplied
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-[#008060] text-white hover:bg-[#006b51]'
                        }`}
                >
                    {isApplying ? 'Applying…' : hasApplied ? '✓ Applied' : 'Apply Now'}
                </Button>
            </div>
        );
    };

    if (isMobile) {
        return (
            <div className="xl:hidden mb-6">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-semibold text-gray-900 text-base sm:text-lg">Recent Jobs</h3>
                    <button onClick={() => onNavigate("/job-portal")} className="text-[#008060] text-sm font-medium hover:underline">View all</button>
                </div>
                <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
                    {jobs.length > 0 ? jobs.map(renderJobCard) : <div className="text-gray-500 text-sm p-4 w-full text-center">No jobs found</div>}
                </div>
            </div>
        );
    }

    return (
        <SidebarSection title="Recent Jobs" viewAllPath="/job-portal" onViewAll={() => onNavigate("/job-portal")}>
            <div className="space-y-2">
                {jobs.length > 0 ? jobs.slice(0, 3).map(renderJobCard) : <p className="text-xs text-gray-400 text-center py-4">No jobs found</p>}
            </div>
        </SidebarSection>
    );
};

export const SidebarConnections: React.FC<{
    connections: Connection[];
    onConnect: (userId: string, isWithdraw: boolean) => void;
    sentConnections: Set<string>;
    onNavigate: (path: string) => void;
    isMobile?: boolean;
}> = ({ connections, onConnect, sentConnections, onNavigate, isMobile }) => {
    const renderConnectionCard = (connection: Connection) => {
        const connectionName = `${connection.first_name} ${connection.last_name}`.trim() || connection.username;
        const isSent = sentConnections.has(connection.user_id || connection.id);

        const getConnectionAvatar = () => {
            if (connection.profile_picture) return connection.profile_picture;
            const seed = encodeURIComponent(connectionName);
            switch (connection.gender) {
                case 'male': return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
                case 'female': return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
                default: return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=008060`;
            }
        };

        const getMatchDetails = (score: number) => {
            if (score >= 40) return { text: 'High match', bg: 'bg-green-50', color: 'text-green-700' };
            if (score >= 25) return { text: 'Good match', bg: 'bg-blue-50', color: 'text-blue-600' };
            return { text: 'Potential', bg: 'bg-gray-100', color: 'text-gray-500' };
        };

        const match = getMatchDetails(connection.connection_score || 0);

        return (
            <div
                key={connection.user_id || connection.id}
                className={`${isMobile ? 'min-w-[240px] sm:min-w-[260px] snap-center' : ''} rounded-xl p-3 transition-all duration-200 group`}
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}
            >
                <div className={`flex ${isMobile ? 'flex-col items-center text-center' : 'items-center'} gap-3 mb-2.5`}>
                    <Avatar
                        className="w-10 h-10 ring-2 cursor-pointer transition-all flex-shrink-0"
                        style={{ '--tw-ring-color': 'var(--border-default)' } as React.CSSProperties}
                        onClick={() => onNavigate(`/profile/${connection.user_id || connection.id}`)}
                    >
                        <AvatarImage src={getConnectionAvatar()} alt={connectionName} />
                        <AvatarFallback className="bg-[#008060] text-white text-xs">
                            {connectionName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 w-full">
                        <h4
                            className="font-semibold text-[13px] text-gray-900 truncate cursor-pointer hover:text-[#008060] transition-colors"
                            onClick={() => onNavigate(`/profile/${connection.user_id || connection.id}`)}
                        >
                            {connectionName}
                        </h4>
                        <p className="text-[11px] text-gray-500 truncate">
                            {connection.current_role || ''}{connection.current_company ? ` · ${connection.current_company}` : ''}
                        </p>
                        {connection.connection_score > 0 && (
                            <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${match.bg} ${match.color}`}>
                                {match.text}
                            </span>
                        )}
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={() => onConnect(connection.user_id || connection.id, isSent)}
                    variant={isSent ? "outline" : "brand"}
                    className="w-full text-[11px] h-7 rounded-full font-medium"
                >
                    {isSent ? 'Withdraw' : 'Connect'}
                </Button>
            </div>
        );
    };

    if (isMobile) {
        return (
            <div className="xl:hidden mb-6">
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-semibold text-gray-900 text-base sm:text-lg">People You May Know</h3>
                    <button onClick={() => onNavigate("/connections")} className="text-[#008060] text-sm font-medium hover:underline">View all</button>
                </div>
                <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
                    {connections.length > 0 ? connections.map(renderConnectionCard) : <div className="text-gray-500 text-sm p-4 w-full text-center">No suggestions yet</div>}
                </div>
            </div>
        );
    }

    return (
        <SidebarSection title="You May Know" viewAllPath="/connections" onViewAll={() => onNavigate("/connections")}>
            <div className="space-y-2">
                {connections.length > 0 ? connections.slice(0, 3).map(renderConnectionCard) : <p className="text-xs text-gray-400 text-center py-4">No suggestions yet</p>}
            </div>
        </SidebarSection>
    );
};
