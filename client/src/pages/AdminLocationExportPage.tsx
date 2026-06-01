import React, { useState, useEffect, useMemo } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, MapPin, Search, ChevronLeft, ChevronRight, BarChart2, Users as UsersIcon, Bell, ArrowLeft, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";

export default function AdminLocationExportPage() {
  const { adminUser, logoutAdmin } = useAuth();
  const { toast } = useToast();
  
  const [, setLocation] = useLocation();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);

  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    if (!adminUser?.id) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users/export", {
        headers: {
          "user-id": adminUser.id,
          "Authorization": `Bearer ${localStorage.getItem('auth_token') || ''}`,
        }
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users for export:", error);
      toast({
        title: "Error",
        description: "Failed to load users for location export.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Derive unique locations freely (no strict dependencies)
  const { countries, states, cities } = useMemo(() => {
    const uniqueCountries = new Set<string>();
    const uniqueStates = new Set<string>();
    const uniqueCities = new Set<string>();

    users.forEach(user => {
      const country = user.current_country?.trim();
      const state = user.current_state?.trim();
      const city = user.current_city?.trim();

      if (country) uniqueCountries.add(country);
      if (state) uniqueStates.add(state);
      if (city) uniqueCities.add(city);
    });

    return {
      countries: Array.from(uniqueCountries).sort(),
      states: Array.from(uniqueStates).sort(),
      cities: Array.from(uniqueCities).sort()
    };
  }, [users]);

  // Filter users based on selection
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const countryMatch = selectedCountry === "all" || user.current_country?.trim() === selectedCountry;
      const stateMatch = selectedState === "all" || user.current_state?.trim() === selectedState;
      const cityMatch = selectedCity === "all" || user.current_city?.trim() === selectedCity;
      const roleMatch = selectedRole === "all" || user.user_role === selectedRole;
      return countryMatch && stateMatch && cityMatch && roleMatch;
    });
  }, [users, selectedCountry, selectedState, selectedCity, selectedRole]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCountry, selectedState, selectedCity, selectedRole]);

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
  };

  const handleStateChange = (value: string) => {
    setSelectedState(value);
    if (value !== "all") {
      // Auto-fill country
      const matchedUser = users.find(u => u.current_state?.trim() === value);
      if (matchedUser?.current_country) {
        setSelectedCountry(matchedUser.current_country.trim());
      }
    }
  };

  const handleCityChange = (value: string) => {
    setSelectedCity(value);
    if (value !== "all") {
      // Auto-fill state and country
      const matchedUser = users.find(u => u.current_city?.trim() === value);
      if (matchedUser) {
        if (matchedUser.current_state) setSelectedState(matchedUser.current_state.trim());
        if (matchedUser.current_country) setSelectedCountry(matchedUser.current_country.trim());
      }
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Username",
      "Email",
      "First Name",
      "Last Name",
      "Role",
      "Graduation Year",
      "Batch",
      "Branch",
      "Country",
      "State",
      "City",
      "Full Location Label"
    ];

    const csvData = filteredUsers.map((user: any) => [
      user.username || "",
      user.email || "",
      user.first_name || "",
      user.last_name || "",
      user.user_role || "Alumni",
      user.graduation_year || "",
      user.batch || "",
      user.branch || "",
      user.current_country || "",
      user.current_state || "",
      user.current_city || "",
      user.location_label || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alumni_location_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredUsers.length} users to CSV`,
    });
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Shared Admin Sidebar */}
      <AdminSidebar currentPage="location-export" />

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
              <h2 className="text-xl font-semibold text-gray-900">Location Export</h2>
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

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 bg-gray-50/50 overflow-y-auto">
          <div className="max-w-7xl mx-auto">

          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-[#008060]" />
                  Location Export
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Filter alumni by geographic location and export their data
                </p>
              </div>
            </div>
          </div>

          <Card className="mb-6 border-0 shadow-sm bg-white">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3 border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                <Search className="w-5 h-5 text-gray-500" />
                Search & Filter Locations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">User Role</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole} disabled={loading}>
                    <SelectTrigger className="bg-white border-gray-200">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="alumni">Alumni</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="faculty">Faculty</SelectItem>
                      <SelectItem value="administrator">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Country</label>
                  <Select value={selectedCountry} onValueChange={handleCountryChange} disabled={loading}>
                    <SelectTrigger className="bg-white border-gray-200">
                      <SelectValue placeholder="All Countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {countries.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">State / Province</label>
                  <Select value={selectedState} onValueChange={handleStateChange} disabled={loading || states.length === 0}>
                    <SelectTrigger className="bg-white border-gray-200">
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {states.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">City</label>
                  <Select value={selectedCity} onValueChange={handleCityChange} disabled={loading || cities.length === 0}>
                    <SelectTrigger className="bg-white border-gray-200">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {cities.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Badge variant="secondary" className="bg-[#008060]/10 text-[#008060] hover:bg-[#008060]/20 border-0">
                  <span className="w-2 h-2 rounded-full bg-[#008060] mr-2"></span>
                  Showing {filteredUsers.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
                </Badge>
              </div>

            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mr-2">
              <Download className="w-4 h-4 text-orange-500" />
              Export Data:
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={exportToCSV}
                disabled={loading || filteredUsers.length === 0}
                className="bg-[#008060] hover:bg-[#006b51] text-white shadow-sm transition-all hover:shadow"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart2 className="w-4 h-4 mr-2" />}
                Export to CSV
              </Button>
            </div>
          </div>

          <Card className="border-0 shadow-xl bg-white overflow-hidden rounded-2xl ring-1 ring-gray-100">
            <CardHeader className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#008060]/20">
                  <UsersIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span>Location Directory</span>
                  <span className="text-xs font-normal text-gray-500 mt-0.5">Preview location export data</span>
                </div>
              </CardTitle>
              <Badge variant="outline" className="px-3 py-1 bg-white border-gray-200 text-gray-600 shadow-sm">
                {filteredUsers.length} Total Users
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full max-w-[100vw] sm:max-w-full overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <Table className="w-full table-fixed">
                    <TableHeader className="bg-gray-50/80">
                      <TableRow className="border-b border-gray-100 hover:bg-transparent">
                        <TableHead className="w-[220px] pl-6 h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">User</TableHead>
                        <TableHead className="w-[200px] h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</TableHead>
                        <TableHead className="w-[150px] h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">Country</TableHead>
                        <TableHead className="w-[150px] h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">State</TableHead>
                        <TableHead className="w-[150px] h-14 text-xs font-bold text-gray-500 uppercase tracking-wider">City</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                              <div className="relative">
                                <div className="w-16 h-16 border-4 border-gray-100 rounded-full"></div>
                                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#008060] rounded-full border-t-transparent animate-spin"></div>
                              </div>
                              <p className="text-gray-500 font-medium animate-pulse">Loading directory...</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : paginatedUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <MapPin className="w-10 h-10 text-gray-300" />
                              </div>
                              <h3 className="text-lg font-bold text-gray-900">No users found</h3>
                              <p className="text-gray-500 text-sm max-w-xs mt-1">Try adjusting your filters to find what you're looking for.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedUsers.map((user) => (
                          <TableRow key={user.id} className="group transition-all border-b border-gray-50 hover:bg-blue-50/30">
                            <TableCell className="pl-6 py-4 font-medium text-gray-900 truncate">
                              {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                            </TableCell>
                            <TableCell className="py-4 text-gray-600 truncate">{user.email}</TableCell>
                            <TableCell className="py-4 text-gray-600 truncate">{user.current_country || "-"}</TableCell>
                            <TableCell className="py-4 text-gray-600 truncate">{user.current_state || "-"}</TableCell>
                            <TableCell className="py-4 text-gray-600 truncate">{user.current_city || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Footer */}
                {totalPages > 0 && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 font-medium order-2 sm:order-1">
                      Displaying <span className="text-gray-900 font-bold">{filteredUsers.length > 0 ? startIndex + 1 : 0}</span> to <span className="text-gray-900 font-bold">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> of <span className="text-[#008060] font-bold">{filteredUsers.length}</span> records
                    </div>
                    <div className="flex items-center gap-1.5 order-1 sm:order-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1 || loading}
                        className="h-8 w-8 p-0 border-gray-200"
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                        className="h-8 px-3 border-gray-200 text-xs font-semibold"
                      >
                        Prev
                      </Button>

                      <div className="flex items-center gap-1 mx-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) pageNum = i + 1;
                          else if (currentPage <= 3) pageNum = i + 1;
                          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                          else pageNum = currentPage - 2 + i;

                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`h-8 w-8 p-0 text-xs font-bold ${currentPage === pageNum ? "bg-[#008060] hover:bg-[#006b51] shadow-sm text-white" : "border-gray-200 hover:bg-gray-100 text-gray-900"}`}
                              disabled={loading}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages || loading}
                        className="h-8 px-3 border-gray-200 text-xs font-semibold"
                      >
                        Next
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages || loading}
                        className="h-8 w-8 p-0 border-gray-200"
                      >
                        »
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
      </div>
    </div>
  );
}
