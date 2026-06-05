
import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { formatDateTimeIST } from "@/lib/dateUtils";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Briefcase,
  Trash2,
  Eye,
  MapPin,
  Building2,
  Calendar,
  MoreHorizontal,
  ArrowLeft,
  Download,
  Filter,
  Search,
  Clock,
  DollarSign,
  Users,
  ExternalLink,
  Bell,
  LogOut,
} from "lucide-react";

export const AdminJobsPage = (): JSX.Element => {
  const { user, adminUser, logoutAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [workModeFilter, setWorkModeFilter] = useState("");
  const [filterOptions, setFilterOptions] = useState({
    locations: [] as string[],
    workModes: [] as string[],
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    jobId: string;
    jobTitle: string;
  }>({
    open: false,
    jobId: "",
    jobTitle: "",
  });

  const [viewJobDialog, setViewJobDialog] = useState<{
    open: boolean;
    job: any | null;
  }>({
    open: false,
    job: null,
  });

  // Set page title
  React.useEffect(() => {
    document.title = "Jobs Management - Admin Portal";
  }, []);

  // Fetch all jobs
  useEffect(() => {
    fetchJobs();
    fetchFilterOptions();
  }, [adminUser]);

  // Fetch filter options from database
  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/jobs/filters', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFilterOptions({
          locations: data.locations || [],
          workModes: data.workModes || [],
        });
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const userId = adminUser?.id;

      // Fetch all jobs without filters initially
      const response = await fetch("/api/jobs?limit=1000", {
        headers: {
          "user-id": userId || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch jobs");
      }

      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-search when filters change with debouncing
  useEffect(() => {
    // Skip initial render to prevent double fetch
    if (!jobs.length && !searchTerm && !locationFilter && !typeFilter && !workModeFilter) {
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      // The filtering happens automatically via filteredJobs
    }, 300); // 300ms debounce delay

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, locationFilter, typeFilter, workModeFilter]);

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.posted_by_user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.posted_by_user?.alumni?.first_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.posted_by_user?.alumni?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesLocation =
      !locationFilter || job.location?.toLowerCase().includes(locationFilter.toLowerCase());

    const matchesType = !typeFilter || job.job_type === typeFilter;

    const matchesWorkMode = !workModeFilter || job.work_mode === workModeFilter;

    return matchesSearch && matchesLocation && matchesType && matchesWorkMode;
  });

  // Handle delete job
  const handleDeleteJob = async () => {
    const { jobId } = deleteDialog;

    try {
      const userId = adminUser?.id;
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          "user-id": userId || "",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete job");
      }

      toast({
        title: "Success",
        description: "Job deleted successfully",
      });

      // Remove from local state
      setJobs(jobs.filter((j) => j.id !== jobId));
      setDeleteDialog({ open: false, jobId: "", jobTitle: "" });
    } catch (error) {
      console.error("Delete job error:", error);
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive",
      });
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setLocationFilter("");
    setTypeFilter("");
    setWorkModeFilter("");
  };

  // Export jobs to CSV
  const exportJobsToCSV = () => {
    const headers = [
      "Job Title",
      "Company",
      "Posted By",
      "Email",
      "Location",
      "Type",
      "Work Mode",
      "Experience Level",
      "Salary Range",
      "Description",
      "Requirements",
      "Skills",
      "Industry",
      "Application URL",
      "Contact Email",
      "Posted On",
      "Application Deadline"
    ];

    const csvData = filteredJobs.map((job) => [
      job.title || "",
      job.company || "",
      job.posted_by_user?.alumni?.first_name 
        ? `${job.posted_by_user.alumni.first_name} ${job.posted_by_user.alumni.last_name || ''}`.trim()
        : job.posted_by_user?.username || "",
      job.posted_by_user?.email || "",
      job.location || "",
      job.job_type || "",
      job.work_mode || "",
      job.experience_level || "",
      job.salary_min && job.salary_max ? `₹${job.salary_min} - ₹${job.salary_max}` : "",
      (job.description || "").replace(/"/g, '""'),
      (job.requirements || "").replace(/"/g, '""'),
      job.skills || "",
      job.industry || "",
      job.application_url || "",
      job.contact_email || "",
      formatDateTimeIST(job.created_at),
      job.application_deadline ? formatDateTimeIST(job.application_deadline) : ""
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobs_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredJobs.length} jobs to CSV`,
    });
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Shared Admin Sidebar */}
      <AdminSidebar currentPage="jobs" />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 sticky top-0 z-40 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setLocation("/admin/dashboard")}
                className="hover:bg-gray-100"
                aria-label="Back to Dashboard"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900">Jobs</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative z-[70]">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative min-w-[44px] min-h-[44px] rounded-full transition-colors ${
                    unreadCount > 0
                      ? "text-[#008060] hover:bg-[#008060]/10 hover:text-[#006b51] ring-2 ring-[#008060]/30"
                      : "text-gray-600 hover:text-[#008060] hover:bg-gray-100"
                  }`}
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                >
                  <Bell className="w-5 h-5" strokeWidth={2} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>

                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
              </div>
              <Button
                variant="outline"
                className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                onClick={() => {
                  logoutAdmin();
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{adminUser?.username || 'Admin'}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold">{adminUser?.username?.charAt(0).toUpperCase() || 'A'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 bg-gray-50/50 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Jobs Management</h1>
                <p className="text-sm text-gray-500 mt-1">View and manage all job postings on the platform</p>
              </div>
              <Button
                onClick={exportJobsToCSV}
                disabled={filteredJobs.length === 0}
                className="bg-[#008060] hover:bg-[#006b51] text-white shadow-sm hover:shadow-md transition-all rounded-lg px-4"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: "Total Jobs",
                  value: jobs.length,
                  icon: Briefcase,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                  onClick: () => clearFilters()
                },
                {
                  title: "Active",
                  value: jobs.filter(j => j.is_active !== false).length,
                  icon: Clock,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                  onClick: () => {
                    setSearchTerm("");
                    setLocationFilter("");
                    setTypeFilter("");
                    setWorkModeFilter("");
                    // Note: Active filter would need backend support or client-side filtering
                  }
                },
                {
                  title: "Remote",
                  value: jobs.filter(j => j.work_mode?.toLowerCase() === 'remote').length,
                  icon: MapPin,
                  color: "text-purple-600",
                  bg: "bg-purple-50",
                  onClick: () => {
                    setSearchTerm("");
                    setLocationFilter("");
                    setTypeFilter("");
                    setWorkModeFilter("remote");
                  }
                },
                {
                  title: "Companies",
                  value: new Set(jobs.map(j => j.company)).size,
                  icon: Building2,
                  color: "text-orange-600",
                  bg: "bg-orange-50",
                  onClick: () => clearFilters()
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  onClick={stat.onClick}
                  className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between hover:shadow-md hover:border-[#008060] transition-all cursor-pointer group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-500 group-hover:text-[#008060] transition-colors">{stat.title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1 group-hover:text-[#008060] transition-colors">{stat.value}</h3>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bg} group-hover:bg-[#008060]/10 transition-colors`}>
                    <stat.icon className={`w-5 h-5 ${stat.color} group-hover:text-[#008060] transition-colors`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by title, company, or poster..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-gray-200 focus:border-[#008060] focus:ring-[#008060]/20 rounded-lg"
                    />
                  </div>
                  <Select value={locationFilter || "all"} onValueChange={(value) => setLocationFilter(value === "all" ? "" : value)}>
                    <SelectTrigger className="w-full sm:w-40 border-gray-200">
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {filterOptions.locations.length > 0 ? (
                        filterOptions.locations.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_none" disabled>No locations</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter || "all"} onValueChange={(value) => setTypeFilter(value === "all" ? "" : value)}>
                    <SelectTrigger className="w-full sm:w-40 border-gray-200">
                      <SelectValue placeholder="Job Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="full-time">Full Time</SelectItem>
                      <SelectItem value="part-time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={workModeFilter || "all"} onValueChange={(value) => setWorkModeFilter(value === "all" ? "" : value)}>
                    <SelectTrigger className="w-full sm:w-40 border-gray-200">
                      <SelectValue placeholder="Work Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modes</SelectItem>
                      {filterOptions.workModes.length > 0 ? (
                        filterOptions.workModes.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode === 'remote' ? 'Remote' : mode === 'onsite' ? 'On-site' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="onsite">On-site</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={clearFilters} className="border-gray-200">
                    <Filter className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} found
                  </span>
                </div>
              </div>
            </div>

            {/* Jobs Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ring-1 ring-gray-100">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#008060]/10 mb-4">
                    <div className="w-6 h-6 border-2 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-600 font-medium">Loading jobs...</p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                    <Briefcase className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No jobs found</h3>
                  <p className="text-gray-500 mt-1">Try adjusting your search terms or filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <Table className="w-full">
                    <TableHeader className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                      <TableRow className="border-b border-gray-200 hover:bg-transparent">
                        <TableHead className="w-[250px] pl-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Job Details</TableHead>
                        <TableHead className="w-[200px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Company</TableHead>
                        <TableHead className="w-[180px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Posted By</TableHead>
                        <TableHead className="w-[150px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Location</TableHead>
                        <TableHead className="w-[120px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Type</TableHead>
                        <TableHead className="w-[120px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Posted On</TableHead>
                        <TableHead className="w-[80px] py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-end pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJobs.map((job) => (
                        <TableRow
                          key={job.id}
                          className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0 cursor-pointer"
                          onClick={() => setViewJobDialog({ open: true, job })}
                        >
                          <TableCell className="pl-6 py-4 align-top">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900 line-clamp-1" title={job.title}>{job.title}</span>
                              {job.salary_range && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-fit mt-1.5 inline-flex items-center">
                                  <DollarSign className="w-3 h-3 mr-1" />
                                  {job.salary_range}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 align-top">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="line-clamp-1">{job.company}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 align-top">
                            <div className="text-sm">
                              <p className="font-medium text-gray-900 line-clamp-1">
                                {job.posted_by_user?.alumni?.first_name 
                                  ? `${job.posted_by_user.alumni.first_name} ${job.posted_by_user.alumni.last_name || ''}`.trim()
                                  : job.posted_by_user?.username || "Unknown"}
                              </p>
                              <p className="text-gray-500 text-xs line-clamp-1">
                                {job.posted_by_user?.email || ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 align-top">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="line-clamp-1">{job.location || "Not specified"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 align-top">
                            <Badge variant="outline" className="capitalize text-xs">
                              {job.job_type || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 align-top">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span>{new Date(job.created_at).toLocaleDateString()}</span>
                            </div>
                          </TableCell>
                          <TableCell className="pr-6 py-4 align-top text-end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg text-gray-500">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-200 shadow-lg rounded-xl">
                                <DropdownMenuItem onClick={() => setViewJobDialog({ open: true, job })} className="cursor-pointer text-gray-700 focus:bg-gray-50">
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeleteDialog({ open: true, jobId: job.id, jobTitle: job.title })} className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700">
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete Job
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Job Details Dialog */}
      <Dialog
        open={viewJobDialog.open}
        onOpenChange={(open) =>
          setViewJobDialog({ ...viewJobDialog, open })
        }
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#008060]">
              Job Details
            </DialogTitle>
          </DialogHeader>
          {viewJobDialog.job && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-8 h-8 text-[#008060]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {viewJobDialog.job.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 font-medium">
                      {viewJobDialog.job.company}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-gray-900 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {viewJobDialog.job.location || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Job Type</p>
                  <p className="font-medium text-gray-900 capitalize">
                    {viewJobDialog.job.job_type || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Work Mode</p>
                  <p className="font-medium text-gray-900 capitalize">
                    {viewJobDialog.job.work_mode || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Experience Level</p>
                  <p className="font-medium text-gray-900 capitalize">
                    {viewJobDialog.job.experience_level || "N/A"}
                  </p>
                </div>
                {viewJobDialog.job.salary_min && viewJobDialog.job.salary_max && (
                  <div>
                    <p className="text-sm text-gray-500">Salary Range</p>
                    <p className="font-medium text-gray-900">
                      ₹{viewJobDialog.job.salary_min} - ₹{viewJobDialog.job.salary_max}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Posted On</p>
                  <p className="font-medium text-gray-900 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(viewJobDialog.job.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Posted By</h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">
                    {viewJobDialog.job.posted_by_user?.alumni?.first_name 
                      ? `${viewJobDialog.job.posted_by_user.alumni.first_name} ${viewJobDialog.job.posted_by_user.alumni.last_name || ''}`.trim()
                      : viewJobDialog.job.posted_by_user?.username || "Unknown"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {viewJobDialog.job.posted_by_user?.email || ""}
                  </p>
                </div>
              </div>

              {viewJobDialog.job.description && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Job Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {viewJobDialog.job.description}
                  </p>
                </div>
              )}

              {viewJobDialog.job.requirements && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Requirements</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {viewJobDialog.job.requirements}
                  </p>
                </div>
              )}

              {viewJobDialog.job.skills && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Required Skills</h3>
                  <p className="text-gray-700">{viewJobDialog.job.skills}</p>
                </div>
              )}

              {viewJobDialog.job.industry && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Industry</h3>
                  <Badge variant="outline" className="text-sm">
                    {viewJobDialog.job.industry}
                  </Badge>
                </div>
              )}

              {viewJobDialog.job.application_deadline && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Application Deadline</h3>
                  <p className="text-gray-700">
                    {new Date(viewJobDialog.job.application_deadline).toLocaleDateString()}
                  </p>
                </div>
              )}

              {viewJobDialog.job.application_url && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Application URL</h3>
                  <a
                    href={viewJobDialog.job.application_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#008060] hover:underline flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {viewJobDialog.job.application_url}
                  </a>
                </div>
              )}

              {viewJobDialog.job.contact_email && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Contact Email</h3>
                  <a
                    href={`mailto:${viewJobDialog.job.contact_email}`}
                    className="text-[#008060] hover:underline"
                  >
                    {viewJobDialog.job.contact_email}
                  </a>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewJobDialog({ open: false, job: null })}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({ ...deleteDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job Posting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.jobTitle}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteDialog({ open: false, jobId: "", jobTitle: "" })
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteJob}
            >
              Delete Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
