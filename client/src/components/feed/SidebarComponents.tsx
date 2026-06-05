import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AlumniPrideVideo } from "@/components/common/AlumniPrideVideo";

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
    <div className={`pb-6 ${className}`}>
        <div className="flex items-center justify-between mb-4 xl:mb-5">
            <h3 className="font-semibold text-gray-900 text-base xl:text-lg">{title}</h3>
            <button
                onClick={onViewAll}
                className="text-[#008060] text-sm hover:text-[#007055] font-medium flex items-center gap-1 transition-colors group"
            >
                <span>View all</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
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
                className={`${isMobile ? 'min-w-[280px] sm:min-w-[320px] snap-center' : ''} bg-gradient-to-br from-gray-50 to-white rounded-xl p-3 xl:p-5 hover:shadow-md transition-all duration-200 border border-gray-100 group`}
                onClick={() => onNavigate(`/events#event-${event.id}`)}
            >
                <div className="flex items-start gap-2 xl:gap-3 cursor-pointer mb-3">
                    <div className="text-center min-w-[3rem] bg-white rounded-lg p-1.5 shadow-sm border border-gray-50">
                        <div className="text-[10px] xl:text-xs text-gray-500 font-medium uppercase">
                            {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="text-lg xl:text-xl font-bold text-[#008060]">
                            {new Date(event.event_date).getDate()}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-xs xl:text-sm text-gray-900 mb-1 line-clamp-2 group-hover:text-[#008060] transition-colors">
                            {event.title}
                        </h4>
                        <div className="text-[10px] xl:text-xs text-gray-600 flex flex-col gap-0.5">
                            <span>{event.event_time || new Date(event.event_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="truncate">{event.is_virtual ? '🌐 Virtual' : `📍 ${event.location || event.venue}`}</span>
                        </div>
                    </div>
                </div>

                {!isPast ? (
                    isRegistrationClosed ? (
                        <div className="w-full py-1.5 bg-orange-50 text-orange-700 text-center text-[10px] xl:text-xs rounded-lg font-medium">
                            Registration Closed
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onRSVP(event.id, 'attending'); }}
                                disabled={isRsvping}
                                className={`flex-1 text-[10px] xl:text-xs py-1.5 h-auto rounded-lg transition-all ${userRsvpStatus === 'attending'
                                    ? 'bg-[#008060] text-white'
                                    : 'bg-white text-[#008060] border border-[#008060] hover:bg-[#008060]/5'
                                    }`}
                            >
                                {isRsvping ? '...' : userRsvpStatus === 'attending' ? '✓ Going' : 'Going'}
                            </Button>
                            <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onRSVP(event.id, 'maybe'); }}
                                disabled={isRsvping}
                                className={`flex-1 text-[10px] xl:text-xs py-1.5 h-auto rounded-lg transition-all ${userRsvpStatus === 'maybe'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-blue-500 border border-blue-500 hover:bg-blue-50'
                                    }`}
                            >
                                {isRsvping ? '...' : userRsvpStatus === 'maybe' ? '✓ Maybe' : 'Maybe'}
                            </Button>
                            <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onRSVP(event.id, 'not_attending'); }}
                                disabled={isRsvping}
                                className={`flex-1 text-[10px] xl:text-xs py-1.5 h-auto rounded-lg transition-all ${userRsvpStatus === 'not_attending'
                                    ? 'bg-gray-500 text-white'
                                    : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                {isRsvping ? '...' : userRsvpStatus === 'not_attending' ? '✓ No' : 'No'}
                            </Button>
                        </div>
                    )
                ) : (
                    <div className="w-full py-1.5 bg-gray-100 text-gray-500 text-center text-[10px] xl:text-xs rounded-lg font-medium">
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
        <SidebarSection title="Upcoming Events" viewAllPath="/events" onViewAll={() => onNavigate("/events")} className="border-b border-gray-100 mb-6">
            {events.length > 0 ? (
                <div className="space-y-4">
                    {events.slice(0, 3).map(renderEventCard)}
                </div>
            ) : (
                <p className="text-sm text-gray-500 text-center py-8">No upcoming events</p>
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
                className={`${isMobile ? 'min-w-[280px] sm:min-w-[320px] snap-center' : ''} bg-gradient-to-br from-gray-50 to-white rounded-xl p-3 xl:p-5 hover:shadow-md transition-all duration-200 border border-gray-100 cursor-pointer group`}
                onClick={() => onNavigate(`/job-portal?jobId=${job.id}`)}
            >
                <div className="flex items-center gap-2 xl:gap-3 mb-3">
                    <div className="w-10 h-10 xl:w-12 xl:h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform border border-gray-50">
                        <span className="text-xl xl:text-2xl">💼</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-xs xl:text-sm text-gray-900 truncate group-hover:text-[#008060] transition-colors">{job.title}</h4>
                        <p className="text-[10px] xl:text-xs text-gray-600 truncate">{job.company} | {job.location}</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onApply(job.id); }}
                    disabled={hasApplied || isApplying}
                    className={`w-full text-[10px] xl:text-xs py-1.5 h-auto rounded-lg transition-all ${hasApplied
                        ? 'bg-green-500 text-white'
                        : 'bg-[#008060] text-white hover:bg-[#007055]'
                        }`}
                >
                    {isApplying ? 'Applying...' : hasApplied ? '✓ Applied' : 'Apply Now'}
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
        <SidebarSection title="Recent Jobs" viewAllPath="/job-portal" onViewAll={() => onNavigate("/job-portal")} className="border-b border-gray-100 mb-6">
            <div className="space-y-4">
                {jobs.length > 0 ? jobs.slice(0, 3).map(renderJobCard) : <p className="text-sm text-gray-500 text-center py-4">No jobs found</p>}
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
            if (score >= 40) return { text: 'High match', color: 'text-green-600', icon: '🎯' };
            if (score >= 25) return { text: 'Good match', color: 'text-blue-600', icon: '✨' };
            return { text: 'Potential', color: 'text-gray-600', icon: '💫' };
        };

        const match = getMatchDetails(connection.connection_score || 0);

        return (
            <div
                key={connection.user_id || connection.id}
                className={`${isMobile ? 'min-w-[260px] sm:min-w-[280px] snap-center' : 'flex flex-col gap-2 p-3 xl:p-4'} bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200 group`}
            >
                <div className={`flex ${isMobile ? 'flex-col items-center text-center p-4' : 'items-start'} gap-3`}>
                    <Avatar
                        className={`${isMobile ? 'w-16 h-16' : 'w-12 h-12'} ring-2 ring-white shadow-sm cursor-pointer group-hover:ring-[#008060]/20 transition-all`}
                        onClick={() => onNavigate(`/profile/${connection.user_id || connection.id}`)}
                    >
                        <AvatarImage src={getConnectionAvatar()} alt={connectionName} />
                        <AvatarFallback className="bg-[#008060] text-white">
                            {connectionName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 w-full">
                        <h4
                            className="font-semibold text-sm text-gray-900 truncate mb-0.5 cursor-pointer hover:text-[#008060] hover:underline transition-colors"
                            onClick={() => onNavigate(`/profile/${connection.user_id || connection.id}`)}
                        >
                            {connectionName}
                        </h4>
                        <p className="text-[10px] xl:text-xs text-gray-500 line-clamp-1 mb-1.5">
                            {connection.current_role || ''} {connection.current_company && `at ${connection.current_company}`}
                        </p>
                        {connection.connection_score > 0 && (
                            <div className={`flex items-center gap-1.5 mb-2 ${isMobile ? 'justify-center' : ''}`}>
                                <span className="text-xs">{match.icon}</span>
                                <span className={`text-[10px] xl:text-xs font-medium ${match.color}`}>{match.text}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className={`${isMobile ? 'px-4 pb-4' : ''}`}>
                    <Button
                        size="sm"
                        onClick={() => onConnect(connection.user_id || connection.id, isSent)}
                        variant={isSent ? "outline" : "brand"}
                        className="w-full text-[10px] xl:text-xs py-1.5 h-auto rounded-lg font-medium"
                    >
                        {isSent ? 'Withdraw' : 'Connect'}
                    </Button>
                </div>
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
            <div className="space-y-4">
                {connections.length > 0 ? connections.slice(0, 3).map(renderConnectionCard) : <p className="text-sm text-gray-500 text-center py-8">No suggestions yet</p>}
            </div>
        </SidebarSection>
    );
};
