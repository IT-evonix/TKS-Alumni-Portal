import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Briefcase, Building2, Clock, DollarSign, Globe, Mail, Tag } from "lucide-react";

interface Job {
    id: string;
    title: string;
    company: string;
    location?: string;
    job_type?: string;
    work_mode?: string;
    description?: string;
    requirements?: string;
    experience_level?: string;
    salary_min?: number;
    salary_max?: number;
    application_url?: string;
    contact_email?: string;
    industry?: string;
    skills?: string;
    company_logo?: string;
    created_at: string;
    posted_by_user?: {
        id: string;
        username: string;
        email: string;
        alumni?: {
            first_name: string;
            last_name: string;
        };
    };
}

function getWorkModeColor(mode?: string) {
    if (!mode) return "bg-gray-100 text-gray-600";
    const m = mode.toLowerCase();
    if (m === "remote") return "bg-emerald-50 text-emerald-700";
    if (m === "hybrid") return "bg-blue-50 text-blue-700";
    return "bg-amber-50 text-amber-700";
}

function getJobTypeLabel(type?: string) {
    if (!type) return "Full-time";
    return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

export const UpcomingJobsSection = (): JSX.Element => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const { user } = useAuth();
    const [, setLocation] = useLocation();

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const response = await fetch("/api/jobs?limit=3");
                if (response.ok) {
                    const data = await response.json();
                    setJobs(data.jobs || []);
                }
            } catch (err) {
                console.error("Failed to fetch jobs:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchJobs();
    }, []);

    const handleViewDetails = (jobId: string) => {
        if (user) {
            setLocation(`/job-portal#job-${jobId}`);
        } else {
            sessionStorage.setItem("scrollToJobId", jobId);
            sessionStorage.setItem("redirectAfterLogin", `/job-portal#job-${jobId}`);
            setLocation("/login");
        }
    };

    const handleApplyClick = (jobId: string) => {
        if (user) {
            setLocation(`/job-portal#job-${jobId}`);
        } else {
            sessionStorage.setItem("scrollToJobId", jobId);
            sessionStorage.setItem("redirectAfterLogin", `/job-portal#job-${jobId}`);
            setLocation("/login");
        }
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (jobs.length === 0) {
        return (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200 max-w-2xl mx-auto">
                <h3 className="text-lg font-semibold text-gray-700">No job openings posted yet</h3>
                <p className="text-gray-500 mt-2 text-sm">Check back soon for alumni referrals and job postings!</p>
            </div>
        );
    }

    const CompanyAvatar = ({ job, size = "lg" }: { job: Job; size?: "sm" | "lg" }) => {
        const s = size === "lg" ? "w-12 h-12 text-lg" : "w-10 h-10 text-sm";
        if (job.company_logo) {
            return (
                <img
                    src={job.company_logo}
                    alt={job.company}
                    className={`${s} rounded-xl object-cover border border-gray-200`}
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
            );
        }
        return (
            <div className={`${s} rounded-xl bg-gray-900 flex items-center justify-center`}>
                <span className="text-white font-bold">{job.company?.[0]?.toUpperCase() || "J"}</span>
            </div>
        );
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {jobs.map((job) => (
                    <Card
                        key={job.id}
                        className="group overflow-hidden rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg shadow-sm transition-all duration-300 bg-white"
                    >
                        <CardContent className="p-0">
                            <div className="p-5">
                                {/* Company + Logo */}
                                <div className="flex items-start gap-3 mb-4">
                                    <CompanyAvatar job={job} size="lg" />
                                    <div className="flex-1 min-w-0">
                                        <h3
                                            className="font-semibold text-gray-900 text-base leading-tight line-clamp-2 group-hover:text-gray-700 transition-colors cursor-pointer"
                                            onClick={() => setSelectedJob(job)}
                                        >
                                            {job.title}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                                            <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                            {job.company}
                                        </p>
                                    </div>
                                </div>

                                {/* Meta Info */}
                                <div className="space-y-1.5 mb-4">
                                    {job.location && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                            {job.location}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {job.work_mode && (
                                            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${getWorkModeColor(job.work_mode)}`}>
                                                {job.work_mode.charAt(0).toUpperCase() + job.work_mode.slice(1)}
                                            </span>
                                        )}
                                        {job.job_type && (
                                            <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-violet-50 text-violet-700">
                                                {getJobTypeLabel(job.job_type)}
                                            </span>
                                        )}
                                        {job.experience_level && (
                                            <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-gray-100 text-gray-600">
                                                {job.experience_level} yrs
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Description preview */}
                                {job.description && (
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">
                                        {job.description}
                                    </p>
                                )}

                                {/* Posted time + Actions */}
                                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-2 gap-2">
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {timeAgo(job.created_at)}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 px-3 text-xs border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all"
                                            onClick={() => setSelectedJob(job)}
                                        >
                                            Details
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-8 px-3 text-xs bg-gray-900 text-white hover:bg-gray-800 transition-all"
                                            onClick={() => handleApplyClick(job.id)}
                                        >
                                            Apply
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Job Details Modal */}
            <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
                <DialogContent className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl border border-gray-200 shadow-2xl">
                    {selectedJob && (() => {
                        const job = selectedJob;
                        return (
                            <>
                                <div className="p-6 sm:p-8 space-y-5 max-h-[82vh] overflow-y-auto">
                                    <DialogHeader>
                                        <div className="flex items-start gap-4">
                                            <CompanyAvatar job={job} size="lg" />
                                            <div className="flex-1 min-w-0">
                                                <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight pr-6">
                                                    {job.title}
                                                </DialogTitle>
                                                <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
                                                    <Building2 className="w-4 h-4 flex-shrink-0" />
                                                    {job.company}
                                                </p>
                                            </div>
                                        </div>
                                    </DialogHeader>

                                    {/* Badges */}
                                    <div className="flex flex-wrap gap-2">
                                        {job.work_mode && (
                                            <span className={`text-xs px-3 py-1 rounded-md font-medium ${getWorkModeColor(job.work_mode)}`}>
                                                {job.work_mode.charAt(0).toUpperCase() + job.work_mode.slice(1)}
                                            </span>
                                        )}
                                        {job.job_type && (
                                            <span className="text-xs px-3 py-1 rounded-md font-medium bg-violet-50 text-violet-700">
                                                {getJobTypeLabel(job.job_type)}
                                            </span>
                                        )}
                                        {job.industry && (
                                            <span className="text-xs px-3 py-1 rounded-md font-medium bg-blue-50 text-blue-700">
                                                {job.industry.charAt(0).toUpperCase() + job.industry.slice(1)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Info Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {job.location && (
                                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                    <MapPin className="w-4 h-4 text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Location</p>
                                                    <p className="text-sm font-semibold text-gray-800">{job.location}</p>
                                                </div>
                                            </div>
                                        )}
                                        {job.experience_level && (
                                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                    <Briefcase className="w-4 h-4 text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Experience</p>
                                                    <p className="text-sm font-semibold text-gray-800">{job.experience_level} years</p>
                                                </div>
                                            </div>
                                        )}
                                        {(job.salary_min || job.salary_max) && (
                                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                    <DollarSign className="w-4 h-4 text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Salary</p>
                                                    <p className="text-sm font-semibold text-gray-800">
                                                        {job.salary_min && job.salary_max
                                                            ? `₹${job.salary_min.toLocaleString()} – ₹${job.salary_max.toLocaleString()}`
                                                            : job.salary_min
                                                                ? `From ₹${job.salary_min.toLocaleString()}`
                                                                : `Up to ₹${job.salary_max?.toLocaleString()}`}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {job.posted_by_user && (
                                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                    <Tag className="w-4 h-4 text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Posted By</p>
                                                    <p className="text-sm font-semibold text-gray-800">
                                                        {job.posted_by_user.alumni?.first_name 
                                                            ? `${job.posted_by_user.alumni.first_name} ${job.posted_by_user.alumni.last_name || ''}`.trim()
                                                            : job.posted_by_user.username}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Description */}
                                    {job.description && (
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Job Description</p>
                                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{job.description}</p>
                                        </div>
                                    )}

                                    {/* Requirements */}
                                    {job.requirements && (
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Requirements</p>
                                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{job.requirements}</p>
                                        </div>
                                    )}

                                    {/* Skills */}
                                    {job.skills && (
                                        <div>
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Key Skills</p>
                                            <div className="flex flex-wrap gap-2">
                                                {job.skills.split(/[,;]/).map((skill, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-3 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-200 font-medium"
                                                    >
                                                        {skill.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Contact / Links */}
                                    {(job.contact_email || job.application_url) && (
                                        <div className="border-t border-gray-100 pt-4 space-y-2">
                                            {job.contact_email && (
                                                <p className="text-sm flex items-center gap-2 text-gray-600">
                                                    <Mail className="w-4 h-4 text-gray-400" />
                                                    <a href={`mailto:${job.contact_email}`} className="text-gray-900 hover:underline font-medium">
                                                        {job.contact_email}
                                                    </a>
                                                </p>
                                            )}
                                            {job.application_url && (
                                                <p className="text-sm flex items-center gap-2 text-gray-600">
                                                    <Globe className="w-4 h-4 text-gray-400" />
                                                    <a
                                                        href={job.application_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-gray-900 hover:underline font-medium truncate"
                                                    >
                                                        Apply at company website
                                                    </a>
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
                                        <Button
                                            onClick={() => {
                                                setSelectedJob(null);
                                                handleApplyClick(job.id);
                                            }}
                                            className="flex-1 h-11 rounded-lg font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
                                        >
                                            {user ? "Apply for this Job" : "Login to Apply"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setSelectedJob(null)}
                                            className="flex-1 sm:flex-none h-11 rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm"
                                        >
                                            Close
                                        </Button>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </>
    );
};
