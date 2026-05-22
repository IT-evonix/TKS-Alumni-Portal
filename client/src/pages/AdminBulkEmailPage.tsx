
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bell, Filter, Mail, Send, CheckCircle2, UserCheck, Search, X, Plus, LogOut, Eye, Edit3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface User {
    id: string;
    email: string;
    name: string;
    batch: string;
    graduationYear: number;
}

const getHtmlTemplate = (type: string, data: { subject?: string; body?: string } = {}) => {
    const baseStyle = `
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #008060, #006b51); padding: 40px 20px; text-align: center; color: white; border-radius: 8px 8px 0 0; }
        .content { padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .footer { padding: 30px; text-align: center; color: #6b7280; font-size: 12px; }
        .button { display: inline-block; background: #008060; color: white !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 25px; }
        .h1 { margin: 0; font-size: 24px; font-weight: 700; color: white; }
        .h2 { color: #111827; font-size: 20px; font-weight: 600; margin-bottom: 20px; }
        .highlight { background: #f0fdf4; border-left: 4px solid #008060; padding: 15px; margin: 20px 0; font-style: italic; }
    `;

    const wrapTemplate = (content: string) => `
        <!DOCTYPE html>
        <html>
        <head>
            <style>${baseStyle}</style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="h1">The Kalyani School</h1>
                    <p style="margin-top: 5px; opacity: 0.9; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;">Alumni Portal</p>
                </div>
                <div class="content">
                    ${content}
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} The Kalyani School Alumni Association</p>
                    <p>You received this email because you are a registered member of the TKS Alumni Portal.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    if (type === 'welcome') {
        return wrapTemplate(`
            <h2 class="h2">Welcome to your Alumni Network!</h2>
            <p>Dear Alumni,</p>
            <h3 style="color: #008060; font-size: 20px; margin: 20px 0 10px 0;">Namaste! 🙏</h3>
            <p style="font-size: 16px; line-height: 1.7; color: #4b5563;">
                The experiences, friendships, and lessons you gained here continue to connect us all. Once a part of this institution, you are always family.
            </p>
            <p style="font-size: 16px; line-height: 1.7; color: #4b5563; margin-top: 15px;">
                Stay engaged with us by registering on the Alumni Portal—your gateway to news, events, and meaningful connections.
            </p>
            <center><a href="https://tks-alumni.web.app/register" class="button">Register Now</a></center>
            <p style="text-align: center; font-size: 14px; color: #6b7280; margin-top: 20px;">
                Already have an account? <a href="https://tks-alumni.web.app/login" style="color: #008060; text-decoration: none; font-weight: 500;">Log in here</a>
            </p>
        `);
    }

    if (type === 'event') {
        return wrapTemplate(`
            <h2 class="h2">You're Invited: Alumni Meetup 2026</h2>
            <p>Hello there!</p>
            <p>It's time to relive the memories. We are excited to announce our upcoming grand <strong>Alumni Meetup</strong>. This is a special occasion for all our former students to gather, share their success stories, and witness how much the school has grown.</p>
            <div class="highlight">
                <strong>When:</strong> May 15th, 2026 | 5:00 PM onwards<br>
                <strong>Where:</strong> Main Campus Auditorium, TKS
            </div>
            <p>We have planned an evening of networking, nostalgic presentations, and a formal gala dinner. Your presence would make this event truly special.</p>
            <center><a href="https://tks-alumni.web.app/events" class="button">RSVP Now</a></center>
        `);
    }

    if (type === 'update') {
        return wrapTemplate(`
            <h2 class="h2">Keep Your Profile Updated</h2>
            <p>Hi,</p>
            <p>To ensure you don't miss out on invitations, job postings, and networking requests, please take a moment to review and update your current employment and contact details on the portal.</p>
            <p>An updated profile helps your fellow alumni find you for collaborations and helps us keep you informed about relevant school initiatives.</p>
            <center><a href="https://tks-alumni.web.app/profile" class="button">Update My Profile</a></center>
            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">If you've already updated your profile recently, you can safely ignore this reminder.</p>
        `);
    }

    // Default custom template structure
    return wrapTemplate(`
        <h2 class="h2">${data.subject || 'Special Message for You'}</h2>
        <div style="white-space: pre-wrap; color: #4b5563;">${data.body || ''}</div>
        <center><a href="https://tks-alumni.web.app/feed" class="button">View on Portal</a></center>
    `);
};

export default function AdminBulkEmailPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { adminUser, logoutAdmin } = useAuth();
    const { unreadCount } = useNotifications();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        graduationYear: "all",
        batch: "all",
        role: "all",
        department: "all"
    });

    // State
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]); // Array of emails
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [step, setStep] = useState<1 | 2>(1); // 1: Select Users, 2: Compose Email

    // Email Content
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [emailIsHtml, setEmailIsHtml] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState("none");
    const [newRecipientEmail, setNewRecipientEmail] = useState("");

    // BCC Settings
    const [bccEmail, setBccEmail] = useState("");
    const [isBccEditable, setIsBccEditable] = useState(false);
    const [bccPassword, setBccPassword] = useState("");

    // Fetch Users based on filters
    const fetchUsers = async () => {
        if (!adminUser?.id) return;
        
        setLoading(true);
        try {
            const response = await fetch('/api/admin/bulk-email/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': adminUser?.id || '',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
                },
                body: JSON.stringify(filters)
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
                setSelectedUsers([]);
            } else {
                const err = await response.json().catch(() => ({}));
                toast({ 
                    title: "Fetch Error", 
                    description: err.error || "Failed to fetch users", 
                    variant: "destructive" 
                });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Network Error", description: "Could not connect to server", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (adminUser?.id) {
            fetchUsers();
        }
    }, [filters, adminUser?.id]);

    useEffect(() => {
        const storedBcc = localStorage.getItem("bulkEmailBcc") || "";
        setBccEmail(storedBcc);
    }, []);

    // Handlers
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedUsers(users.map(u => u.email));
        } else {
            setSelectedUsers([]);
        }
    };

    const handleSelectUser = (email: string, checked: boolean) => {
        if (checked) {
            setSelectedUsers(prev => [...prev, email]);
        } else {
            setSelectedUsers(prev => prev.filter(e => e !== email));
        }
    };

    const handleSendEmail = async () => {
        if (selectedUsers.length === 0) {
            toast({ title: "Error", description: "No users selected", variant: "destructive" });
            return;
        }
        if (!emailSubject || !emailBody) {
            toast({ title: "Error", description: "Subject and Body are required", variant: "destructive" });
            return;
        }

        setSending(true);
        try {
            const response = await fetch('/api/admin/bulk-email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': adminUser?.id || '',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
                },
                body: JSON.stringify({
                    recipients: selectedUsers,
                    bcc: bccEmail ? bccEmail.split(",").map(e => e.trim()).filter(Boolean) : undefined,
                    subject: emailSubject,
                    body: emailBody,
                    isHtml: emailIsHtml
                })
            });

            let data: { stats?: { sent?: number; failed?: number }; error?: unknown; detail?: unknown; message?: unknown } = {};
            try {
                data = await response.json();
            } catch {
                // Non-JSON error response (e.g. 500 HTML)
            }

            if (response.ok && data.stats != null) {
                toast({
                    title: "Success",
                    description: `Emails sent to ${data.stats.sent ?? 0} users.`,
                });
                setEmailSubject("");
                setEmailBody("");
                setEmailIsHtml(false);
                setSelectedTemplate("none");
                setStep(1);
                setSelectedUsers([]);
            } else {
                const errMsg = data?.error ?? data?.detail ?? data?.message;
                const description = typeof errMsg === "string" ? errMsg : "Failed to send emails";
                toast({ title: "Error", description, variant: "destructive" });
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to send emails";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    const templates = {
        "welcome": {
            subject: "Welcome to The Kalyani School Alumni Portal",
            body: "" // This is fetched from API, but fallback uses getHtmlTemplate('welcome')
        },
        "event": {
            subject: "Invitation: Upcoming Alumni Meet",
            body: "" // Uses getHtmlTemplate('event')
        },
        "update": {
            subject: "Update your Profile",
            body: "" // Uses getHtmlTemplate('update')
        }
    };

    const handleTemplateChange = async (val: string) => {
        setSelectedTemplate(val);
        if (val === "none") return;

        if (val === "welcome") {
            try {
                const res = await fetch(`/api/admin/bulk-email/template?type=welcome`, {
                    headers: {
                        "user-id": adminUser?.id || "",
                        "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`
                    },
                });
                if (res.ok) {
                    const data = await res.json();
                    setEmailSubject(data.subject ?? templates.welcome.subject);
                    setEmailBody(data.htmlBody ?? getHtmlTemplate('welcome'));
                    setEmailIsHtml(true);
                } else {
                    setEmailSubject(templates.welcome.subject);
                    setEmailBody(getHtmlTemplate('welcome'));
                    setEmailIsHtml(true);
                }
            } catch {
                setEmailSubject(templates.welcome.subject);
                setEmailBody(getHtmlTemplate('welcome'));
                setEmailIsHtml(true);
            }
            return;
        }

        const t = templates[val as keyof typeof templates];
        if (t) {
            setEmailSubject(t.subject);
            setEmailBody(getHtmlTemplate(val));
            setEmailIsHtml(true);
        }
    };

    const handleRemoveRecipient = (email: string) => {
        setSelectedUsers(prev => prev.filter(e => e !== email));
    };

    const handleAddRecipient = () => {
        const email = newRecipientEmail.trim().toLowerCase();
        if (!email) {
            toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast({ title: "Error", description: "Please enter a valid email address", variant: "destructive" });
            return;
        }

        if (selectedUsers.includes(email)) {
            toast({ title: "Info", description: "This email is already in the recipients list", variant: "default" });
            return;
        }

        setSelectedUsers(prev => [...prev, email]);
        setNewRecipientEmail("");
        toast({ title: "Success", description: "Recipient added successfully" });
    };

    const getRecipientDetails = (email: string) => {
        const user = users.find(u => u.email === email);
        return user ? `${user.name} (${user.batch})` : email;
    };

    return (
        <div className="flex min-h-screen bg-white">
            <AdminSidebar
                currentPage="bulk-email"
                showMobileMenu={showMobileMenu}
                onCloseMobileMenu={() => setShowMobileMenu(false)}
            />
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
                            <h2 className="text-xl font-semibold text-gray-900">Bulk Email</h2>
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

                {/* Main Content */}
                <div className="flex-1 overflow-auto">
                    <div className="container mx-auto py-8 px-4 lg:px-8">

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left Column: Selection & Filters */}
                            <div className="lg:col-span-2 space-y-6">
                                {step === 1 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center justify-between">
                                                <span>Select Recipients</span>
                                                <span className="text-sm font-normal text-gray-500">
                                                    {selectedUsers.length} selected of {users.length}
                                                </span>
                                            </CardTitle>
                                            <CardDescription>Filter and select users to send email updates.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {/* Filters */}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                                <div className="space-y-2">
                                                    <Label>User Role</Label>
                                                    <Select
                                                        value={filters.role}
                                                        onValueChange={(val) => setFilters(prev => ({ ...prev, role: val }))}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="All Roles" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">All Roles</SelectItem>
                                                            <SelectItem value="alumni">Alumni</SelectItem>
                                                            <SelectItem value="student">Student</SelectItem>
                                                            <SelectItem value="faculty">Faculty</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Graduation Year</Label>
                                                    <Select
                                                        value={filters.graduationYear}
                                                        onValueChange={(val) => setFilters(prev => ({ ...prev, graduationYear: val }))}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">All Years</SelectItem>
                                                            {Array.from({ length: 10 }, (_, i) => 2024 - i).map(year => (
                                                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Batch (Class)</Label>
                                                    <Select
                                                        value={filters.batch}
                                                        onValueChange={(val) => setFilters(prev => ({ ...prev, batch: val }))}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="All Batches" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">All Batches</SelectItem>
                                                            <SelectItem value="Class 10">Class 10</SelectItem>
                                                            <SelectItem value="Class 12">Class 12</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Department/Stream</Label>
                                                    <Select
                                                        value={filters.department}
                                                        onValueChange={(val) => setFilters(prev => ({ ...prev, department: val }))}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="All Streams" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">All Streams</SelectItem>
                                                            <SelectItem value="Science">Science</SelectItem>
                                                            <SelectItem value="Commerce">Commerce</SelectItem>
                                                            <SelectItem value="Humanities">Humanities</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* Users List */}
                                            <div className="border rounded-md overflow-hidden bg-white max-h-[500px] overflow-y-auto">
                                                {/* Header Row */}
                                                <div className="grid grid-cols-12 bg-gray-50 p-3 border-b text-sm font-medium sticky top-0">
                                                    <div className="col-span-1 flex items-center justify-center">
                                                        <Checkbox
                                                            checked={users.length > 0 && selectedUsers.length === users.length}
                                                            onCheckedChange={handleSelectAll}
                                                        />
                                                    </div>
                                                    <div className="col-span-4">Name</div>
                                                    <div className="col-span-4">Email</div>
                                                    <div className="col-span-3">Batch/Year</div>
                                                </div>

                                                {loading ? (
                                                    <div className="p-8 text-center text-gray-500">Loading users...</div>
                                                ) : users.length === 0 ? (
                                                    <div className="p-8 text-center text-gray-500">No users found matching filters.</div>
                                                ) : (
                                                    users.map((user) => (
                                                        <div key={user.id} className="grid grid-cols-12 p-3 border-b last:border-0 hover:bg-gray-50 transition-colors text-sm">
                                                            <div className="col-span-1 flex items-center justify-center">
                                                                <Checkbox
                                                                    checked={selectedUsers.includes(user.email)}
                                                                    onCheckedChange={(checked) => handleSelectUser(user.email, checked as boolean)}
                                                                />
                                                            </div>
                                                            <div className="col-span-4 font-medium truncate">{user.name}</div>
                                                            <div className="col-span-4 text-gray-600 truncate">{user.email}</div>
                                                            <div className="col-span-3 text-gray-500">{user.batch} ({user.graduationYear})</div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            <div className="mt-4 flex justify-end">
                                                <Button
                                                    onClick={() => setStep(2)}
                                                    disabled={selectedUsers.length === 0}
                                                    className="bg-[#008060]"
                                                >
                                                    Next: Compose Message <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                                                </Button>
                                            </div>

                                        </CardContent>
                                    </Card>
                                )}

                                {step === 2 && (
                                    <>
                                        {/* Recipients Card */}
                                        <Card className="mb-6">
                                            <CardHeader>
                                                <CardTitle className="flex items-center justify-between">
                                                    <span className="flex items-center gap-2">
                                                        <UserCheck className="w-5 h-5 text-[#008060]" />
                                                        Recipients
                                                    </span>
                                                    <span className="text-sm font-normal text-gray-500">
                                                        {selectedUsers.length} selected
                                                    </span>
                                                </CardTitle>
                                                <CardDescription>Manage who will receive this email</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {/* Add New Recipient */}
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Add recipient email..."
                                                        value={newRecipientEmail}
                                                        onChange={(e) => setNewRecipientEmail(e.target.value)}
                                                        onKeyPress={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddRecipient();
                                                            }
                                                        }}
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        onClick={handleAddRecipient}
                                                        variant="outline"
                                                        className="border-[#008060] text-[#008060] hover:bg-[#008060] hover:text-white"
                                                    >
                                                        <Plus className="w-4 h-4 mr-1" />
                                                        Add
                                                    </Button>
                                                </div>

                                                {/* Selected Recipients List */}
                                                <div className="border rounded-lg bg-gray-50 p-4 max-h-[300px] overflow-y-auto">
                                                    {selectedUsers.length === 0 ? (
                                                        <p className="text-center text-gray-500 py-4">No recipients selected</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {selectedUsers.map((email) => (
                                                                <div
                                                                    key={email}
                                                                    className="flex items-center justify-between bg-white p-3 rounded-md border border-gray-200 hover:border-[#008060] transition-colors group"
                                                                >
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-gray-900 truncate">
                                                                            {getRecipientDetails(email)}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500 truncate">{email}</p>
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleRemoveRecipient(email)}
                                                                        className="ml-2 text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Compose Message Card */}
                                        <Card>
                                            <CardHeader>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <CardTitle>Compose Message</CardTitle>
                                                        <CardDescription>Write your email content below</CardDescription>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                        <Checkbox
                                                            id="send-as-html"
                                                            checked={emailIsHtml}
                                                            onCheckedChange={(c) => setEmailIsHtml(!!c)}
                                                            className="data-[state=checked]:bg-[#008060] data-[state=checked]:border-[#008060]"
                                                        />
                                                        <Label htmlFor="send-as-html" className="text-sm font-medium cursor-pointer text-gray-700">Send as HTML</Label>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-semibold text-gray-700">Subject <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        value={emailSubject}
                                                        onChange={(e) => setEmailSubject(e.target.value)}
                                                        placeholder="Enter email subject"
                                                        className="focus-visible:ring-[#008060]"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-sm font-semibold text-gray-700">Message Body <span className="text-red-500">*</span></Label>
                                                    
                                                    {emailIsHtml ? (
                                                        <Tabs defaultValue="edit" className="w-full border rounded-lg overflow-hidden">
                                                            <TabsList className="w-full justify-start rounded-none border-b bg-gray-50/50 h-10 px-1">
                                                                <TabsTrigger value="edit" className="data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 text-xs font-medium">
                                                                    <Edit3 className="w-3.5 h-3.5" /> Edit Code
                                                                </TabsTrigger>
                                                                <TabsTrigger value="preview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 text-xs font-medium">
                                                                    <Eye className="w-3.5 h-3.5" /> Live Preview
                                                                </TabsTrigger>
                                                            </TabsList>
                                                            <TabsContent value="edit" className="m-0 border-0">
                                                                <Textarea
                                                                    value={emailBody}
                                                                    onChange={(e) => setEmailBody(e.target.value)}
                                                                    placeholder="Type your HTML message here..."
                                                                    className="min-h-[400px] font-mono text-sm border-0 focus-visible:ring-0 rounded-none resize-none bg-gray-900 text-gray-100 p-4"
                                                                />
                                                            </TabsContent>
                                                            <TabsContent value="preview" className="m-0 border-0 bg-gray-100 p-4 min-h-[400px]">
                                                                <div className="bg-white rounded-md shadow-sm border h-[400px] overflow-hidden">
                                                                    <iframe 
                                                                        srcDoc={emailBody} 
                                                                        title="Email Preview"
                                                                        className="w-full h-full border-0"
                                                                    />
                                                                </div>
                                                            </TabsContent>
                                                        </Tabs>
                                                    ) : (
                                                        <Textarea
                                                            value={emailBody}
                                                            onChange={(e) => setEmailBody(e.target.value)}
                                                            placeholder="Type your plain text message here..."
                                                            className="min-h-[300px] bg-gray-50 border-gray-200 focus-visible:ring-[#008060]"
                                                        />
                                                    )}
                                                    
                                                    <p className="text-[11px] text-gray-500 italic">
                                                        {emailIsHtml 
                                                            ? "HTML mode enabled. Use the Edit Code tab to modify the source and Live Preview to see the result." 
                                                            : "Plain text mode. Your message will be sent exactly as typed without any styling."}
                                                    </p>
                                                </div>

                                                <div className="flex justify-between pt-4 border-t border-gray-100">
                                                    <Button variant="outline" onClick={() => setStep(1)} className="hover:bg-gray-50">
                                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                                        Back to Selection
                                                    </Button>
                                                    <Button
                                                        onClick={handleSendEmail}
                                                        disabled={sending || selectedUsers.length === 0}
                                                        className="bg-[#008060] hover:bg-[#006b51] min-w-[140px] shadow-sm transform transition-transform active:scale-95"
                                                    >
                                                        {sending ? (
                                                            <>Sending Emails...</>
                                                        ) : (
                                                            <>Send to {selectedUsers.length} Recipients <Send className="w-4 h-4 ml-2" /></>
                                                        )}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </>
                                )}
                            </div>

                            {/* Right Column: Suggestions/Summary */}
                            <div className="space-y-6">
                                <Card className="bg-blue-50/50 border-blue-100">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                            Quick Stats
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm text-gray-600">
                                        <div className="flex justify-between">
                                            <span>Filtered Users:</span>
                                            <span className="font-semibold text-gray-900">{users.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Selected Users:</span>
                                            <span className="font-semibold text-[#008060]">{selectedUsers.length}</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                {step === 2 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Smart Templates</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Choose a Template</Label>
                                                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                                                    <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Custom Message</SelectItem>
                                                        <SelectItem value="welcome">Welcome Email</SelectItem>
                                                        <SelectItem value="event">Event Invitation</SelectItem>
                                                        <SelectItem value="update">Profile Update Reminder</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                Selecting a template will replace your current subject and body text.
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}

                                {step === 2 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">BCC Settings</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {!isBccEditable ? (
                                                <div className="space-y-2">
                                                    <Label>Current BCC Email</Label>
                                                    <div className="flex gap-2">
                                                        <Input value={bccEmail || "None"} disabled />
                                                        <Button variant="outline" onClick={() => setIsBccEditable(true)}>Edit</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="space-y-2">
                                                        <Label>Admin Password Required</Label>
                                                        <Input
                                                            type="password"
                                                            placeholder="Enter password..."
                                                            value={bccPassword}
                                                            onChange={(e) => setBccPassword(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>New BCC Email</Label>
                                                        <Input
                                                            type="text"
                                                            placeholder="Enter BCC email(s)..."
                                                            value={bccEmail}
                                                            onChange={(e) => setBccEmail(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button onClick={() => {
                                                            if (bccPassword !== "Kalyani_54321") {
                                                                toast({ title: "Error", description: "Incorrect password", variant: "destructive" });
                                                                return;
                                                            }
                                                            localStorage.setItem("bulkEmailBcc", bccEmail);
                                                            setIsBccEditable(false);
                                                            setBccPassword("");
                                                            toast({ title: "Success", description: "BCC Email updated successfully" });
                                                        }} className="bg-[#008060]">Save</Button>
                                                        <Button variant="ghost" onClick={() => {
                                                            setIsBccEditable(false);
                                                            setBccPassword("");
                                                            setBccEmail(localStorage.getItem("bulkEmailBcc") || "");
                                                        }}>Cancel</Button>
                                                    </div>
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-500">
                                                Copies of bulk emails will be kept at this address.
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
