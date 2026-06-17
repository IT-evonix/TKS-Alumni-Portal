import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip as UITooltip,
  TooltipContent as UITooltipContent,
  TooltipProvider as UITooltipProvider,
  TooltipTrigger as UITooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
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
import { Switch } from "@/components/ui/switch";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getGraduationYearOptions, MIN_GRADUATION_YEAR } from "@/constants/graduationYear";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  UserPlus,
  Calendar,
  Briefcase,
  MessageSquare,
  Activity,
  Home,
  Bell,
  LogOut,
} from "lucide-react";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { ChartInfoButton } from "@/components/admin/ChartInfoButton";
import { AdminStatsCards } from "@/components/admin/AdminStatsCards";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { formatDateTimeIST } from "@/lib/dateUtils";
import { parsePhoneNumber, validatePhoneNumber } from "@/utils/phoneValidation";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";

export const AdminDashboard = (): JSX.Element => {
  const { user, adminUser, logoutAdmin } = useAuth();
  const { unreadCount, fetchNotifications } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const activeView = location.includes("/admin/analytics") ? "analytics" :
    (location.includes("/admin/users") || location.includes("/admin/signup-requests")) ? "users" : "overview";
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Set page title
  React.useEffect(() => {
    document.title = "Admin Dashboard - TKS Alumni Portal";
  }, []);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [updatingParams, setUpdatingParams] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const RECORDS_PER_PAGE = 50;

  const [editingCell, setEditingCell] = useState<{
    userId: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    field: string;
    oldValue: any;
    newValue: any;
  }>({
    open: false,
    userId: "",
    field: "",
    oldValue: "",
    newValue: "",
  });
  const [createAlumniDialog, setCreateAlumniDialog] = useState(false);
  const [createAlumniForm, setCreateAlumniForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    graduationYear: "",
    batch: "",
    course: "",
    branch: "",
  });
  const [creatingAlumni, setCreatingAlumni] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [emailConfirmDialog, setEmailConfirmDialog] = useState(false);
  const [emailContent, setEmailContent] = useState("");
  const [tempCredentials, setTempCredentials] = useState({
    email: "",
    password: "",
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [blockDialog, setBlockDialog] = useState<{
    open: boolean;
    userId: string;
    username: string;
    currentlyBlocked: boolean;
  }>({
    open: false,
    userId: "",
    username: "",
    currentlyBlocked: false,
  });
  const [signupRequests, setSignupRequests] = useState<any[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [analytics, setAnalytics] = useState<any>({
    userGrowth: [],
    roleDistribution: [],
    batchDistribution: [],
    activityMetrics: null,
    engagementData: [],
    profileStats: null,
    profileCompletionData: [],
    totalUsers: 0
  });
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [actView, setActView] = useState<"active" | "new">("active");

  const analyticsContentRef = useRef<HTMLDivElement>(null);
  const totalUsersForDashboard = analytics.totalUsers || totalCount || users.length;

  // 1. Fetch Users logic (Paginated/Server-side)
  const fetchUsers = async () => {
    const page = currentPage;
    setLoading(true);
    try {
      const adminId = adminUser?.id;
      if (!adminId) return;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: RECORDS_PER_PAGE.toString(),
        search: searchTerm,
        role: roleFilter,
        adminStatus: adminFilter,
        batch: batchFilter
      });

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          "user-id": adminId,
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setLocation("/");
          return;
        }
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users);
      setTotalCount(data.totalCount);
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Error",
        description: "Failed to load users data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Analytics logic (Server-side)
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch("/api/admin/analytics", {
        headers: {
          "user-id": adminUser?.id || "",
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
      });

      if (!response.ok) throw new Error("Failed to fetch analytics");
      const data = await response.json();

      // Combine with profile stats if already available
      let profileStatsData = analytics.profileStats;
      if (!profileStatsData) {
        const statsRes = await fetch("/api/admin/profile-stats", {
          headers: {
            "user-id": adminUser?.id || "",
            "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`
          },
        });
        if (statsRes.ok) {
          profileStatsData = await statsRes.json();
        }
      }

      const ROLE_COLORS: Record<string, string> = {
        alumni:        "#008060",
        administrator: "#6366f1",
        faculty:       "#f59e0b",
        student:       "#3b82f6",
        unassigned:    "#94a3b8",
      };
      const coloredRoleDistribution = (data.roleDistribution || []).map((entry: any) => ({
        ...entry,
        fill: ROLE_COLORS[entry.name?.toLowerCase()] || "#94a3b8",
      }));

      setAnalytics({
        ...data,
        roleDistribution: coloredRoleDistribution,
        profileStats: profileStatsData,
        engagementData: [
          { name: "Active", value: data.activityMetrics?.activeMonth ?? 0, fill: "#008060" },
          { name: "Inactive", value: (data.totalUsers ?? 0) - (data.activityMetrics?.activeMonth ?? 0), fill: "#e5e7eb" },
        ],
        profileCompletionData: profileStatsData ? [
          { name: "Complete (100%)", value: profileStatsData.complete, fill: "#22c55e" },
          { name: "Partial (50-99%)", value: profileStatsData.partial, fill: "#f59e0b" },
          { name: "Incomplete (<50%)", value: profileStatsData.incomplete, fill: "#ef4444" },
        ] : []
      });
    } catch (error) {
      console.error("Analytics fetch error:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Consolidated fetch effect for all filters and pagination
  useEffect(() => {
    const timer = setTimeout(() => {
      if (adminUser) {
        fetchUsers();
      }
    }, 400); // Debounce to allow page number and filters to settle
    return () => clearTimeout(timer);
  }, [adminUser, currentPage, searchTerm, roleFilter, adminFilter, batchFilter]);

  // When filters change, reset the current page to 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, adminFilter, batchFilter]);

  // Lazy load analytics only when tab is active
  useEffect(() => {
    if (activeView === "analytics" && adminUser && loadingAnalytics) {
      fetchAnalytics();
    } else if (activeView === "overview" && adminUser && loadingAnalytics) {
       // Also load for overview if metrics are needed
       fetchAnalytics();
    }
  }, [activeView, adminUser]);

  useEffect(() => {
    const fetchSignupRequests = async () => {
      try {
        const userId = adminUser?.id;
        if (!userId) return;
        const requestsRes = await fetch("/api/admin/signup-requests?status=pending", {
          headers: { "user-id": userId, "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}` },
        });
        if (requestsRes.ok) {
          const reqData = await requestsRes.json();
          setSignupRequests(reqData.requests || []);
          setTotalRequests(reqData.totalCount || (reqData.requests?.length || 0));
        }
      } catch { /* silent */ } finally {
        setLoadingRequests(false);
      }
    };
    fetchSignupRequests();
  }, [adminUser]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setAdminFilter("all");
    setDateFilter("all");
    setBatchFilter("all");
    setCurrentPage(1);
    fetchUsers();
  };

  // Handle bulk role update
  const handleBulkRoleUpdate = async (userIds: string[], role: 'student' | 'alumni') => {
    if (!confirm(`Are you sure you want to update ${userIds.length} users to ${role}?`)) return;

    setUpdatingParams(true);
    try {
      const adminUserId = adminUser?.id;
      const response = await fetch("/api/admin/users/bulk-update-role", {
        method: "POST",
        headers: {
          "user-id": adminUserId || "",
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds, role }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update roles");

      toast({
        title: "Success",
        description: `Successfully updated ${data.count} users to ${role}`,
      });

      // Refresh users
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update roles",
        variant: "destructive",
      });
    } finally {
      setUpdatingParams(false);
    }
  };

  // Handle signup request approval
  const handleApproveRequest = async (requestId: string) => {
    try {
      const userId = adminUser?.id;

      const response = await fetch(
        `/api/admin/signup-requests/${requestId}/approve`,
        {
          method: "POST",
          headers: {
            "user-id": userId || "",
            "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (response.ok) {


        toast({
          title: "Request Approved",
          description: (
            <div className="flex flex-col gap-2">
              <p>
                Username: {data.credentials.username} <br />
                Email: {data.credentials.email}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Username: ${data.credentials.username} / Email: ${data.credentials.email}`,
                  );
                  toast({
                    title: "Copied!",
                    description: "Credentials copied to clipboard",
                    duration: 2000,
                  });
                }}
                className="w-fit bg-white hover:bg-gray-100 text-xs"
              >
                📋 Copy Credentials
              </Button>
            </div>
          ),
          duration: 10000,
        });

        // Remove from pending list immediately
        setSignupRequests((prev) => prev.filter((r) => r.id !== requestId));

        // Refresh the users list to show the new user
        fetchUsers();
      } else {
        // console.error("Approval failed:", data);
        throw new Error(data.error || "Failed to approve request");
      }
    } catch (error: any) {
      // console.error("Approval error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    }
  };

  // Handle signup request rejection
  const handleRejectRequest = async (requestId: string) => {
    try {
      const userId = adminUser?.id;
      const response = await fetch(
        `/api/admin/signup-requests/${requestId}/reject`,
        {
          method: "POST",
          headers: {
            "user-id": userId || "",
            "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
          },
        },
      );

      if (response.ok) {
        toast({
          title: "Request Rejected",
          description: "Signup request has been rejected",
        });

        // Remove from list
        setSignupRequests(signupRequests.filter((r) => r.id !== requestId));
      } else {
        throw new Error("Failed to reject request");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive",
      });
    }
  };

  // Pagination is handled server-side
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  // totalPages is already calculated in AdminUsersTable via props or here if needed
  const totalPages = Math.ceil(totalCount / RECORDS_PER_PAGE);




  // Validation functions (matching Signup Form)
  const validateField = (fieldName: string, value: string): string => {
    switch (fieldName) {
      case "firstName":
      case "lastName":
        if (!value.trim()) return `${fieldName === 'firstName' ? 'First' : 'Last'} name is required`;
        if (!/^[A-Za-z\s'-]+$/.test(value)) return 'Only letters, spaces, hyphens and apostrophes allowed';
        if (value.trim().length < 2) return 'Must be at least 2 characters';
        if (value.trim().length > 50) return 'Must be less than 50 characters';
        return "";

      case "email":
        if (!value.trim()) return "Email is required";
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
          return 'Please enter a valid email address';
        }
        return "";

      case "phone":
        if (value && value.trim()) {
          // Parse phone number to extract country code and number
          const parsed = parsePhoneNumber(value);

          if (!parsed.country) {
            return "Invalid country code";
          }

          // Validate phone number based on country-specific rules
          const validation = validatePhoneNumber(parsed.number, parsed.country);
          if (!validation.valid && validation.error) {
            return validation.error;
          }

          // Additional validation for India (must start with 6-9)
          if (parsed.country.code === 'IN' && parsed.number) {
            if (!/^[6-9]/.test(parsed.number)) {
              return "Indian phone number must start with 6, 7, 8, or 9";
            }
          }
        }
        return "";

      case "graduationYear": {
        if (!value) return "Graduation year is required";
        const year = parseInt(value);
        const currentYear = new Date().getFullYear();
        const maxYear = currentYear + 5;
        if (isNaN(year) || year < MIN_GRADUATION_YEAR || year > maxYear) {
          return `Year must be between ${MIN_GRADUATION_YEAR} and ${maxYear}`;
        }
        return "";
      }

      case "cgpa": {
        if (value) {
          const cgpa = parseFloat(value);
          if (isNaN(cgpa) || cgpa < 0 || cgpa > 10)
            return "CGPA must be between 0 and 10";
        }
        return "";
      }

      case "linkedinUrl":
        if (
          value &&
          !/^(https?:\/\/)?(www\.)?linkedin\.com\/(in|pub|company)\/.+$/i.test(
            value,
          )
        ) {
          return "Invalid LinkedIn URL";
        }
        return "";

      case "gender":
        if (!value) return "Gender is required";
        return "";

      default:
        return "";
    }
  };

  // Handle field change with validation
  const handleAlumniFieldChange = (field: string, value: string) => {
    setCreateAlumniForm({ ...createAlumniForm, [field]: value });

    // Validate immediately for required fields
    if (['firstName', 'lastName', 'email', 'phone', 'gender', 'graduationYear'].includes(field)) {
      const error = validateField(field, value);
      setFormErrors((prev) => ({
        ...prev,
        [field]: error,
      }));
    }
  };

  // Check if form is valid
  const isFormValid = (): boolean => {
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "graduationYear",
      "gender",
    ];

    // Check required fields are filled
    for (const field of requiredFields) {
      if (!createAlumniForm[field as keyof typeof createAlumniForm]) {
        return false;
      }
    }

    // Check no errors exist
    for (const field in createAlumniForm) {
      const error = validateField(
        field,
        createAlumniForm[field as keyof typeof createAlumniForm],
      );
      if (error) return false;
    }

    return true;
  };

  // Handle create alumni account
  const handleCreateAlumni = async () => {
    // Get user ID from context or localStorage
    const adminUserId = adminUser?.id;



    if (!adminUserId) {
      toast({
        title: "Authentication Error",
        description: "Admin session not found. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    if (
      !createAlumniForm.firstName ||
      !createAlumniForm.lastName ||
      !createAlumniForm.email ||
      !createAlumniForm.graduationYear
    ) {
      toast({
        title: "Validation Error",
        description:
          "Please fill in all required fields (First Name, Last Name, Email, Graduation Year)",
        variant: "destructive",
      });
      return;
    }

    // Validate name format (consistent with validateField)
    const nameRegex = /^[A-Za-z\s'-]+$/;
    if (!nameRegex.test(createAlumniForm.firstName)) {
      toast({
        title: "Validation Error",
        description: "First name should contain only letters, spaces, hyphens, and apostrophes",
        variant: "destructive",
      });
      return;
    }
    if (!nameRegex.test(createAlumniForm.lastName)) {
      toast({
        title: "Validation Error",
        description: "Last name should contain only letters, spaces, hyphens, and apostrophes",
        variant: "destructive",
      });
      return;
    }

    // Validate name length
    if (createAlumniForm.firstName.trim().length < 2 || createAlumniForm.firstName.trim().length > 50) {
      toast({
        title: "Validation Error",
        description: "First name must be between 2 and 50 characters",
        variant: "destructive",
      });
      return;
    }
    if (createAlumniForm.lastName.trim().length < 2 || createAlumniForm.lastName.trim().length > 50) {
      toast({
        title: "Validation Error",
        description: "Last name must be between 2 and 50 characters",
        variant: "destructive",
      });
      return;
    }

    // Validate email format (consistent with validateField)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(createAlumniForm.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Validate graduation year (2021 only and onward, same as user signup)
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 5;
    const gradYear = parseInt(createAlumniForm.graduationYear);
    if (isNaN(gradYear) || gradYear < MIN_GRADUATION_YEAR || gradYear > maxYear) {
      toast({
        title: "Validation Error",
        description: `Graduation year must be between ${MIN_GRADUATION_YEAR} and ${maxYear}`,
        variant: "destructive",
      });
      return;
    }

    // Validate phone if provided (using country-specific validation)
    if (createAlumniForm.phone && createAlumniForm.phone.trim()) {
      const parsed = parsePhoneNumber(createAlumniForm.phone);

      if (!parsed.country) {
        toast({
          title: "Validation Error",
          description: "Invalid country code",
          variant: "destructive",
        });
        return;
      }

      // Validate phone number based on country-specific rules
      const validation = validatePhoneNumber(parsed.number, parsed.country);
      if (!validation.valid) {
        toast({
          title: "Validation Error",
          description: validation.error || "Invalid phone number format",
          variant: "destructive",
        });
        return;
      }

      // Additional validation for India (must start with 6-9)
      if (parsed.country.code === 'IN' && parsed.number) {
        if (!/^[6-9]/.test(parsed.number)) {
          toast({
            title: "Validation Error",
            description: "Indian phone number must start with 6, 7, 8, or 9",
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Validate gender
    if (!createAlumniForm.gender) {
      toast({
        title: "Validation Error",
        description: "Please select a gender",
        variant: "destructive",
      });
      return;
    }

    setCreatingAlumni(true);

    try {


      const response = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-id": adminUserId,
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify(createAlumniForm),
      });


      const data = await response.json();


      if (!response.ok) {
        throw new Error(data.error || "Failed to create alumni account");
      }

      // Store credentials temporarily
      setTempCredentials({
        email: data.credentials.email,
        password: data.credentials.temporaryPassword,
      });

      // Use the login URL from the server response
      const loginUrl =
        data.loginUrl || "https://tks-new-production.up.railway.app/login";

      const defaultEmailContent = `Dear ${createAlumniForm.firstName} ${createAlumniForm.lastName},

Welcome to The Kalyani School Alumni Portal!

Your account has been successfully created by the administrator. Here are your login credentials:

Email: ${data.credentials.email}
Temporary Password: ${data.credentials.temporaryPassword}

Please use these credentials to log in to the alumni portal at: ${loginUrl}

For security reasons, we recommend that you change your password after your first login.

If you have any questions or need assistance, please don't hesitate to contact the alumni office.

Best regards,
The Kalyani School Alumni Team`;

      setEmailContent(defaultEmailContent);

      // Close create dialog and show email confirmation
      setCreateAlumniDialog(false);
      setEmailConfirmDialog(true);

      // Refresh user list
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating alumni:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create alumni account",
        variant: "destructive",
      });
    } finally {
      setCreatingAlumni(false);
    }
  };

  // Handle sending email with credentials
  const handleSendCredentialsEmail = async () => {
    setSendingEmail(true);

    try {
      const adminUserId = adminUser?.id;

      const response = await fetch("/api/admin/send-credentials-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-id": adminUserId || "",
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          recipientEmail: tempCredentials.email,
          recipientName: `${createAlumniForm.firstName} ${createAlumniForm.lastName}`,
          emailContent: emailContent,
          credentials: tempCredentials,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details
          ? `${data.error || "Failed to send email"}: ${data.details}`
          : (data.error || "Failed to send email");
        throw new Error(errorMsg);
      }

      // Close email dialog
      setEmailConfirmDialog(false);

      // Show success message with copy option
      toast({
        title: "Credentials Sent!",
        description: (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">
              Credentials have been sent to {tempCredentials.email}
            </p>
            <div className="bg-gray-50 p-2 rounded border border-gray-200 text-xs font-mono">
              <p>
                <strong>Email:</strong> {tempCredentials.email}
              </p>
              <p>
                <strong>Password:</strong> {tempCredentials.password}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(
                  `Email: ${tempCredentials.email}\nPassword: ${tempCredentials.password}`,
                );
                toast({
                  title: "Copied!",
                  description: "Credentials copied to clipboard",
                  duration: 2000,
                });
              }}
              className="w-fit bg-white hover:bg-gray-100 text-xs"
            >
              📋 Copy Credentials
            </Button>
          </div>
        ),
        duration: 12000,
      });

      // Reset form
      setCreateAlumniForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        gender: "",
        graduationYear: "",
        batch: "",
        course: "",
        branch: "",
      });
      setTempCredentials({ email: "", password: "" });
      setEmailContent("");
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Email Error",
        description: error.message || "Failed to send credentials email",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle confirmed update
  const handleConfirmedUpdate = async () => {
    const { userId, field, newValue } = confirmDialog;

    try {
      // Optimistically update UI
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, [field]: newValue } : u)),
      );

      const response = await fetch(`/api/admin/users/${userId}/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "user-id": adminUser?.id || "",
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          field,
          value: newValue,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user");
      }

      toast({
        title: "Success",
        description: `${field} updated successfully`,
      });
    } catch (error) {
      console.error("Error updating user:", error);

      // Revert optimistic update on error
      setUsers(
        users.map((u) =>
          u.id === userId ? { ...u, [field]: confirmDialog.oldValue } : u,
        ),
      );

      toast({
        title: "Error",
        description: `Failed to update ${field}`,
        variant: "destructive",
      });
    } finally {
      setConfirmDialog({
        open: false,
        userId: "",
        field: "",
        oldValue: "",
        newValue: "",
      });
      setEditingCell(null);
    }
  };

  // Handle dialog cancel - reset to original value
  const handleCancelUpdate = () => {
    setConfirmDialog({
      open: false,
      userId: "",
      field: "",
      oldValue: "",
      newValue: "",
    });
    setEditingCell(null);
  };

  // Handle block/unblock account
  const handleBlockAccount = async () => {
    const { userId, currentlyBlocked } = blockDialog;
    const newBlockedStatus = !currentlyBlocked;

    // Get admin user ID
    const adminUserId = adminUser?.id;

    if (!adminUserId) {
      toast({
        title: "Authentication Error",
        description: "Your session has expired. Please log in again.",
        variant: "destructive",
      });
      setLocation("/admin/login");
      return;
    }

    try {


      const response = await fetch(`/api/admin/users/${userId}/block`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "user-id": adminUserId,
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          accountBlocked: newBlockedStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update block status");
      }

      // Update local state with the exact value from the server response
      setUsers(
        users.map((u) =>
          u.id === userId
            ? {
              ...u,
              account_blocked: data.user?.account_blocked || newBlockedStatus,
            }
            : u,
        ),
      );

      toast({
        title: "Success",
        description: newBlockedStatus
          ? "Account has been blocked successfully"
          : "Account has been unblocked successfully",
      });

      setBlockDialog({
        open: false,
        userId: "",
        username: "",
        currentlyBlocked: false,
      });
    } catch (error: any) {
      console.error("Error updating block status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update account block status",
        variant: "destructive",
      });
    }
  };

  // Handle batch champion toggle
  const handleToggleChampion = async (userId: string, currentStatus: boolean, batch: string | null) => {
    // Get admin user ID
    const adminUserId = adminUser?.id;

    if (!adminUserId) {
      toast({
        title: "Authentication Error",
        description: "Your session has expired. Please log in again.",
        variant: "destructive",
      });
      setLocation("/admin/login");
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/champion`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "user-id": adminUserId,
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          isBatchChampion: !currentStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update champion status");
      }

      // Update local state
      setUsers(
        users.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              is_batch_champion: !currentStatus,
            };
          }
          // If we are setting to true, we should unset others in the same batch
          if (!currentStatus && batch && u.batch === batch && u.id !== userId) {
            return {
              ...u,
              is_batch_champion: false,
            };
          }
          return u;
        }),
      );

      toast({
        title: "Success",
        description: !currentStatus
          ? "User appointed as Batch Champion"
          : "User removed as Batch Champion",
      });
    } catch (error: any) {
      console.error("Error updating champion status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update champion status",
        variant: "destructive",
      });
    }
  };


  // Handle cell click for editing
  const handleCellClick = (userId: string, field: string, currentValue: any) => {
    setEditingCell({ userId, field });
    setEditValue(currentValue);
  };

  // Handle edit change
  const handleEditChange = (value: string) => {
    setEditValue(value);
  };

  // Handle edit submit
  const handleEditSubmit = async (userId: string, field: string) => {
    if (!editingCell) return;

    // Optimistic update
    const oldValue = users.find(u => u.id === userId)?.[field];
    if (oldValue === editValue) {
      setEditingCell(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "user-id": adminUser?.id || "",
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({ field, value: editValue }),
      });

      if (!response.ok) {
        throw new Error("Failed to update");
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: editValue } : u));
      toast({ title: "Success", description: "User updated successfully" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    }
    setEditingCell(null);
  };

  // Export filtered users to CSV
  const exportToCSV = () => {
    const headers = [
      "Username",
      "Email",
      "Role",
      "Admin Status",
      "Created At",
      "Updated At",
    ];
    const csvData = users.map((user: any) => [
      user.username,
      user.email,
      user.user_role || "Alumni",
      user.is_admin ? "Yes" : "No",
      formatDateTimeIST(user.created_at),
      formatDateTimeIST(user.updated_at),
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Exported ${users.length} users to CSV`,
    });
  };

  // Export filtered users to JSON
  const exportToJSON = () => {
    const jsonData = JSON.stringify(users, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Exported ${users.length} users to JSON`,
    });
  };

  // Generate PDF report - Works across all tabs
  const generateAnalyticsReport = async () => {
    if (loadingAnalytics) {
      toast({
        title: "Please wait",
        description: "Charts are still loading. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingPDF(true);

    try {
      // Create a temporary container to render all charts
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.width = "800px";
      document.body.appendChild(tempContainer);

      // Clone all chart sections to the temporary container
      const chartIds = [
        "userGrowthChart",
        "roleDistributionChart",
        "profileCompletionChart",
        "engagementChart",
        "activitySummary",
      ];

      // Find and clone chart elements
      const chartElements: { element: HTMLElement; name: string }[] = [];

      for (const chartId of chartIds) {
        const originalElement = document.getElementById(chartId);
        if (originalElement) {
          const clone = originalElement.cloneNode(true) as HTMLElement;
          clone.id = `temp-${chartId}`;
          tempContainer.appendChild(clone);

          chartElements.push({
            element: clone,
            name: chartId
              .replace("Chart", "")
              .replace(/([A-Z])/g, " $1")
              .trim()
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" "),
          });
        }
      }

      // Wait for any charts to render
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add title page
      pdf.setFontSize(24);
      pdf.text("Analytics Report", pageWidth / 2, 30, { align: "center" });
      pdf.setFontSize(12);
      pdf.text(`Generated: ${formatDateTimeIST(new Date().toISOString())}`, pageWidth / 2, 40, {
        align: "center",
      });

      let currentY = 60;

      for (const { element, name } of chartElements) {
        try {
          // Capture chart as image
          const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: "#ffffff",
            logging: false,
          });

          const imgData = canvas.toDataURL("image/png");
          const imgWidth = pageWidth - 20;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // Check if we need a new page
          if (currentY + imgHeight + 20 > pageHeight) {
            pdf.addPage();
            currentY = 20;
          }

          // Add chart title
          pdf.setFontSize(14);
          pdf.text(name, 10, currentY);
          currentY += 8;

          // Add image
          pdf.addImage(imgData, "PNG", 10, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 15;
        } catch (error) {
          console.error(`Error capturing ${name}:`, error);
        }
      }

      // Clean up temporary container
      document.body.removeChild(tempContainer);

      // Download PDF
      pdf.save(`analytics-report-${new Date().getTime()}.pdf`);

      toast({
        title: "PDF Generated!",
        description: "Your analytics report has been downloaded successfully.",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Stats data
  const stats = {
    totalAlumni: analytics.totalUsers || 0,
    newRegistrations: analytics.activityMetrics?.newMonth || 0,
    upcomingEvents: 5,
    pendingApprovals: {
      profiles: signupRequests.length,
      jobs: 0,
      feed: 0,
      events: 0,
    },
  };

  // Regional data for alumni distribution
  const regionalData = [
    { region: "IN", count: 947, label: "IN – 947 Alumni", color: "#008060" },
    { region: "AUS", count: 63, label: "AUS – 63 Alumni", color: "#00a078" },
    { region: "USA", count: 57, label: "USA – 57 Alumni", color: "#00b88f" },
    { region: "UAE", count: 41, label: "UAE – 41 Alumni", color: "#33c9a8" },
    { region: "UK", count: 32, label: "UK – 32 Alumni", color: "#66d9bd" },
    { region: "UAE", count: 26, label: "UAE – 26 Alumni", color: "#99e8d2" },
    {
      region: "Others",
      count: 20,
      label: "Others – 20 Alumni",
      color: "#ccf4e7",
    },
  ];

  const maxCount = Math.max(...regionalData.map((r) => r.count));

  const navItems = [
    { icon: "📊", label: "Dashboard", path: "/admin/dashboard", active: true },
    { icon: "📰", label: "Feed", path: "/admin/feed", active: false },
    { icon: "📅", label: "Events", path: "/admin/events", active: false },
    { icon: "💬", label: "Messages", path: "/admin/messages", active: false },
  ];

  const bottomNavItems = [
    { icon: "⚙️", label: "Settings", path: "/admin/settings" },
    { icon: "🚪", label: "Log Out", path: "/" },
  ];

  // Automatic logout on tab close (but not on refresh)
  useEffect(() => {
    // Mark that we're in an active admin session
    sessionStorage.setItem("adminActive", "true");

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only clear localStorage if this is a tab close (not a refresh)
      // On refresh, sessionStorage persists briefly
      if (!sessionStorage.getItem("navigating")) {
        // This is a tab close, not a navigation/refresh
        localStorage.removeItem("adminUser"); // Changed to adminUser

      }
    };

    // Track navigation events (refresh/route changes)
    const handleNavigation = () => {
      sessionStorage.setItem("navigating", "true");
      setTimeout(() => sessionStorage.removeItem("navigating"), 100);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handleNavigation);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handleNavigation);
    };
  }, []);

  // Session monitoring - ensure user stays logged in
  useEffect(() => {
    // Periodically check if session is still valid
    const checkSession = () => {
      const storedAdminUser = localStorage.getItem("adminUser");

      if (!storedAdminUser) {
        console.warn("Admin session lost, redirecting to login");
        toast({
          title: "Session Expired",
          description: "Please log in again",
          variant: "destructive",
        });
        setLocation("/admin/login");
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkSession, 30000);

    return () => clearInterval(interval);
  }, [toast, setLocation]);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Sidebar */}
      <AdminSidebar currentPage={activeView === 'overview' ? 'dashboard' : activeView as any} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 sticky top-0 z-40 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">Admin Dashboard</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative z-[70]">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative min-w-[44px] min-h-[44px] rounded-full transition-colors ${unreadCount > 0
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


        {/* Dashboard Content */}
        <main className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
          <div className="max-w-7xl mx-auto">
            {/* Page Title */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                  <p className="text-sm text-gray-600 mt-1">View and manage all registered users</p>
                </div>
                <Button
                  onClick={() => {
                    setCreateAlumniDialog(true);
                    setFormErrors({});
                  }}
                  className="bg-[#008060] hover:bg-[#006b51] text-white"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Alumni Account
                </Button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <Card className="mb-6 border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <p className="text-red-600 text-sm">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Signup Requests in Users Tab */}
            {signupRequests.length > 0 && (
              <Card className="mb-4 border-0 shadow-lg bg-gradient-to-br from-amber-50 to-white animate-fade-up">
                <CardHeader className="p-3 sm:p-4 border-b border-amber-100">
                  <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span>📋</span>
                    Pending Signup Requests ({signupRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                  {loadingRequests ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-3 sm:-mx-4">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableRow className="bg-amber-50">
                            <TableHead className="font-semibold text-gray-700 text-xs sm:text-sm w-28 sm:w-32">
                              Name
                            </TableHead>
                            <TableHead className="font-semibold text-gray-700 text-xs sm:text-sm hidden sm:table-cell w-36">
                              Email
                            </TableHead>
                            <TableHead className="font-semibold text-gray-700 text-xs sm:text-sm w-14">
                              Year
                            </TableHead>
                            <TableHead className="font-semibold text-gray-700 text-xs sm:text-sm hidden md:table-cell w-32">
                              Batch
                            </TableHead>
                            <TableHead className="font-semibold text-gray-700 text-xs sm:text-sm hidden lg:table-cell w-28">
                              Phone
                            </TableHead>
                            <TableHead className="font-semibold text-gray-700 text-xs sm:text-sm hidden xl:table-cell w-36">
                              Course/Branch
                            </TableHead>
                            <TableHead className="font-semibold text-gray-700 text-xs sm:text-sm hidden 2xl:table-cell w-40">
                              Reason
                            </TableHead>
                            <TableHead className="font-semibold text-gray-700 text-xs sm:text-sm w-36">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {signupRequests.map((request) => (
                            <TableRow
                              key={request.id}
                              className="hover:bg-amber-50/50"
                            >
                              <TableCell className="font-medium text-gray-900 text-xs sm:text-sm truncate max-w-0" title={`${request.first_name} ${request.last_name}`}>
                                {request.first_name} {request.last_name}
                              </TableCell>
                              <TableCell className="text-gray-700 text-xs sm:text-sm hidden sm:table-cell truncate max-w-0" title={request.email}>
                                {request.email}
                              </TableCell>
                              <TableCell className="text-gray-700 text-xs sm:text-sm">
                                {request.graduation_year}
                              </TableCell>
                              <TableCell className="text-gray-700 text-xs sm:text-sm hidden md:table-cell truncate max-w-0" title={request.batch || ""}>
                                {request.batch || "-"}
                              </TableCell>
                              <TableCell className="text-gray-700 text-xs sm:text-sm hidden lg:table-cell truncate max-w-0" title={request.phone || ""}>
                                {request.phone || "-"}
                              </TableCell>
                              <TableCell className="text-gray-700 text-xs sm:text-sm hidden xl:table-cell truncate max-w-0" title={`${request.course}${request.branch ? ` / ${request.branch}` : ""}`}>
                                {request.course}{request.branch ? ` / ${request.branch}` : ""}
                              </TableCell>
                              <TableCell className="text-gray-700 text-xs sm:text-sm hidden 2xl:table-cell truncate max-w-0" title={request.reason_for_joining}>
                                {request.reason_for_joining || "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleApproveRequest(request.id)
                                    }
                                    className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1"
                                  >
                                    ✓ Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleRejectRequest(request.id)
                                    }
                                    className="border-red-300 text-red-600 hover:bg-red-50 text-xs px-3 py-1"
                                  >
                                    ✗ Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Analytics Dashboard */}
            {activeView === 'overview' && (
              <div className="space-y-4">
                {/* Informational Notice */}


                {/* Export Analytics Button */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700">
                        Quick Actions:
                      </span>
                      <UITooltipProvider>
                        <UITooltip>
                          <UITooltipTrigger asChild>
                            <Button
                              onClick={generateAnalyticsReport}
                              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={loadingAnalytics || generatingPDF}
                            >
                              <span className="mr-2">📄</span>
                              {generatingPDF
                                ? "Generating PDF..."
                                : loadingAnalytics
                                  ? "Loading Charts..."
                                  : "Export Analytics PDF"}
                            </Button>
                          </UITooltipTrigger>
                          <UITooltipContent>
                            <p>
                              {loadingAnalytics
                                ? "Please wait for charts to load"
                                : generatingPDF
                                  ? "Generating PDF..."
                                  : "Export analytics to PDF"}
                            </p>
                          </UITooltipContent>
                        </UITooltip>
                      </UITooltipProvider>
                    </div>
                  </CardContent>
                </Card>

                <AdminStatsCards
                  users={users}
                  totalUsers={totalUsersForDashboard}
                  adminCount={analytics.adminCount}
                  signupRequests={signupRequests}
                  activityMetrics={analytics.activityMetrics}
                  profileStats={analytics.profileStats}
                />

                <AdminAnalytics
                  analytics={analytics}
                  loadingAnalytics={loadingAnalytics}
                />
              </div>
            )}

            {/* Analytics Tab */}
            {activeView === 'analytics' && (
              <div className="space-y-4">
                {/* Informational Notice */}


                {/* Export Analytics Button */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700">
                        Quick Actions:
                      </span>
                      <UITooltipProvider>
                        <UITooltip>
                          <UITooltipTrigger asChild>
                            <Button
                              onClick={generateAnalyticsReport}
                              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={loadingAnalytics || generatingPDF}
                            >
                              <span className="mr-2">📄</span>
                              {generatingPDF
                                ? "Generating PDF..."
                                : loadingAnalytics
                                  ? "Loading Charts..."
                                  : "Export Analytics PDF"}
                            </Button>
                          </UITooltipTrigger>
                          <UITooltipContent>
                            <p>
                              {loadingAnalytics
                                ? "Please wait for charts to load"
                                : generatingPDF
                                  ? "Generating PDF..."
                                  : "Export analytics to PDF"}
                            </p>
                          </UITooltipContent>
                        </UITooltip>
                      </UITooltipProvider>


                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Engagement Chart */}
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <Activity className="w-5 h-5 text-[#008060]" />
                          User Activity Overview
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                            {(["active", "new"] as const).map(v => (
                              <button
                                key={v}
                                onClick={() => setActView(v)}
                                className={`px-2.5 py-1 font-medium transition-colors ${actView === v ? "bg-[#008060] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                              >
                                {v === "active" ? "Active" : "New"}
                              </button>
                            ))}
                          </div>
                          <ChartInfoButton
                            title="User Activity Overview"
                            description="Toggle between 'Active' (users who had profile updates) and 'New' (fresh registrations) across three time windows."
                            methodology={[
                              "Active = updated_at within the window (approx. engagement)",
                              "New = created_at within the window (real registrations)",
                              "Cumulative: Month ≥ Week ≥ Today for active counts",
                            ]}
                            dataSource="Users table (updated_at, created_at)"
                            updateFrequency="Cached 5 minutes"
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent id="engagementChart">
                      {loadingAnalytics ? (
                        <div className="h-64 flex items-center justify-center">
                          <div className="w-8 h-8 border-3 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin" />
                        </div>
                      ) : (() => {
                        const total = analytics.totalUsers || 1;
                        const rows = actView === "active" ? [
                          { label: "Active This Month", value: analytics.activityMetrics?.activeMonth || 0, bg: "bg-[#008060]", light: "bg-emerald-50 border-emerald-200" },
                          { label: "Active This Week",  value: analytics.activityMetrics?.activeWeek  || 0, bg: "bg-blue-500",  light: "bg-blue-50 border-blue-200"    },
                          { label: "Active Today",      value: analytics.activityMetrics?.activeToday || 0, bg: "bg-amber-400", light: "bg-amber-50 border-amber-200"  },
                        ] : [
                          { label: "New This Month", value: analytics.activityMetrics?.newMonth || 0, bg: "bg-indigo-500", light: "bg-indigo-50 border-indigo-200" },
                          { label: "New This Week",  value: analytics.activityMetrics?.newWeek  || 0, bg: "bg-purple-500", light: "bg-purple-50 border-purple-200" },
                          { label: "New Today",      value: analytics.activityMetrics?.newToday || 0, bg: "bg-pink-400",   light: "bg-pink-50 border-pink-200"    },
                        ];
                        return (
                          <div className="space-y-3">
                            {rows.map(row => (
                              <div key={row.label} className={`p-3 rounded-lg border ${row.light} transition-all duration-300`}>
                                <div className="flex justify-between items-baseline mb-2">
                                  <span className="text-xs font-semibold text-gray-700">{row.label}</span>
                                  <div className="flex items-baseline gap-1.5">
                                    <span className="text-xl font-bold text-gray-900 tabular-nums">{row.value.toLocaleString()}</span>
                                    <span className="text-xs text-gray-400">({Math.round((row.value / total) * 100)}%)</span>
                                  </div>
                                </div>
                                <div className="h-2.5 bg-white/80 rounded-full overflow-hidden border border-gray-100">
                                  <div
                                    className={`h-2.5 rounded-full ${row.bg} transition-all duration-700`}
                                    style={{ width: `${Math.min(Math.round((row.value / total) * 100), 100)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <p className="text-xs font-semibold text-gray-600 mb-1">Monthly Engagement</p>
                                <p className="text-2xl font-black text-purple-600 tabular-nums">
                                  {analytics.totalUsers > 0 ? Math.round(((analytics.activityMetrics?.activeMonth || 0) / analytics.totalUsers) * 100) : 0}%
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Active ÷ total users</p>
                              </div>
                              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-semibold text-gray-600 mb-1">Inactive 30+ days</p>
                                <p className="text-2xl font-black text-gray-600 tabular-nums">
                                  {((analytics.totalUsers || 0) - (analytics.activityMetrics?.activeMonth || 0)).toLocaleString()}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">No profile activity</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Activity Summary */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        Activity Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent id="activitySummary" className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">New This Month</p>
                            <p className="text-xl font-bold text-gray-900">
                              {analytics.activityMetrics?.newMonth || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">New This Week</p>
                            <p className="text-xl font-bold text-gray-900">
                              {analytics.activityMetrics?.newWeek || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">New Today</p>
                            <p className="text-xl font-bold text-gray-900">
                              {analytics.activityMetrics?.newToday || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Total Registered</p>
                            <p className="text-xl font-bold text-gray-900">
                              {(analytics.totalUsers || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {/* Users Tab - Reorganized & Premium */}
            {activeView === 'users' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Search & Filters Card - Reorganized */}
                <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-gray-50/30 to-white backdrop-blur-sm overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#008060]/5 via-transparent to-[#008060]/5 opacity-50 pointer-events-none"></div>

                  <CardHeader className="p-4 sm:p-5 md:p-6 border-b border-gray-100 bg-white/50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="text-xl sm:text-2xl">🔍</span>
                        Search & Filter Users
                      </CardTitle>
                      {(searchTerm || roleFilter !== "all" || adminFilter !== "all" || dateFilter !== "all" || batchFilter !== "all") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearFilters}
                          className="text-[#008060] hover:bg-[#008060]/10 border-[#008060] border-2 font-semibold w-full sm:w-auto transition-all duration-200 hover:shadow-md"
                        >
                          <span className="mr-2">✖</span>
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 md:p-6 space-y-5 bg-white/30">
                    {/* Search Bar */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span>🔎</span>
                        Search by Username or Email
                      </label>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-[#008060] transition-colors">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                        <Input
                          type="text"
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                            }
                          }}
                          className="pl-10 pr-4 py-3 w-full border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008060]/20 focus:border-[#008060] text-sm sm:text-base transition-all duration-200 shadow-sm group-hover:border-[#008060]/30"
                        />
                      </div>
                    </div>

                    {/* Filter Controls - Grid Layout */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span>🎯</span>
                        Filter Options
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {/* Role Filter */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-600 ml-1">User Role</label>
                          <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full h-11 border-2 border-gray-200 rounded-lg hover:border-[#008060]/50 transition-colors focus:ring-2 focus:ring-[#008060]/20">
                              <SelectValue placeholder="Filter by Role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Roles</SelectItem>
                              <SelectItem value="administrator">Administrator</SelectItem>
                              <SelectItem value="faculty">Faculty</SelectItem>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="alumni">Alumni</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Admin Status Filter */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-600 ml-1">Admin Status</label>
                          <Select value={adminFilter} onValueChange={setAdminFilter}>
                            <SelectTrigger className="w-full h-11 border-2 border-gray-200 rounded-lg hover:border-[#008060]/50 transition-colors focus:ring-2 focus:ring-[#008060]/20">
                              <SelectValue placeholder="Admin Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Users</SelectItem>
                              <SelectItem value="admin">Admin Only</SelectItem>
                              <SelectItem value="regular">Regular Users</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Date Range Filter */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-600 ml-1">Date Range</label>
                          <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger className="w-full h-11 border-2 border-gray-200 rounded-lg hover:border-[#008060]/50 transition-colors focus:ring-2 focus:ring-[#008060]/20">
                              <SelectValue placeholder="Date Range" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Time</SelectItem>
                              <SelectItem value="today">Today</SelectItem>
                              <SelectItem value="week">Last 7 Days</SelectItem>
                              <SelectItem value="month">Last 30 Days</SelectItem>
                              <SelectItem value="year">Last Year</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Batch Filter */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-600 ml-1">Batch (Year)</label>
                          <Select value={batchFilter} onValueChange={setBatchFilter}>
                            <SelectTrigger className="w-full h-11 border-2 border-gray-200 rounded-lg hover:border-[#008060]/50 transition-colors focus:ring-2 focus:ring-[#008060]/20">
                              <SelectValue placeholder="All Batches" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Batches</SelectItem>
                              {Array.from(new Set(users.map(u => u.batch).filter(Boolean))).sort().map((batch: any) => (
                                <SelectItem key={batch} value={batch}>
                                  Batch {batch}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Results Summary with Active Filters Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-gray-200 gap-3">
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                        <div className="w-2 h-2 bg-[#008060] rounded-full animate-pulse"></div>
                        <span className="text-sm font-semibold text-gray-700">
                          Showing {(currentPage - 1) * RECORDS_PER_PAGE + 1}-{Math.min(currentPage * RECORDS_PER_PAGE, totalCount)} of{" "}
                          <span className="text-[#008060] font-bold">{totalCount}</span> user
                          {totalCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {(searchTerm || roleFilter !== "all" || adminFilter !== "all" || dateFilter !== "all") && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-medium">Active filters applied</span>
                          <span className="h-2 w-2 bg-[#008060] rounded-full"></span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Export Options Card - Cleaner */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📤</span>
                        <span className="text-sm font-semibold text-gray-700">Export Data:</span>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        <Button
                          onClick={exportToCSV}
                          className="bg-gradient-to-r from-[#008060] to-[#006b51] hover:from-[#006b51] hover:to-[#005d47] text-white shadow-md hover:shadow-lg transition-all duration-200"
                          disabled={users.length === 0}
                        >
                          <span className="mr-2">📊</span>
                          Export to CSV
                        </Button>
                        <Button
                          onClick={exportToJSON}
                          variant="outline"
                          className="border-2 border-[#008060] text-[#008060] hover:bg-[#008060]/10 font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                          disabled={users.length === 0}
                        >
                          <span className="mr-2">📄</span>
                          Export to JSON
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Users Table Component */}
                <AdminUsersTable
                  users={users}
                  totalCount={totalCount}
                  currentPage={currentPage}
                  itemsPerPage={RECORDS_PER_PAGE}
                  onPageChange={setCurrentPage}
                  loading={loading}
                  error={error}
                  editingCell={editingCell}
                  setEditingCell={setEditingCell}
                  editValue={editValue}
                  setEditValue={setEditValue}
                  handleCellClick={handleCellClick}
                  handleEditChange={handleEditChange}
                  handleEditSubmit={handleEditSubmit}
                  handleToggleChampion={handleToggleChampion}
                  setConfirmDialog={setConfirmDialog}
                  setBlockDialog={setBlockDialog}
                  setLocation={setLocation}
                  handleBulkRoleUpdate={handleBulkRoleUpdate}
                  updatingParams={updatingParams}
                />
              </div>
            )
            }
          </div >
        </main >
      </div >

      {/* Create Alumni Dialog */}
      < Dialog open={createAlumniDialog} onOpenChange={setCreateAlumniDialog} >
        <DialogContent className="sm:max-w-2xl bg-white border-2 border-[#008060]/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">👤</span>
              Create New Alumni Account
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              Fill in the details to create a new alumni account. A temporary
              password will be generated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Personal Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">
                Personal Information *
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    First Name *
                  </label>
                  <Input
                    value={createAlumniForm.firstName}
                    onChange={(e) =>
                      handleAlumniFieldChange("firstName", e.target.value)
                    }
                    placeholder="John"
                    className={`h-9 ${formErrors.firstName ? "border-red-500" : ""}`}
                  />
                  {formErrors.firstName && (
                    <p className="text-xs text-red-500">
                      {formErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Last Name *
                  </label>
                  <Input
                    value={createAlumniForm.lastName}
                    onChange={(e) =>
                      handleAlumniFieldChange("lastName", e.target.value)
                    }
                    placeholder="Doe"
                    className={`h-9 ${formErrors.lastName ? "border-red-500" : ""}`}
                  />
                  {formErrors.lastName && (
                    <p className="text-xs text-red-500">
                      {formErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={createAlumniForm.email}
                    onChange={(e) =>
                      handleAlumniFieldChange("email", e.target.value)
                    }
                    placeholder="john.doe@example.com"
                    className={`h-9 ${formErrors.email ? "border-red-500" : ""}`}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-red-500">{formErrors.email}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Phone
                  </label>
                  <PhoneInput
                    value={createAlumniForm.phone}
                    onChange={(value) =>
                      handleAlumniFieldChange("phone", value)
                    }
                    placeholder="Enter phone number"
                    name="phone"
                    error={formErrors.phone}
                  />
                  {formErrors.phone && (
                    <p className="text-xs text-red-500">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Gender *
                </label>
                <Select
                  value={createAlumniForm.gender}
                  onValueChange={(value) =>
                    handleAlumniFieldChange("gender", value)
                  }
                >
                  <SelectTrigger
                    className={`h-9 ${formErrors.gender ? "border-red-500" : ""}`}
                  >
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">
                      Prefer not to say
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.gender && (
                  <p className="text-xs text-red-500">{formErrors.gender}</p>
                )}
              </div>
            </div>

            {/* Academic Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">
                Academic Information *
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Graduation Year *
                  </label>
                  <select
                    value={createAlumniForm.graduationYear}
                    onChange={(e) =>
                      handleAlumniFieldChange("graduationYear", e.target.value)
                    }
                    className={`flex h-9 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${formErrors.graduationYear ? "border-red-500" : "border-input"}`}
                  >
                    <option value="">Select graduation year</option>
                    {getGraduationYearOptions().map((year) => (
                      <option key={year} value={year.toString()}>
                        {year}
                      </option>
                    ))}
                  </select>
                  {formErrors.graduationYear && (
                    <p className="text-xs text-red-500">
                      {formErrors.graduationYear}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Batch
                  </label>
                  <Input
                    value={createAlumniForm.batch}
                    onChange={(e) =>
                      handleAlumniFieldChange("batch", e.target.value)
                    }
                    placeholder="2020-2024"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Course
                  </label>
                  <Input
                    value={createAlumniForm.course}
                    onChange={(e) =>
                      handleAlumniFieldChange("course", e.target.value)
                    }
                    placeholder="B.Tech"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    Branch
                  </label>
                  <Input
                    value={createAlumniForm.branch}
                    onChange={(e) =>
                      handleAlumniFieldChange("branch", e.target.value)
                    }
                    placeholder="Computer Science"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateAlumniDialog(false);
                setFormErrors({});
              }}
              className="border-gray-300 hover:bg-gray-50"
              disabled={creatingAlumni}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAlumni}
              disabled={creatingAlumni || !isFormValid()}
              className="bg-gradient-to-r from-[#008060] to-[#006b51] hover:from-[#006b51] hover:to-[#005d47] text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !isFormValid()
                  ? "Please fill all required fields correctly"
                  : ""
              }
            >
              {creatingAlumni ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Edit Confirmation Dialog */}
      < Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) handleCancelUpdate();
        }}
      >
        <DialogContent className="sm:max-w-md bg-white border-2 border-blue-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">✏️</span>
              Confirm Edit
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              Are you sure you want to update this user's information?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Field:
                </span>
                <span className="text-sm font-semibold text-gray-900 capitalize">
                  {confirmDialog.field?.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Old Value:
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  {confirmDialog.oldValue || "(empty)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  New Value:
                </span>
                <span className="text-sm font-semibold text-blue-600">
                  {confirmDialog.newValue || "(empty)"}
                </span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <span>
                  This change will be immediately applied to the database. Make
                  sure the information is correct.
                </span>
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelUpdate}
              className="border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmedUpdate}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
            >
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Email Confirmation Dialog */}
      < Dialog open={emailConfirmDialog} onOpenChange={setEmailConfirmDialog} >
        <DialogContent className="sm:max-w-3xl bg-white border-2 border-[#008060]/20 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">📧</span>
              Send Credentials via Email
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              Review and edit the email content before sending credentials to
              the new alumni.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 flex items-start gap-2">
                <span className="text-base">ℹ️</span>
                <span>
                  <strong>Recipient:</strong> {tempCredentials.email}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Email Content (Editable)
              </label>
              <textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                rows={16}
                className="w-full border-2 border-gray-200 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#008060]/20 focus:border-[#008060]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEmailConfirmDialog(false);
                setTempCredentials({ email: "", password: "" });
                setEmailContent("");
              }}
              className="border-gray-300 hover:bg-gray-50"
              disabled={sendingEmail}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendCredentialsEmail}
              disabled={sendingEmail}
              className="bg-gradient-to-r from-[#008060] to-[#006b51] hover:from-[#006b51] hover:to-[#005d47] text-white shadow-lg"
            >
              {sendingEmail ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Block Account Confirmation Dialog */}
      < Dialog
        open={blockDialog.open}
        onOpenChange={(open) =>
          !open && setBlockDialog({ ...blockDialog, open: false })
        }
      >
        <DialogContent className="sm:max-w-md bg-white border-2 border-red-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">
                {blockDialog.currentlyBlocked ? "🔓" : "🚫"}
              </span>
              {blockDialog.currentlyBlocked
                ? "Unblock Account"
                : "Block Account"}
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              {blockDialog.currentlyBlocked
                ? "Are you sure you want to unblock this account? The user will be able to log in again."
                : "Are you sure you want to block this account? The user will not be able to log in until unblocked."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div
              className={`${blockDialog.currentlyBlocked ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} border rounded-lg p-4 space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Username:
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {blockDialog.username}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Current Status:
                </span>
                <Badge
                  variant={
                    blockDialog.currentlyBlocked ? "destructive" : "default"
                  }
                >
                  {blockDialog.currentlyBlocked ? "Blocked" : "Active"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  New Status:
                </span>
                <Badge
                  variant={
                    blockDialog.currentlyBlocked ? "default" : "destructive"
                  }
                >
                  {blockDialog.currentlyBlocked ? "Active" : "Blocked"}
                </Badge>
              </div>
            </div>
            {!blockDialog.currentlyBlocked && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <span className="text-base">⚠️</span>
                  <span>
                    The user will see a message: "Your account has been blocked
                    by the administrator. Please contact the authority for
                    account activation."
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setBlockDialog({
                  open: false,
                  userId: "",
                  username: "",
                  currentlyBlocked: false,
                })
              }
              className="border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBlockAccount}
              className={`${blockDialog.currentlyBlocked
                ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                } text-white shadow-lg`}
            >
              {blockDialog.currentlyBlocked
                ? "Confirm Unblock"
                : "Confirm Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </div >
  );
};
