import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, User, Calendar, FileText, MapPin, Building2, Briefcase, Globe, Mail, DollarSign, Tag, Clock, Upload, X as XIcon } from "lucide-react";
import { getUserFriendlyError, logError, handleAPIError } from "@/utils/errorHandler";
import { validateRequired, validateTextLength, validateURL } from "@/utils/validation";
import { SkeletonJobCard } from "@/components/common/SkeletonLoader";
import { BackButton } from "@/components/common/BackButton";
import { supabase } from "@/lib/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWorkModeColor(mode?: string) {
  if (!mode) return "bg-gray-100 text-gray-600";
  const m = mode.toLowerCase();
  if (m === "remote") return "bg-emerald-100 text-emerald-700";
  if (m === "hybrid") return "bg-blue-100 text-blue-700";
  return "bg-orange-100 text-orange-700";
}
function getJobTypeLabel(type?: string) {
  if (!type) return "Full-time";
  return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const JobPortalPage = (): JSX.Element => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedWorkMode, setSelectedWorkMode] = useState("");
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Set page title
  React.useEffect(() => {
    document.title = "Job Portal - TKS Alumni Portal";
  }, []);

  // Job posting form state
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobType, setJobType] = useState("");
  const [industry, setIndustry] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [skills, setSkills] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobErrors, setJobErrors] = useState<Record<string, string>>({});

  // State for saved and applied jobs
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [selectedJobForApply, setSelectedJobForApply] = useState<any | null>(null);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'saved' | 'applied'>('all');
  const [savedJobsData, setSavedJobsData] = useState<any[]>([]);
  const [appliedJobsData, setAppliedJobsData] = useState<any[]>([]);
  // Job details popup
  const [selectedJobDetails, setSelectedJobDetails] = useState<any | null>(null);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);

  // Edit job state
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [selectedJobApplicants, setSelectedJobApplicants] = useState<any[]>([]);
  const [isApplicantsDialogOpen, setIsApplicantsDialogOpen] = useState(false);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [selectedJobForApplicants, setSelectedJobForApplicants] = useState<any | null>(null);

  // Dynamic filter options from database
  const [filterOptions, setFilterOptions] = useState<{
    locations: string[];
    jobTypes: string[];
    industries: string[];
    workModes: string[];
  }>({
    locations: [],
    jobTypes: [],
    industries: [],
    workModes: []
  });

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/jobs/filters');
      if (response.ok) {
        const data = await response.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  // Track if this is the initial mount to prevent double fetch
  const isInitialMount = React.useRef(true);

  useEffect(() => {
    fetchJobs();
    fetchSavedAndAppliedJobs();
    fetchFilterOptions();
    isInitialMount.current = false;
  }, [user]); // Re-fetch if user changes

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch('/api/jobs', {
        headers: {
          'user-id': userId || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Scroll to specific job if jobId is in URL query param, hash, or sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobIdFromQuery = params.get('jobId');
    const hash = window.location.hash;
    const jobIdFromHash = hash?.startsWith('#job-') ? hash.replace('#job-', '') : null;
    const jobIdFromStorage = sessionStorage.getItem('scrollToJobId');
    const jobId = jobIdFromQuery || jobIdFromHash || jobIdFromStorage;

    if (jobId && !loading && jobs.length > 0) {
      // Small timeout to ensure DOM is fully rendered
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`job-${jobId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the card briefly using the search-highlight class
          element.classList.add('search-highlight');
          setTimeout(() => {
            element.classList.remove('search-highlight');
          }, 2000);
        }
        // Clear sessionStorage
        if (jobIdFromStorage) {
          sessionStorage.removeItem('scrollToJobId');
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [loading, jobs.length]);

  const fetchSavedAndAppliedJobs = async () => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      if (!userId) return;

      const [savedResponse, appliedResponse] = await Promise.all([
        fetch('/api/jobs/saved', { headers: { 'user-id': userId } }),
        fetch('/api/jobs/my-applications', { headers: { 'user-id': userId } })
      ]);

      if (savedResponse.ok) {
        const savedData = await savedResponse.json();
        const jobIds = new Set<string>((savedData.savedJobs || []).map((s: any) => s.job_id));
        setSavedJobs(jobIds);
        setSavedJobsData(savedData.savedJobs || []);
      } else {
        console.error('Failed to fetch saved jobs');
      }

      if (appliedResponse.ok) {
        const appliedData = await appliedResponse.json();
        const jobIds = new Set<string>((appliedData.applications || []).map((a: any) => a.job_id));
        setAppliedJobs(jobIds);
        setAppliedJobsData(appliedData.applications || []);
      } else {
        console.error('Failed to fetch applied jobs');
      }
    } catch (error) {
      console.error('Error fetching saved/applied jobs:', error);
    }
  };

  const handlePostJob = async () => {
    // Validate required fields inline
    const errors: Record<string, string> = {};

    const titleValidation = validateRequired(jobTitle, 'Job Title');
    if (!titleValidation.isValid) errors.jobTitle = titleValidation.error || 'Job Title is required';

    const companyValidation = validateRequired(companyName, 'Company Name');
    if (!companyValidation.isValid) errors.companyName = companyValidation.error || 'Company Name is required';

    const descriptionValidation = validateTextLength(jobDescription, 'Job Description', 0, 10000);
    if (!descriptionValidation.isValid) errors.jobDescription = descriptionValidation.error || 'Job Description is too long';

    if (Object.keys(errors).length > 0) {
      setJobErrors(errors);
      return;
    }
    setJobErrors({});

    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          title: jobTitle.trim(),
          company: companyName.trim(),
          location: jobLocation.trim() || null,
          jobType: jobType || null,
          workMode: workMode || null,
          description: jobDescription.trim() || null,
          industry: industry || null,
          skills: skills.trim() || null,
          experienceLevel: yearsOfExperience || null,
        })
      });

      if (!response.ok) {
        const errorInfo = await handleAPIError(response);
        throw errorInfo;
      }

      toast({
        title: "Success",
        description: "Job posted successfully!",
      });

      // Reset form
      setJobTitle("");
      setJobLocation("");
      setJobType("");
      setIndustry("");
      setYearsOfExperience("");
      setWorkMode("");
      setSkills("");
      setJobDescription("");
      setCompanyName("");
      setJobErrors({});
      setIsJobDialogOpen(false);

      // Refresh jobs list and filter options
      fetchJobs();
      fetchFilterOptions();
    } catch (error) {
      logError(error, 'JobPortalPage.handlePostJob');
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    }
  };

  const applyFilters = async () => {
    try {
      setLoading(true);
      const userId = user?.id || localStorage.getItem('userId');
      const params = new URLSearchParams();

      if (searchTerm && searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedLocation && selectedLocation.trim()) params.append('location', selectedLocation.trim());
      if (selectedType && selectedType.trim()) params.append('jobType', selectedType.trim());
      if (selectedIndustry && selectedIndustry.trim()) params.append('industry', selectedIndustry.trim());
      if (selectedWorkMode && selectedWorkMode.trim() && selectedWorkMode !== '_all') params.append('workMode', selectedWorkMode.trim());

      const response = await fetch(`/api/jobs?${params.toString()}`, {
        headers: {
          'user-id': userId || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-search when filters change with debouncing
  useEffect(() => {
    // Skip the first render after initial mount to prevent double fetch
    if (isInitialMount.current) {
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      applyFilters();
    }, 300); // 300ms debounce delay

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedLocation, selectedType, selectedIndustry, selectedWorkMode]);

  // Display only real jobs from database, no demo/sample jobs
  const displayJobs = jobs;

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedLocation("");
    setSelectedType("");
    setSelectedIndustry("");
    setSelectedWorkMode("");
    // The useEffect will automatically trigger fetchJobs via applyFilters when state changes
  };

  const handleApplyJob = async () => {
    if (!selectedJobForApply) return;

    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch(`/api/jobs/${selectedJobForApply.id}/apply`, {
        method: 'POST',
        headers: {
          'user-id': userId || ''
        }
      });

      if (response.ok) {
        setAppliedJobs(prev => {
          const s = new Set<string>();
          prev.forEach((v: string) => s.add(v));
          s.add(selectedJobForApply.id);
          return s;
        });
        toast({
          title: "Success",
          description: "Application submitted successfully!",
        });
        setIsApplyDialogOpen(false);
        setSelectedJobForApply(null);

        // Refresh applied jobs data to show in the "applied" tab immediately
        fetchSavedAndAppliedJobs();
      } else {
        throw new Error('Failed to apply for job');
      }
    } catch (error) {
      console.error('Apply job error:', error);
      toast({
        title: "Error",
        description: "Failed to apply for job",
        variant: "destructive"
      });
    }
  };

  const handleEditJob = (job: any) => {
    setEditingJob(job);
    setJobTitle(job.title || '');
    setJobLocation(job.location || '');
    setJobType(job.job_type || '');
    setIndustry(job.industry || '');
    setYearsOfExperience(job.experience_level || '');
    setWorkMode(job.work_mode || '');
    setSkills(job.skills || '');
    setJobDescription(job.description || '');
    setCompanyName(job.company || '');
    setCompanyName(job.company || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdateJob = async () => {
    const errors: Record<string, string> = {};
    if (!jobTitle.trim()) errors.jobTitle = 'Job Title is required';
    if (!companyName.trim()) errors.companyName = 'Company Name is required';
    if (Object.keys(errors).length > 0) {
      setJobErrors(errors);
      return;
    }
    setJobErrors({});

    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch(`/api/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId || ''
        },
        body: JSON.stringify({
          title: jobTitle,
          company: companyName,
          location: jobLocation,
          jobType,
          workMode,
          description: jobDescription,
          industry: industry || null,
          skills: skills || null,
          experienceLevel: yearsOfExperience || null,
          isActive: true,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update job');
      }

      toast({
        title: "Success",
        description: "Job updated successfully!",
      });

      // Reset form
      setJobTitle("");
      setJobLocation("");
      setJobType("");
      setIndustry("");
      setYearsOfExperience("");
      setWorkMode("");
      setSkills("");
      setJobDescription("");
      setCompanyName("");
      setEditingJob(null);
      setIsEditDialogOpen(false);

      // Refresh jobs list and filter options
      fetchJobs();
      fetchFilterOptions();
    } catch (error) {
      console.error('Error updating job:', error);
      toast({
        title: "Error",
        description: "Failed to update job",
        variant: "destructive"
      });
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job posting?')) {
      return;
    }

    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'user-id': userId || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete job');
      }

      toast({
        title: "Success",
        description: "Job deleted successfully!",
      });

      // Refresh jobs list and filter options
      fetchJobs();
      fetchFilterOptions();
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive"
      });
    }
  };

  const handleViewApplicants = async (job: any) => {
    setSelectedJobForApplicants(job);
    setIsApplicantsDialogOpen(true);
    setLoadingApplicants(true);
    try {
      const userId = user?.id || localStorage.getItem('userId');
      const response = await fetch(`/api/jobs/${job.id}/applicants`, {
        headers: { 'user-id': userId || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedJobApplicants(data.applicants || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load applicants",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error loading applicants:", error);
    } finally {
      setLoadingApplicants(false);
    }
  };


  const handleViewDetails = (job: any) => {
    setSelectedJobDetails(job);
    setIsJobDetailsOpen(true);
  };

  return (
    <AppLayout currentPage="job-portal">
      <div className="p-2.5 sm:p-3 lg:p-4 max-w-[1400px] mx-auto">
        {/* Back Button */}
        <div className="mb-2 sm:mb-3 lg:hidden">
          <BackButton />
        </div>

{/* Post Job Section */}
        <Card className="mb-3 sm:mb-4 bg-gray-50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
              <span className="text-sm sm:text-base text-gray-700 text-center sm:text-left">Wish to hire your fellow Alumni ?</span>
              <Dialog open={isJobDialogOpen} onOpenChange={setIsJobDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="brand" className="w-full sm:w-auto px-4 sm:px-6 min-h-[38px] text-sm sm:text-base">
                    Post a Job Opening 💼
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">Post Job Details</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-6 mt-4">
                    {/* First Row - Job Title, Job Location, Job Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Job Title <span className="text-red-500">*</span></Label>
                        <Input
                          placeholder="Input clear job title"
                          value={jobTitle}
                          onChange={(e) => { setJobTitle(e.target.value); if (jobErrors.jobTitle) setJobErrors(p => ({ ...p, jobTitle: '' })); }}
                          className={`w-full min-h-[44px] ${jobErrors.jobTitle ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                        />
                        {jobErrors.jobTitle && <p className="text-xs text-red-600 flex items-center gap-1 mt-1">⚠ {jobErrors.jobTitle}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Job Location</Label>
                        <Input
                          placeholder="e.g. Mumbai, Remote"
                          value={jobLocation}
                          onChange={(e) => setJobLocation(e.target.value)}
                          className="w-full min-h-[44px]"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-sm font-medium">Job Type</Label>
                        <Select value={jobType} onValueChange={setJobType}>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Full Time" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full-time">Full Time</SelectItem>
                            <SelectItem value="part-time">Part Time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="internship">Internship</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Second Row - Select Industry, YOE */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Select Industry</Label>
                        <Select value={industry} onValueChange={setIndustry}>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Domain of work" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="technology">Technology</SelectItem>
                            <SelectItem value="healthcare">Healthcare</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="consulting">Consulting</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">YOE (if applicable)</Label>
                        <Select value={yearsOfExperience} onValueChange={setYearsOfExperience}>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="N/A" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0-1">0-1 years</SelectItem>
                            <SelectItem value="1-3">1-3 years</SelectItem>
                            <SelectItem value="3-5">3-5 years</SelectItem>
                            <SelectItem value="5+">5+ years</SelectItem>
                            <SelectItem value="na">N/A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Third Row - Work Mode, Skills */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Work Mode</Label>
                        <Select value={workMode} onValueChange={setWorkMode}>
                          <SelectTrigger className="min-h-[44px]">
                            <SelectValue placeholder="Remote" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="remote">Remote</SelectItem>
                            <SelectItem value="onsite">On-site</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Skills</Label>
                        <Input
                          placeholder="Add skills crucial for the job"
                          value={skills}
                          onChange={(e) => setSkills(e.target.value)}
                          className="w-full min-h-[44px]"
                        />
                      </div>
                    </div>

                    {/* Job Description */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Job Description</Label>
                      <div className={`border rounded-md ${jobErrors.jobDescription ? 'border-red-500' : ''}`}>
                        {/* Toolbar */}
                        <div className="flex items-center gap-2 p-2 border-b bg-gray-50 overflow-x-auto">
                          <button className="p-1 hover:bg-gray-200 rounded min-w-[30px] min-h-[30px]">
                            <span className="font-bold text-sm">B</span>
                          </button>
                          <button className="p-1 hover:bg-gray-200 rounded min-w-[30px] min-h-[30px]">
                            <span className="italic text-sm">I</span>
                          </button>
                          <button className="p-1 hover:bg-gray-200 rounded min-w-[30px] min-h-[30px]">
                            <span className="underline text-sm">U</span>
                          </button>
                          <button className="p-1 hover:bg-gray-200 rounded min-w-[30px] min-h-[30px]">
                            <span className="text-sm">•</span>
                          </button>
                          <button className="p-1 hover:bg-gray-200 rounded min-w-[30px] min-h-[30px]">
                            <span className="text-sm">1.</span>
                          </button>
                          <button className="p-1 hover:bg-gray-200 rounded min-w-[30px] min-h-[30px]">
                            <span className="text-sm">🔗</span>
                          </button>
                        </div>
                        <Textarea
                          placeholder="Add job description"
                          value={jobDescription}
                          onChange={(e) => { setJobDescription(e.target.value); if (jobErrors.jobDescription) setJobErrors(p => ({ ...p, jobDescription: '' })); }}
                          className="border-0 min-h-[120px] resize-none focus-visible:ring-0"
                        />
                      </div>
                      {jobErrors.jobDescription && <p className="text-xs text-red-600 flex items-center gap-1 mt-1">⚠ {jobErrors.jobDescription}</p>}
                    </div>

                    {/* Company Name */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Company Name <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="Input company name"
                        value={companyName}
                        onChange={(e) => { setCompanyName(e.target.value); if (jobErrors.companyName) setJobErrors(p => ({ ...p, companyName: '' })); }}
                        className={`w-full min-h-[44px] ${jobErrors.companyName ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      />
                      {jobErrors.companyName && <p className="text-xs text-red-600 flex items-center gap-1 mt-1">⚠ {jobErrors.companyName}</p>}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => { setIsJobDialogOpen(false); setJobErrors({}); }}
                        className="px-6 text-red-500 border-red-500 hover:bg-red-50 w-full sm:w-auto min-h-[44px]"
                      >
                        Cancel ✗
                      </Button>
                      <Button
                        onClick={handlePostJob}
                        variant="brand"
                        className="px-6 w-full sm:w-auto min-h-[44px]"
                      >
                        Post Job ✓
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Section with Tabs */}
        <div className="mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3 mb-3">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold">Jobs</h2>
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide snap-x snap-mandatory">
              <Button
                variant={activeTab === 'all' ? 'brand' : 'outline'}
                onClick={() => setActiveTab('all')}
                className="min-h-[38px] whitespace-nowrap text-sm sm:text-base snap-center"
                aria-pressed={activeTab === 'all'}
              >
                All Jobs
              </Button>
              <Button
                variant={activeTab === 'saved' ? 'brand' : 'outline'}
                onClick={() => setActiveTab('saved')}
                className="min-h-[38px] whitespace-nowrap text-sm sm:text-base snap-center"
                aria-pressed={activeTab === 'saved'}
              >
                Saved ({savedJobsData.length})
              </Button>
              <Button
                variant={activeTab === 'applied' ? 'brand' : 'outline'}
                onClick={() => setActiveTab('applied')}
                className="min-h-[38px] whitespace-nowrap text-sm sm:text-base snap-center"
                aria-pressed={activeTab === 'applied'}
              >
                Applied ({appliedJobsData.length})
              </Button>
            </div>
          </div>

          {/* Search and Filters - Only show for All Jobs tab */}
          {activeTab === 'all' && (
            <Card className="mb-3 sm:mb-4">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 w-full">
                  <Input
                    placeholder="Search Job by name"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyFilters();
                      }
                    }}
                    className="flex-1 min-h-[38px] text-sm sm:text-base w-full"
                    aria-label="Search jobs"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex gap-2 sm:gap-2.5 lg:gap-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide w-full lg:w-auto">
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger className="w-full lg:w-32 min-h-[38px] text-xs sm:text-sm" data-testid="select-location">
                        <SelectValue placeholder="Location" />
                      </SelectTrigger>
                      <SelectContent>
                        {filterOptions.locations.length > 0 ? (
                          filterOptions.locations.map((loc) => (
                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="_none" disabled>No locations</SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className="w-full lg:w-32 min-h-[44px] text-xs sm:text-sm" data-testid="select-job-type">
                        <SelectValue placeholder="Job Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {filterOptions.jobTypes.length > 0 ? (
                          filterOptions.jobTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="_none" disabled>No types</SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                      <SelectTrigger className="w-full lg:w-32 min-h-[44px] text-xs sm:text-sm" data-testid="select-industry">
                        <SelectValue placeholder="Industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {filterOptions.industries.length > 0 ? (
                          filterOptions.industries.map((ind) => (
                            <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="_none" disabled>No industries</SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    <Select value={selectedWorkMode} onValueChange={setSelectedWorkMode}>
                      <SelectTrigger className="w-full lg:w-32 min-h-[44px] text-xs sm:text-sm" data-testid="select-work-mode">
                        <SelectValue placeholder="Work Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All Modes</SelectItem>
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
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:flex w-full lg:w-auto">
                    <Button variant="outline" onClick={clearFilters} className="text-[#008060] border-[#008060] min-h-[38px] text-xs sm:text-sm w-full lg:w-auto">
                      Clear
                    </Button>
                    <Button
                      onClick={applyFilters}
                      variant="brand"
                      className="min-h-[38px] text-xs sm:text-sm w-full lg:w-auto"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job Listings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {loading ? (
              <div className="lg:col-span-2 xl:col-span-3 space-y-4">
                {[1, 2, 3].map((i) => (
                  <SkeletonJobCard key={i} />
                ))}
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#008060]"></div>
                  <p className="mt-2 text-gray-600">Loading jobs...</p>
                </div>
              </div>
            ) : activeTab === 'all' ? (
              displayJobs.length === 0 ? (
                <Card className="lg:col-span-2 xl:col-span-3 border-dashed border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/50">
                  <CardContent className="p-12 text-center">
                    <div className="max-w-md mx-auto space-y-6">
                      <div className="text-6xl mb-4">💼</div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">No jobs found</h3>
                        <p className="text-gray-600">Check back later or adjust your filters</p>
                      </div>
                      <div className="pt-4">
                        <Button
                          onClick={clearFilters}
                          variant="outline"
                          className="px-6"
                        >
                          Clear Filters
                        </Button>
                      </div>
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-500">
                          💡 <strong>Tip:</strong> Post a job opening to help fellow alumni find opportunities
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                displayJobs.map((job) => (
                  <Card key={job.id} id={`job-${job.id}`} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Company Avatar */}
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#008060] to-[#005c45] flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-base">{(job.company?.[0] || 'J').toUpperCase()}</span>
                          </div>
                        </div>

                        {/* Job Details */}
                        <div className="flex-1 min-w-0">
                          <div className="mb-2">
                            <h3 className="text-base sm:text-lg font-semibold text-[#008060] mb-0.5 truncate">{job.title || job.company}</h3>
                              <p className="text-xs sm:text-sm text-gray-600 mb-1.5">
                                Posted by {
                                  job.posted_by_user?.alumni?.first_name
                                    ? `${job.posted_by_user.alumni.first_name} ${job.posted_by_user.alumni.last_name || ''}`.trim()
                                    : job.posted_by_user?.username || job.postedBy || 'Unknown'
                                }
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mb-2">
                                <span className="whitespace-nowrap">{job.location || 'Remote'}</span>
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded whitespace-nowrap">
                                  {job.experience_level || job.type || 'All levels'}
                                </span>
                                <span className="whitespace-nowrap">{job.job_type || job.schedule || 'Full-time'} | {job.work_mode || 'On-site'}</span>
                              </div>
                            </div>

                          <div className="flex flex-wrap gap-2 mb-2">
                              {(() => {
                                const currentUserId = user?.id || localStorage.getItem('userId');
                                const isJobPoster = job.posted_by === currentUserId;

                                if (isJobPoster) {
                                  return (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewApplicants(job)}
                                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                      >
                                        View Applicants 👥
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEditJob(job)}
                                        className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                                      >
                                        Edit ✏️
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteJob(job.id)}
                                        className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                      >
                                        Delete 🗑️
                                      </Button>
                                    </div>
                                  );
                                }

                                return (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          const userId = user?.id || localStorage.getItem('userId');
                                          const response = await fetch(`/api/jobs/${job.id}/save`, {
                                            method: 'POST',
                                            headers: {
                                              'user-id': userId || ''
                                            }
                                          });

                                          if (response.ok) {
                                            const data = await response.json();
                                            if (data.saved) {
                                              setSavedJobs(prev => {
                                                const s = new Set<string>();
                                                prev.forEach((v: string) => s.add(v));
                                                s.add(job.id);
                                                return s;
                                              });
                                              toast({
                                                title: "Success",
                                                description: "Job saved successfully!",
                                              });
                                            } else {
                                              setSavedJobs(prev => {
                                                const newSet = new Set(prev);
                                                newSet.delete(job.id);
                                                return newSet;
                                              });
                                              toast({
                                                title: "Success",
                                                description: "Job removed from saved list",
                                              });
                                            }
                                          }
                                        } catch (error) {
                                          console.error('Save job error:', error);
                                          toast({
                                            title: "Error",
                                            description: "Failed to save job",
                                            variant: "destructive"
                                          });
                                        }
                                      }}
                                      variant={savedJobs.has(job.id) ? "brand" : "outline"}
                                      className={savedJobs.has(job.id) ? "" : "border-[#008060] text-[#008060] hover:bg-[#008060] hover:text-white"}
                                    >
                                      {savedJobs.has(job.id) ? "Saved ✓" : "Save Job 💾"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedJobForApply(job);
                                        setIsApplyDialogOpen(true);
                                      }}
                                      className={appliedJobs.has(job.id) ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}
                                      disabled={appliedJobs.has(job.id)}
                                    >
                                      {appliedJobs.has(job.id) ? "Applied ✓" : "Apply 📄"}
                                    </Button>
                                  </>
                                );
                              })()}
                            </div>

                          <div className="mb-2">
                            <p className="text-sm font-medium text-gray-900 mb-0.5">Job Description:</p>
                            <p className="text-sm text-gray-700 break-words line-clamp-3">{job.description || 'No description provided'}</p>
                          </div>

                          {job.skills && (
                            <div>
                              <p className="text-sm font-medium text-gray-900 mb-0.5">Key Skills:</p>
                              <p className="text-sm text-gray-700 break-words">{job.skills || job.keySkills}</p>
                            </div>
                          )}

                          {/* View Details Button */}
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-[#008060] text-[#008060] hover:bg-[#008060] hover:text-white transition-all"
                              onClick={() => handleViewDetails(job)}
                            >
                              View Full Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )
            ) : activeTab === 'saved' ? (
              savedJobsData.length === 0 ? (
                <div className="lg:col-span-2 xl:col-span-3 text-center py-8">
                  <p className="text-gray-600 mb-4">You haven't saved any jobs yet</p>
                  <Button onClick={() => setActiveTab('all')} className="bg-[#008060] hover:bg-[#007055]">
                    Browse Jobs
                  </Button>
                </div>
              ) : (
                savedJobsData.map((savedJob) => {
                  const job = savedJob.job;
                  return (
                    <Card key={job.id} id={`job-${job.id}`} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <img
                              src={job.company_logo || "/figmaAssets/group-5.png"}
                              alt="Company"
                              className="w-8 h-8 rounded-full"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-lg font-semibold text-[#008060] mb-1">{job.title}</h3>
                                <p className="text-sm text-gray-600 mb-2">
                                  Posted by {job.posted_by_user?.username || 'Unknown'}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                                  <span>{job.location || 'Remote'}</span>
                                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                    {job.experience_level || 'All levels'}
                                  </span>
                                  <span>{job.job_type || 'Full-time'} | {job.work_mode || 'On-site'}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const userId = user?.id || localStorage.getItem('userId');
                                      await fetch(`/api/jobs/${job.id}/save`, {
                                        method: 'POST',
                                        headers: { 'user-id': userId || '' }
                                      });
                                      toast({
                                        title: "Success",
                                        description: "Job removed from saved list",
                                      });
                                      fetchSavedAndAppliedJobs();
                                    } catch (error) {
                                      toast({
                                        title: "Error",
                                        description: "Failed to unsave job",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                  className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                >
                                  Unsave ✗
                                </Button>
                                <div className="flex gap-2">
                                  {(user?.id === job.posted_by || user?.id === job.postedBy) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewApplicants(job)}
                                      className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                    >
                                      Applicants 👥
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedJobForApply(job);
                                      setIsApplyDialogOpen(true);
                                    }}
                                    className={appliedJobs.has(job.id) ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}
                                    disabled={appliedJobs.has(job.id)}
                                  >
                                    {appliedJobs.has(job.id) ? "Applied ✓" : "Apply 📄"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-900 mb-1">Job Description:</p>
                              <p className="text-sm text-gray-700">{job.description || 'No description provided'}</p>
                            </div>
                            {job.skills && (
                              <div>
                                <p className="text-sm font-medium text-gray-900 mb-1">Key Skills:</p>
                                <p className="text-sm text-gray-700">{job.skills}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons for Poster */}
                        {(user?.id === job.posted_by || user?.id === job.postedBy) && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 flex items-center justify-center gap-2 border-[#008060] text-[#008060] hover:bg-[#f0f9f6]"
                              onClick={() => handleViewApplicants(job)}
                            >
                              <span className="text-sm">👥 View Applicants</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 flex items-center justify-center gap-2"
                              onClick={() => handleEditJob(job)}
                            >
                              <span className="text-sm">✏️ Edit</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => handleDeleteJob(job.id)}
                            >
                              <span className="text-sm">🗑️ Delete</span>
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )
            ) : (
              appliedJobsData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">You haven't applied to any jobs yet</p>
                  <Button onClick={() => setActiveTab('all')} className="bg-[#008060] hover:bg-[#007055]">
                    Browse Jobs
                  </Button>
                </div>
              ) : (
                appliedJobsData.map((application) => {
                  const job = application.job;
                  return (
                    <Card key={job.id} id={`job-${job.id}`} className="hover:shadow-md transition-shadow relative overflow-hidden">
                      <CardContent className="p-6">
                        <span className="absolute top-3 right-3 bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          Applied ✓
                        </span>
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <img
                              src={job.company_logo || "/figmaAssets/group-5.png"}
                              alt="Company"
                              className="w-8 h-8 rounded-full"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div className="pr-20">
                                <h3 className="text-lg font-semibold text-[#008060] mb-1">{job.title}</h3>
                                <p className="text-sm text-gray-600 mb-2">
                                  Posted by {job.posted_by_user?.username || 'Unknown'}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                                  <span>{job.location || 'Remote'}</span>
                                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                    {job.experience_level || 'All levels'}
                                  </span>
                                  <span>{job.job_type || 'Full-time'} | {job.work_mode || 'On-site'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-gray-700">Application Status:</span>
                                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full capitalize">
                                    {application.status || 'Applied'}
                                  </span>
                                  <span className="text-gray-500">
                                    Applied {new Date(application.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="mb-3">
                              <p className="text-sm font-medium text-gray-900 mb-1">Job Description:</p>
                              <p className="text-sm text-gray-700">{job.description || 'No description provided'}</p>
                            </div>
                            {job.skills && (
                              <div>
                                <p className="text-sm font-medium text-gray-900 mb-1">Key Skills:</p>
                                <p className="text-sm text-gray-700">{job.skills}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>

      {/* Applicants Dialog */}
      <Dialog open={isApplicantsDialogOpen} onOpenChange={setIsApplicantsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Applicants for {selectedJobForApplicants?.title}</span>
              <span className="text-sm font-normal text-muted-foreground">({selectedJobApplicants.length})</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 mt-4">
            {loadingApplicants ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-[#008060] border-t-transparent rounded-full" />
              </div>
            ) : selectedJobApplicants.length > 0 ? (
              <div className="space-y-4">
                {selectedJobApplicants.map((applicant: any) => {
                  const applicantUserId = applicant.user_id || applicant.user?.id;
                  const applicantName = applicant.profile
                    ? `${applicant.profile.first_name || ''} ${applicant.profile.last_name || ''}`.trim()
                    : applicant.user?.username || 'Unknown User';
                  const applicantInitials = applicant.profile?.first_name?.[0] || applicant.user?.username?.[0] || '?';
                  const applicantRole = applicant.profile?.current_role || applicant.profile?.current_position || 'N/A';
                  const applicantCompany = applicant.profile?.current_company || 'N/A';
                  const applicantBatch = applicant.profile?.batch || applicant.profile?.graduation_year || 'N/A';
                  const appliedDate = new Date(applicant.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
                  const profilePicture = applicant.profile?.profile_picture || applicant.profile?.linkedin_photo_url;

                  return (
                    <Card key={applicant.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <Avatar className="h-14 w-14 border-2 border-[#008060]/20">
                              <AvatarImage src={profilePicture} alt={applicantName} />
                              <AvatarFallback className="bg-[#008060]/10 text-[#008060] font-semibold text-lg">
                                {applicantInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 text-lg mb-1">
                                {applicantName}
                              </h4>
                              <p className="text-sm text-gray-600 mb-2">
                                {applicantRole} {applicantCompany !== 'N/A' && `at ${applicantCompany}`}
                              </p>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                                  Batch {applicantBatch}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Applied on {appliedDate}
                                </span>
                                {applicant.status && (
                                  <span className={`text-xs px-2 py-1 rounded font-medium ${applicant.status === 'shortlisted' ? 'bg-green-100 text-green-700' :
                                    applicant.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                    {applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)}
                                  </span>
                                )}
                              </div>
                              {applicant.profile?.email && (
                                <p className="text-xs text-gray-500 mt-2">
                                  📧 {applicant.profile.email}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 border-[#008060] text-[#008060] hover:bg-[#008060] hover:text-white"
                              onClick={() => {
                                if (applicantUserId) {
                                  setLocation(`/profile/${applicantUserId}`);
                                  setIsApplicantsDialogOpen(false);
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Unable to view profile - user ID not found",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              <User className="w-4 h-4" />
                              <span>View Profile</span>
                            </Button>
                            {applicant.profile?.resume_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                                onClick={() => {
                                  window.open(applicant.profile.resume_url, '_blank');
                                }}
                              >
                                <FileText className="w-4 h-4" />
                                <span>Resume</span>
                              </Button>
                            )}
                            <Button
                              variant="brand"
                              size="sm"
                              className="flex items-center gap-2"
                              onClick={() => {
                                if (applicantUserId) {
                                  setLocation(`/inbox?user=${applicantUserId}`);
                                  setIsApplicantsDialogOpen(false);
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Unable to message - user ID not found",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              <MessageSquare className="w-4 h-4" />
                              <span>Message</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-gray-600 font-medium mb-2">No applications received yet</p>
                <p className="text-sm text-gray-500">Applications will appear here when candidates apply to your job posting.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
        setIsEditDialogOpen(isOpen);
        if (!isOpen) {
          setEditingJob(null);
          setJobErrors({});
          // Reset form
          setJobTitle("");
          setJobLocation("");
          setJobType("");
          setIndustry("");
          setYearsOfExperience("");
          setWorkMode("");
          setSkills("");
          setJobDescription("");
          setCompanyName("");
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Job Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* First Row - Job Title, Job Location, Job Type */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Job Title <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Input clear job title"
                  value={jobTitle}
                  onChange={(e) => { setJobTitle(e.target.value); if (jobErrors.jobTitle) setJobErrors(p => ({ ...p, jobTitle: '' })); }}
                  className={`w-full ${jobErrors.jobTitle ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {jobErrors.jobTitle && <p className="text-xs text-red-600 flex items-center gap-1 mt-1">⚠ {jobErrors.jobTitle}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Job Location</Label>
                <Input
                  placeholder="e.g. Mumbai, Remote"
                  value={jobLocation}
                  onChange={(e) => setJobLocation(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Job Type</Label>
                <Select value={jobType} onValueChange={setJobType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Full Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full Time</SelectItem>
                    <SelectItem value="part-time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second Row - Select Industry, YOE */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Domain of work" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">YOE (if applicable)</Label>
                <Select value={yearsOfExperience} onValueChange={setYearsOfExperience}>
                  <SelectTrigger>
                    <SelectValue placeholder="N/A" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-1">0-1 years</SelectItem>
                    <SelectItem value="1-3">1-3 years</SelectItem>
                    <SelectItem value="3-5">3-5 years</SelectItem>
                    <SelectItem value="5+">5+ years</SelectItem>
                    <SelectItem value="na">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Third Row - Work Mode, Skills */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Work Mode</Label>
                <Select value={workMode} onValueChange={setWorkMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Remote" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="onsite">On-site</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Skills</Label>
                <Input
                  placeholder="Add skills crucial for the job"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Job Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Job Description</Label>
              <Textarea
                placeholder="Add job description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="min-h-[120px]"
              />
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Company Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Input company name"
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); if (jobErrors.companyName) setJobErrors(p => ({ ...p, companyName: '' })); }}
                className={`w-full ${jobErrors.companyName ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {jobErrors.companyName && <p className="text-xs text-red-600 flex items-center gap-1 mt-1">⚠ {jobErrors.companyName}</p>}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => { setIsEditDialogOpen(false); setJobErrors({}); }}
                className="px-6 text-red-500 border-red-500 hover:bg-red-50"
              >
                Cancel ✗
              </Button>
              <Button
                onClick={handleUpdateJob}
                variant="brand"
                className="px-6"
              >
                Update Job ✓
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Job Dialog */}
      <Dialog open={isApplyDialogOpen} onOpenChange={(isOpen) => {
        setIsApplyDialogOpen(isOpen);
        if (!isOpen) setSelectedJobForApply(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Apply for {selectedJobForApply?.title || 'Job'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p>Are you sure you want to apply for this position?</p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsApplyDialogOpen(false)}
                className="px-6 text-red-500 border-red-500 hover:bg-red-50"
              >
                Cancel ✗
              </Button>
              <Button
                onClick={handleApplyJob}
                className="px-6 bg-blue-500 hover:bg-blue-600 text-white"
              >
                Apply ✓
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ── Job Details Dialog ────────────────────────────────────────────── */}
      <Dialog open={isJobDetailsOpen} onOpenChange={(open) => { setIsJobDetailsOpen(open); if (!open) setSelectedJobDetails(null); }}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full !block !gap-0 !p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {selectedJobDetails && (() => {
            const job = selectedJobDetails;
            const isOwner = job.posted_by === (user?.id || localStorage.getItem('userId'));
            const isApplied = appliedJobs.has(job.id);
            return (
              <>
                <div className="h-2 w-full bg-gradient-to-r from-[#008060] via-emerald-400 to-[#005c45]" />
                <div className="p-6 sm:p-8 space-y-5 max-h-[82vh] overflow-y-auto">
                  <DialogHeader>
                    <div className="flex items-start gap-4">
                      {/* Company Avatar */}
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#008060] to-[#005c45] flex items-center justify-center shadow-md flex-shrink-0">
                        <span className="text-white font-bold text-xl">{job.company?.[0]?.toUpperCase() || 'J'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="text-xl sm:text-2xl font-bold text-[#008060] leading-tight pr-6">
                          {job.title}
                        </DialogTitle>
                        <p className="text-gray-600 text-sm mt-1 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 flex-shrink-0" />
                          {job.company}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Posted by {
                            job.posted_by_user?.alumni?.first_name 
                              ? `${job.posted_by_user.alumni.first_name} ${job.posted_by_user.alumni.last_name || ''}`.trim()
                              : job.posted_by_user?.username || 'Unknown'
                          }
                        </p>
                      </div>
                    </div>
                  </DialogHeader>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {job.work_mode && (
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getWorkModeColor(job.work_mode)}`}>
                        {job.work_mode.charAt(0).toUpperCase() + job.work_mode.slice(1)}
                      </span>
                    )}
                    {job.job_type && (
                      <span className="text-xs px-3 py-1 rounded-full font-semibold bg-purple-100 text-purple-700">
                        {getJobTypeLabel(job.job_type)}
                      </span>
                    )}
                    {job.industry && (
                      <span className="text-xs px-3 py-1 rounded-full font-semibold bg-blue-100 text-blue-700">
                        {job.industry.charAt(0).toUpperCase() + job.industry.slice(1)}
                      </span>
                    )}
                    {job.experience_level && (
                      <span className="text-xs px-3 py-1 rounded-full font-semibold bg-amber-100 text-amber-700">
                        {job.experience_level} yrs exp
                      </span>
                    )}
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {job.location && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-rose-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Location</p>
                          <p className="text-sm font-semibold text-gray-800 break-words">{job.location}</p>
                        </div>
                      </div>
                    )}
                    {(job.salary_min || job.salary_max) && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                          <DollarSign className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Salary</p>
                          <p className="text-sm font-semibold text-gray-800 break-words">
                            {job.salary_min && job.salary_max
                              ? `₹${Number(job.salary_min).toLocaleString()} – ₹${Number(job.salary_max).toLocaleString()}`
                              : job.salary_min ? `From ₹${Number(job.salary_min).toLocaleString()}`
                                : `Up to ₹${Number(job.salary_max).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {job.description && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Job Description</p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line break-words">{job.description}</p>
                    </div>
                  )}

                  {/* Requirements */}
                  {job.requirements && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Requirements</p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line break-words">{job.requirements}</p>
                    </div>
                  )}

                  {/* Skills */}
                  {job.skills && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {job.skills.split(/[,;]/).map((skill: string, i: number) => (
                          <span key={i} className="px-3 py-1 text-xs rounded-full bg-[#008060]/10 text-[#008060] border border-[#008060]/20 font-medium">
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
                          <Mail className="w-4 h-4 text-[#008060]" />
                          <a href={`mailto:${job.contact_email}`} className="text-[#008060] hover:underline font-medium">{job.contact_email}</a>
                        </p>
                      )}
                      {job.application_url && (
                        <p className="text-sm flex items-center gap-2 text-gray-600">
                          <Globe className="w-4 h-4 text-[#008060]" />
                          <a href={job.application_url} target="_blank" rel="noopener noreferrer" className="text-[#008060] hover:underline font-medium break-all">
                            Apply at company website
                          </a>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
                    {!isOwner && (
                      <Button
                        className="flex-1 h-12 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#008060] to-[#005c45] hover:from-[#006b51] hover:to-[#004d3a] text-white shadow-md hover:shadow-lg transition-all"
                        disabled={isApplied}
                        onClick={() => {
                          setIsJobDetailsOpen(false);
                          setSelectedJobDetails(null);
                          setSelectedJobForApply(job);
                          setIsApplyDialogOpen(true);
                        }}
                      >
                        {isApplied ? 'Already Applied ✓' : 'Apply for this Job'}
                      </Button>
                    )}
                    {isOwner && (
                      <Button
                        variant="outline"
                        className="flex-1 h-12 rounded-xl border-[#008060] text-[#008060] hover:bg-[#008060] hover:text-white"
                        onClick={() => {
                          setIsJobDetailsOpen(false);
                          handleEditJob(job);
                        }}
                      >
                        Edit Job
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => { setIsJobDetailsOpen(false); setSelectedJobDetails(null); }}
                      className="flex-1 sm:flex-none h-12 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm"
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

    </AppLayout>
  );
};
