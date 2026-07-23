import React, { useState, useMemo, useCallback, useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut, ArrowLeft, MapPin, Users, Globe, Layers, SlidersHorizontal, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import { useNotifications } from "@/contexts/NotificationContext";
import AlumniHeatMap from "@/components/AlumniHeatMap";

const LOCATION_TYPES = ["Home", "University", "Job", "Internship", "Other"];

export default function AdminAlumniMapPage() {
  const { adminUser, logoutAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  const [mapStats, setMapStats] = useState<{ totalAlumni: number; countries: number; continents: number } | null>(null);

  const [selectedRole, setSelectedRole] = useState<string>("alumni");
  const [selectedGraduationYear, setSelectedGraduationYear] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedLocationType, setSelectedLocationType] = useState<string>("all");

  // Directory options, sourced from an unfiltered admin fetch so dropdowns
  // always show the full universe of values regardless of active filters.
  const [directoryOptions, setDirectoryOptions] = useState<{
    graduationYears: string[];
    countries: string[];
    states: string[];
    cities: string[];
  }>({ graduationYears: [], countries: [], states: [], cities: [] });

  const authHeaders = useMemo(() => ({
    "user-id": adminUser?.id || "",
    Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
  }), [adminUser?.id]);

  useEffect(() => {
    if (!adminUser?.id) return;
    fetch(`/api/admin/alumni-map/map-data?role=alumni,student,faculty`, {
      cache: "no-store",
      headers: authHeaders,
    })
      .then(res => res.json())
      .then(data => {
        const alumni: any[] = data.alumni || [];
        const graduationYears = new Set<string>();
        const countries = new Set<string>();
        const states = new Set<string>();
        const cities = new Set<string>();
        alumni.forEach(a => {
          if (a.graduation_year) graduationYears.add(String(a.graduation_year));
          if (a.current_country) countries.add(a.current_country);
          if (a.current_state) states.add(a.current_state);
          if (a.current_city) cities.add(a.current_city);
        });
        setDirectoryOptions({
          graduationYears: Array.from(graduationYears).sort().reverse(),
          countries: Array.from(countries).sort(),
          states: Array.from(states).sort(),
          cities: Array.from(cities).sort(),
        });
      })
      .catch(err => console.error("[Admin Alumni Map] Failed to load directory options:", err));
  }, [adminUser?.id, authHeaders]);

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    setSelectedState("all");
    setSelectedCity("all");
  };

  const handleStateChange = (value: string) => {
    setSelectedState(value);
    setSelectedCity("all");
  };

  const handleResetFilters = () => {
    setSelectedRole("alumni");
    setSelectedGraduationYear("all");
    setSelectedCountry("all");
    setSelectedState("all");
    setSelectedCity("all");
    setSelectedLocationType("all");
  };

  const filters = useMemo(() => ({
    role: selectedRole,
    graduationYear: selectedGraduationYear !== "all" ? selectedGraduationYear : undefined,
    country: selectedCountry !== "all" ? selectedCountry : undefined,
    state: selectedState !== "all" ? selectedState : undefined,
    city: selectedCity !== "all" ? selectedCity : undefined,
    locationType: selectedLocationType !== "all" ? selectedLocationType : undefined,
  }), [selectedRole, selectedGraduationYear, selectedCountry, selectedState, selectedCity, selectedLocationType]);

  const activeFilterCount = [
    selectedRole !== "alumni",
    selectedGraduationYear !== "all",
    selectedCountry !== "all",
    selectedState !== "all",
    selectedCity !== "all",
    selectedLocationType !== "all",
  ].filter(Boolean).length;

  return (
    <div className="flex min-h-screen bg-white">
      <AdminSidebar currentPage="alumni-map" />

      <div className="flex-1 flex flex-col">
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
              <h2 className="text-xl font-semibold text-gray-900">Global Network</h2>
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
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
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
                onClick={() => logoutAdmin()}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{adminUser?.username || "Admin"}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-[#008060] to-[#006b51] rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold">{adminUser?.username?.charAt(0).toUpperCase() || "A"}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 bg-gray-50/50 overflow-y-auto">
          <div className="max-w-7xl mx-auto">

            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-[#008060]" />
                    Global Network
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Explore alumni, students, and faculty across the world map
                  </p>
                </div>
                {mapStats && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: <Users className="w-3.5 h-3.5 text-[#008060]" />, value: mapStats.totalAlumni, label: "People" },
                      { icon: <Globe className="w-3.5 h-3.5 text-[#008060]" />, value: mapStats.countries, label: "Countries" },
                      { icon: <Layers className="w-3.5 h-3.5 text-[#008060]" />, value: mapStats.continents, label: "Continents" },
                    ].map(chip => (
                      <div
                        key={chip.label}
                        className="flex items-center gap-1.5 bg-[#008060]/[0.06] border border-[#008060]/20 rounded-full px-3 py-1"
                      >
                        {chip.icon}
                        <span className="text-xs font-bold text-gray-800 tabular-nums">{chip.value}</span>
                        <span className="text-xs text-gray-500">{chip.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Card className="mb-6 border-0 shadow-sm bg-white">
              <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3 border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between">
                <CardTitle className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-gray-500" />
                  Filter Global Network
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="bg-[#008060]/10 text-[#008060] border-0 ml-1">
                      {activeFilterCount} active
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  disabled={activeFilterCount === 0}
                  className="text-xs h-8 text-gray-600 hover:text-[#008060]"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Reset
                </Button>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Role</label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="Alumni" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alumni">Alumni</SelectItem>
                        <SelectItem value="student">Students</SelectItem>
                        <SelectItem value="faculty">Faculty</SelectItem>
                        <SelectItem value="alumni,student,faculty">Everyone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Graduation Year</label>
                    <Select value={selectedGraduationYear} onValueChange={setSelectedGraduationYear} disabled={directoryOptions.graduationYears.length === 0}>
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="All Years" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {directoryOptions.graduationYears.map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Country</label>
                    <Select value={selectedCountry} onValueChange={handleCountryChange} disabled={directoryOptions.countries.length === 0}>
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="All Countries" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Countries</SelectItem>
                        {directoryOptions.countries.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">State / Province</label>
                    <Select value={selectedState} onValueChange={handleStateChange} disabled={directoryOptions.states.length === 0}>
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="All States" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        {directoryOptions.states.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">City</label>
                    <Select value={selectedCity} onValueChange={setSelectedCity} disabled={directoryOptions.cities.length === 0}>
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="All Cities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Cities</SelectItem>
                        {directoryOptions.cities.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Location Type</label>
                    <Select value={selectedLocationType} onValueChange={setSelectedLocationType}>
                      <SelectTrigger className="bg-white border-gray-200">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {LOCATION_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <AlumniHeatMap
              apiEndpoint="/api/admin/alumni-map/map-data"
              filters={filters}
              authHeaders={authHeaders}
              onDataLoad={setMapStats}
            />

          </div>
        </main>
      </div>
    </div>
  );
}
