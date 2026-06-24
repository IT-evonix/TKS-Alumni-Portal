import React, { useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bell, LogOut, Check, X, Info, Download, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface PreviewStudent {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  graduationYear: number;
  batch: string;
  course?: string;
  branch?: string;
  rollNumber?: string;
  cgpa?: string;
  currentCity?: string;
  currentCompany?: string;
  currentRole?: string;
  linkedinUrl?: string;
  university?: string;
  higherEducationCountry?: string;
}

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewStudent[] | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<any>(null);
  const [showPasswordWarning, setShowPasswordWarning] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { adminUser, logoutAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewData(null);
      setResults(null);
      setShowPasswordWarning(false);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file first",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/import-preview', {
        method: 'POST',
        headers: {
          'user-id': adminUser?.id || '',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setPreviewData(data.data);
        // Select all by default
        const allEmails = new Set<string>(data.data.map((s: PreviewStudent) => s.email));
        setSelectedEmails(allEmails);
        setShowPasswordWarning(false);
        toast({
          title: "File Processed",
          description: `Found ${data.data.length} valid records. Please review before saving.`,
        });
      } else {
        if (data.passwordRequired) {
          setShowPasswordWarning(true);
        }
        toast({
          title: "Processing Failed",
          description: data.error || "An error occurred while reading the file",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process file",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const handleToggleSelect = (email: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedEmails(newSelected);
  };

  const handleSelectAll = () => {
    if (previewData) {
      if (selectedEmails.size === previewData.length) {
        setSelectedEmails(new Set());
      } else {
        setSelectedEmails(new Set(previewData.map(s => s.email)));
      }
    }
  };

  const handleConfirmSave = async () => {
    if (!previewData || selectedEmails.size === 0) return;

    setSaving(true);
    const selectedStudents = previewData.filter(s => selectedEmails.has(s.email));

    try {
      const response = await fetch('/api/admin/import-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': adminUser?.id || '',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({ students: selectedStudents })
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.results);
        setPreviewData(null); // Clear preview after successful save
        toast({
          title: "Import Complete",
          description: `Successfully saved ${data.results.success} users.`,
        });
      } else {
        toast({
          title: "Save Failed",
          description: data.error || "An error occurred while saving data",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save data",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        "First Name": "John",
        "Last Name": "Doe",
        "Email": "john.doe.2024@example.com",
        "Phone": "+91 9876543210",
        "Graduation Year": 2024,
        "Batch": "Class 12",
        "Course": "Science",
        "Branch": "PCM",
        "Current City": "Pune",
        "University": "Savitaribai Phule Pune University",
        "Current Company": "Google",
        "Current Role": "Software Engineer"
      },
      {
        "First Name": "Jane",
        "Last Name": "Smith",
        "Email": "jane.smith.2023@example.com",
        "Phone": "+91 9123456789",
        "Graduation Year": 2023,
        "Batch": "Class 12",
        "Course": "Commerce",
        "Branch": "Finance",
        "Current City": "Mumbai",
        "University": "Mumbai University",
        "Current Company": "HDFC Bank",
        "Current Role": "Analyst"
      },
      {
        "First Name": "Ananya",
        "Last Name": "Iyer",
        "Email": "ananya.iyer.2022@example.com",
        "Phone": "+91 9988776655",
        "Graduation Year": 2022,
        "Batch": "Class 10",
        "Course": "Schooling",
        "Branch": "General",
        "Current City": "Bangalore",
        "University": "IISc Bangalore",
        "Current Company": "Microsoft",
        "Current Role": "Product Manager"
      },
      {
        "First Name": "Rahul",
        "Last Name": "Sharma",
        "Email": "rahul.sharma@example.com",
        "Phone": "+91 8877665544",
        "Graduation Year": 2025,
        "Batch": "Class 12",
        "Course": "Humanities",
        "Branch": "Economics",
        "Current City": "Delhi",
        "University": "Delhi University",
        "Current Company": "NITI Aayog",
        "Current Role": "Intern"
      },
      {
        "First Name": "Sneha",
        "Last Name": "Patel",
        "Email": "sneha.patel.21@example.com",
        "Phone": "+91 7766554433",
        "Graduation Year": 2021,
        "Batch": "Class 12",
        "Course": "Science",
        "Branch": "PCB",
        "Current City": "Ahmedabad",
        "University": "Gujarat University",
        "Current Company": "Zydus Cadila",
        "Current Role": "Research Scientist"
      },
      {
        "First Name": "Aditya",
        "Last Name": "Verma",
        "Email": "aditya.v@example.com",
        "Phone": "+91 6655443322",
        "Graduation Year": 2024,
        "Batch": "Class 12",
        "Course": "Commerce",
        "Branch": "Marketing",
        "Current City": "Chennai",
        "University": "IIT Madras",
        "Current Company": "Tesla",
        "Current Role": "Operations Lead"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sample Alumni Data");
    
    // Set column widths for better readability
    const wscols = [
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 15 }, // Graduation Year
      { wch: 12 }, // Batch
      { wch: 12 }, // Course
      { wch: 15 }, // Branch
      { wch: 15 }, // Current City
      { wch: 30 }, // University
      { wch: 20 }, // Current Company
      { wch: 20 }  // Current Role
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, "TKS_Alumni_Import_Sample.xlsx");
    
    toast({
      title: "Sample Downloaded",
      description: "Example Excel file has been saved to your downloads.",
    });
  };

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar currentPage="import" />
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
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900">Import Alumni Data</h2>
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
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Button>
                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
              </div>
              <Button
                variant="outline"
                className="text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                onClick={logoutAdmin}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-auto bg-gray-50/30">
          <div className="container mx-auto py-8 px-4 lg:px-8 max-w-7xl">
            
            {!previewData && !results && (
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b border-gray-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Download className="w-5 h-5 text-[#008060]" />
                    Upload Excel Sheet
                  </CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDownloadSample}
                    className="text-[#008060] border-[#008060] hover:bg-[#008060] hover:text-white transition-all gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Sample
                  </Button>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="max-w-xl mx-auto text-center space-y-6">
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 hover:border-[#008060]/50 transition-colors group">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                      />
                      <label 
                        htmlFor="file-upload"
                        className="cursor-pointer flex flex-col items-center gap-4"
                      >
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-[#008060]/10 transition-colors">
                          <Download className="w-8 h-8 text-gray-400 group-hover:text-[#008060]" />
                        </div>
                        {file ? (
                          <div className="text-[#008060] font-medium">{file.name}</div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-gray-600 font-medium">Click to upload or drag and drop</p>
                            <p className="text-xs text-gray-400">Excel files (.xlsx, .xls) up to 10MB</p>
                          </div>
                        )}
                      </label>
                    </div>

                    <Button
                      onClick={handlePreview}
                      disabled={!file || importing}
                      className="w-full h-12 bg-[#008060] hover:bg-[#006b51] text-white rounded-lg shadow-sm"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing File...
                        </>
                      ) : (
                        "Analyze & Fetch Users"
                      )}
                    </Button>
                  </div>

                  {showPasswordWarning && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Info className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-amber-900">Password Protected File</h4>
                        <p className="text-sm text-amber-700 mt-1">
                          Please remove the password protection from your Excel file before uploading. 
                          Go to File → Info → Protect Workbook → Encrypt with Password to clear it.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Student Info</h4>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="bg-gray-50">First Name</Badge>
                        <Badge variant="secondary" className="bg-gray-50">Last Name</Badge>
                        <Badge variant="secondary" className="bg-gray-50 text-[#008060]">Email (*)</Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Academic</h4>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="bg-gray-50">Batch</Badge>
                        <Badge variant="secondary" className="bg-gray-50">Year</Badge>
                        <Badge variant="secondary" className="bg-gray-50">Course</Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Location</h4>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="bg-gray-50">Current City</Badge>
                        <Badge variant="secondary" className="bg-gray-50">University</Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Professional</h4>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="bg-gray-50">Company</Badge>
                        <Badge variant="secondary" className="bg-gray-50">Role</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {previewData && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Review Data ({previewData.length} Users)</h3>
                    <p className="text-sm text-gray-500">Only selected users will be saved to the database.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setPreviewData(null)}
                      disabled={saving}
                      className="border-gray-200"
                    >
                      Discard
                    </Button>
                    <Button
                      onClick={handleConfirmSave}
                      disabled={selectedEmails.size === 0 || saving}
                      className="bg-[#008060] hover:bg-[#006b51] text-white px-8"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        `Confirm Import (${selectedEmails.size})`
                      )}
                    </Button>
                  </div>
                </div>

                <Card className="border-none shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50/50">
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox 
                              checked={previewData.length > 0 && selectedEmails.size === previewData.length}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Alumni Name</TableHead>
                          <TableHead>Email Address</TableHead>
                          <TableHead>Batch/Year</TableHead>
                          <TableHead>Major/Branch</TableHead>
                          <TableHead>Current City</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((student, idx) => (
                          <TableRow key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <TableCell>
                              <Checkbox 
                                checked={selectedEmails.has(student.email)}
                                onCheckedChange={() => handleToggleSelect(student.email)}
                              />
                            </TableCell>
                            <TableCell className="font-semibold text-gray-900">
                              {student.firstName} {student.lastName !== '.' ? student.lastName : ''}
                            </TableCell>
                            <TableCell className="text-gray-600">{student.email}</TableCell>
                            <TableCell>{student.batch} ({student.graduationYear})</TableCell>
                            <TableCell className="text-xs text-gray-500 truncate max-w-[150px]">
                              {student.course} {student.branch ? `- ${student.branch}` : ''}
                            </TableCell>
                            <TableCell>{student.currentCity || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            )}

            {results && (
              <Card className="border-none shadow-sm overflow-hidden animate-in zoom-in-95">
                <CardHeader className="bg-white border-b border-gray-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-bold">Import Summary</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setResults(null)}
                    className="text-[#008060]"
                  >
                    New Upload
                  </Button>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl border border-green-100">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <Check className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-700">{results.success}</div>
                          <div className="text-sm font-medium text-green-600">Successfully Imported</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                          <X className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-700">{results.failed}</div>
                          <div className="text-sm font-medium text-red-600">Failed Records</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 max-h-[400px] overflow-auto">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Detailed Logs
                      </h4>
                      {results.errors.length > 0 ? (
                        <ul className="space-y-3">
                          {results.errors.map((error: any, idx: number) => (
                            <li key={idx} className="text-sm text-red-600 flex gap-2">
                              <span className="opacity-50">•</span>
                              {error}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                          <Check className="w-8 h-8 opacity-20 mb-2" />
                          <p>All operations were successful</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
