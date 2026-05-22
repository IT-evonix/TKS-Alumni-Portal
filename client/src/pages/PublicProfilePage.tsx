import React, { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  GraduationCap,
  Linkedin,
  Calendar,
  Download,
  Share2,
  UserPlus,
  UserMinus,
  Check,
  MessageSquare,
  ArrowLeft,
  Globe,
  Award,
  Layers,
  Code,
  BookOpen,
  Trophy,
  Star,
  ExternalLink,
  Github,
  Twitter,
  Heart,
  X,
  CheckCircle2,
  BadgeCheck,
  Users,
  FileText,
  TrendingUp,
  Tag,
  Sparkles,
  Rocket,
  Printer
} from "lucide-react";
import { format } from "date-fns";
import { BackButton } from "@/components/common/BackButton";

export const PublicProfilePage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/profile/:userId");
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'connected'>('none');
  const [isRequester, setIsRequester] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  const getAuthHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
    const currentUserId = currentUser?.id || localStorage.getItem('userId') || '';
    const token = localStorage.getItem('auth_token') || '';

    return {
      ...extraHeaders,
      'user-id': currentUserId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // userId from params can be either the UUID auth.users.id or a legacy alumni ID
  // The backend handles both.
  const routeUserId = params?.userId;

  useEffect(() => {
    if (!routeUserId) return;

    // Reset state when navigating to a different profile
    setProfile(null);
    setLoading(true);
    setConnectionStatus('none');
    setIsRequester(false);

    const abortController = new AbortController();
    const { signal } = abortController;

    const fetchPublicProfile = async () => {
      try {
        const response = await fetch(`/api/alumni/public/${routeUserId}`, {
          headers: getAuthHeaders(),
          signal,
        });

        if (signal.aborted) return;

        if (response.ok) {
          const data = await response.json();
          if (!signal.aborted) {
            setProfile(data.profile);
          }
        } else {
          if (!signal.aborted) {
            toast({
              title: "Error",
              description: "Failed to load profile",
              variant: "destructive",
            });
            setLocation('/feed');
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        console.error('Error fetching public profile:', error);
        if (!signal.aborted) {
          toast({
            title: "Error",
            description: "Failed to load profile",
            variant: "destructive",
          });
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    const checkConnectionStatus = async () => {
      if (!currentUser?.id) return;
      try {
        const response = await fetch(`/api/connections/status/${routeUserId}`, {
          headers: getAuthHeaders(),
          signal,
        });

        if (signal.aborted) return;

        if (response.ok) {
          const data = await response.json();
          if (!signal.aborted) {
            setConnectionStatus(data.status);
            setIsRequester(data.status === 'pending' ? !!data.isRequester : false);
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        console.error('Error checking connection status:', error);
      }
    };

    fetchPublicProfile();
    checkConnectionStatus();

    return () => {
      abortController.abort();
    };
  }, [routeUserId, currentUser?.id]);

  const handleSendConnectionRequest = async () => {
    if (!currentUser?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to send connection requests",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingRequest(true);
      const response = await fetch('/api/connections/request', {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          recipientId: profile?.user_id || routeUserId, // Use the proper UserID
          message: `Hi ${profile?.first_name}, I'd like to connect with you on the alumni network.`
        })
      });

      if (response.ok) {
        setConnectionStatus('pending');
        setIsRequester(true);
        toast({
          title: "Success",
          description: "Connection request sent!",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to send connection request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      toast({
        title: "Error",
        description: "Failed to send connection request",
        variant: "destructive",
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const handleWithdrawRequest = async () => {
    if (!currentUser?.id) return;

    try {
      setSendingRequest(true);
      const response = await fetch('/api/connections/request', {
        method: 'DELETE',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          recipientId: profile?.user_id || routeUserId
        })
      });

      if (response.ok) {
        setConnectionStatus('none');
        setIsRequester(false);
        toast({
          title: "Success",
          description: "Connection request withdrawn",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to withdraw connection request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error withdrawing connection request:', error);
      toast({
        title: "Error",
        description: "Failed to withdraw connection request",
        variant: "destructive",
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentUser?.id) return;

    if (!confirm(`Are you sure you want to disconnect from ${profile?.first_name}?`)) return;

    try {
      setSendingRequest(true);
      const response = await fetch('/api/connections/connection', {
        method: 'DELETE',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          targetUserId: profile?.user_id || routeUserId
        })
      });

      if (response.ok) {
        setConnectionStatus('none');
        setIsRequester(false);
        toast({
          title: "Disconnected",
          description: `You are no longer connected with ${profile?.first_name}.`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to disconnect",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect",
        variant: "destructive",
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const getProfilePicture = () => {
    if (profile?.profile_picture && typeof profile.profile_picture === 'string' && profile.profile_picture.trim() !== '') {
      return profile.profile_picture;
    }

    // Fallback to LinkedIn photo if manual profile picture is missing
    if (profile?.linkedin_photo_url && typeof profile.linkedin_photo_url === 'string' && profile.linkedin_photo_url.trim() !== '') {
      return profile.linkedin_photo_url;
    }

    const firstName = (profile?.firstName || '').toString();
    const lastName = (profile?.lastName || '').toString();
    const displayName = `${firstName} ${lastName}`.trim() || 'User';
    const seed = encodeURIComponent(displayName);

    const gender = profile?.gender || 'default';
    switch (gender) {
      case 'male':
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      case 'female':
        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      case 'other':
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
      default:
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="text-gray-600">Profile not found</p>
              <Button
                onClick={() => setLocation('/feed')}
                variant="brand"
                className="mt-4"
              >
                Go to Feed
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const firstName = (profile?.firstName || profile?.first_name || '').toString();
  const lastName = (profile?.lastName || profile?.last_name || '').toString();
  const displayName = `${firstName} ${lastName}`.trim() || 'User';
  // Check both direct ID match (if userId was UserID) and profile.user_id (if userId was AlumniID)
  const isOwnProfile = currentUser?.id === profile?.user_id || currentUser?.id === routeUserId;

  const graduationYearDisplay = profile.graduation_year || profile.graduationYear || profile.batch || 'N/A';
  const roleValue = String(profile?.user_role || (isOwnProfile ? currentUser?.user_role : "") || "").toLowerCase();
  const roleTag = roleValue === "faculty"
    ? { label: "Faculty", className: "bg-indigo-100 text-indigo-800 border-indigo-200" }
    : roleValue === "student"
      ? { label: "Student", className: "bg-emerald-100 text-emerald-800 border-emerald-200" }
      : (roleValue === "administrator" || roleValue === "admin")
        ? { label: "Administrator", className: "bg-purple-100 text-purple-800 border-purple-200" }
        : roleValue === "user"
          ? { label: "User", className: "bg-gray-100 text-gray-800 border-gray-200" }
          : { label: "Alumni", className: "bg-amber-100 text-amber-800 border-amber-200" };

  // Parse JSON fields safely
  const parseList = (data: any): string[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const expertise = parseList(profile.expertiseAreas || profile.expertise_areas);
  const volunteerInterests = parseList(profile.volunteerInterests || profile.volunteer_interests);

  // --- Subcomponents for Clean Layout ---

  const ExperienceItem = ({ exp }: { exp: any }) => (
    <div className="relative pl-8 pb-8 border-l border-gray-200 last:border-0 last:pb-0">
      <div className="absolute left-[-8px] top-1 w-4 h-4 bg-[#008060] rounded-full border-4 border-white shadow-sm" />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{exp.position}</h3>
          <p className="text-[#008060] font-medium">{exp.company_name} {exp.industry && <span className="text-gray-400 font-normal text-xs ml-1">• {exp.industry}</span>}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>
              {format(new Date(exp.start_date), 'MMM yyyy')} - {exp.is_current ? 'Present' : (exp.end_date ? format(new Date(exp.end_date), 'MMM yyyy') : '')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 justify-end">
            {exp.location && <span className="text-xs">{exp.location}</span>}
            {(exp.location && (exp.location_type || exp.employment_type)) && <span className="text-xs text-gray-400">•</span>}
            {exp.location_type && <span className="text-xs">{exp.location_type}</span>}
            {(exp.location_type && exp.employment_type) && <span className="text-xs text-gray-400">•</span>}
            {exp.employment_type && <span className="text-xs">{exp.employment_type}</span>}
          </div>
        </div>
      </div>
      {exp.description && <p className="mt-2 text-gray-600 text-sm whitespace-pre-wrap">{exp.description}</p>}

      {(exp.responsibilities && exp.responsibilities.length > 0) && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Responsibilities</p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-0.5 ml-1">
            {exp.responsibilities.map((item: string, idx: number) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        </div>
      )}
      {exp.skills_used && exp.skills_used.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {exp.skills_used.map((skill: string, idx: number) => (
            <Badge key={idx} variant="secondary" className="text-xs bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100 transition-colors">
              {skill}
            </Badge>
          ))}
        </div>
      )}
      {(exp.achievements && exp.achievements.length > 0) && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Key Achievements</p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-0.5 ml-1">
            {exp.achievements.map((item: string, idx: number) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const ProjectCard = ({ project }: { project: any }) => (
    <Card className={`h-full hover:shadow-lg transition-all duration-300 border-l-4 ${project.is_ongoing ? 'border-l-teal-500' : 'border-l-blue-400'}`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <h3 className="font-semibold text-lg text-gray-900">{project.project_name}</h3>
            {project.is_ongoing && (
              <Badge variant="outline" className="w-fit mt-1 bg-teal-50 text-teal-700 border-teal-200 text-[10px] py-0 px-1.5 h-auto uppercase tracking-wider font-semibold">
                Ongoing
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {project.github_url && (
              <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                <Github className="w-5 h-5" />
              </a>
            )}
            {project.project_url && (
              <a href={project.project_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#008060] transition-colors">
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3 items-center text-xs text-gray-500">
          {project.role && <Badge variant="outline" className="text-xs font-normal bg-gray-50">{project.role}</Badge>}
          {project.team_size && (
            <Badge variant="outline" className="text-[10px] font-normal border-gray-100 text-gray-400">
              Team: {project.team_size}
            </Badge>
          )}
          {project.start_date && (
            <div className="flex items-center gap-1 ml-1 text-[10px]">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(project.start_date), 'MMM yyyy')}</span>
              {project.is_ongoing ? <span> - Present</span> : (project.end_date && <span> - {format(new Date(project.end_date), 'MMM yyyy') || ''}</span>)}
            </div>
          )}
        </div>

        {project.image_urls && project.image_urls.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
            {project.image_urls.map((url: string, idx: number) => (
              <img key={idx} src={url} alt={`Project ${idx}`} className="w-20 h-14 object-cover rounded border border-gray-100 shadow-sm shrink-0" />
            ))}
          </div>
        )}

        <p className="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed">{project.description}</p>

        {project.your_contribution && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-tight">My Contribution</h4>
            <p className="text-xs text-gray-600 leading-relaxed italic">{project.your_contribution}</p>
          </div>
        )}

        {project.outcomes && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-tight">Outcomes</h4>
            <p className="text-xs text-gray-600 leading-relaxed">{project.outcomes}</p>
          </div>
        )}

        {project.technologies_used && (
          <div className="flex flex-wrap gap-1.5">
            {project.technologies_used.map((tech: string, i: number) => (
              <span key={i} className="text-[10px] font-medium bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded-full border border-gray-100">
                {tech}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50/50 p-4 sm:p-8 animate-in fade-in duration-500">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Back Button */}
          <div className="mb-4 sm:mb-6">
            <BackButton />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* === LEFT COLUMN: Profile Summary === */}
            <div className="lg:col-span-4 space-y-6">

              {/* Profile Card */}
              <Card className="border-0 shadow-sm overflow-hidden sticky top-6 z-10">
                <div className="h-32 bg-gradient-to-r from-[#008060] to-[#004d3a] relative">
                  <div className={`absolute top-3 right-3 inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm ${roleTag.className}`}>
                    {roleTag.label}
                  </div>
                </div>
                <CardContent className="relative pt-0 px-6 pb-6 z-10 bg-white">
                  <div className="-mt-16 mb-4 flex justify-between items-end relative z-20">
                    <Avatar className="w-32 h-32 border-4 border-white shadow-md bg-white relative z-30">
                      <AvatarImage src={getProfilePicture()} className="object-cover" />
                      <AvatarFallback className="text-4xl bg-gray-100 text-[#008060]">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Action Buttons for Mobile (Header) */}
                    {!isOwnProfile && currentUser && (
                      <div className="flex gap-2 mb-2 lg:hidden">
                        {connectionStatus === 'none' && (
                          <Button size="sm" onClick={handleSendConnectionRequest} disabled={sendingRequest} className="bg-[#008060]">
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setLocation(`/inbox?user=${profile.user_id}`)}>
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        {displayName}
                        {profile.is_verified && (
                          <BadgeCheck className="w-6 h-6 text-[#008060] fill-[#008060]/10" />
                        )}
                        {profile.isStartupFounder && (
                          <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 shadow-sm ml-1">
                            <Rocket className="w-3 h-3 mr-1" />
                            Founder
                          </div>
                        )}
                      </h1>
                      {profile.is_batch_champion && (
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 border border-amber-200 shadow-sm animate-pulse">
                          <Trophy className="w-3 h-3 mr-1 text-amber-600" />
                          Batch Champion
                        </div>
                      )}
                    </div>
                    {(profile.current_position || profile.current_role) ? (
                      <p className="text-gray-700 font-medium">
                        {profile.current_position || profile.current_role}
                        {profile.current_company && <span className="text-gray-500"> at {profile.current_company}</span>}
                      </p>
                    ) : (
                      <p className="text-gray-500">Alumni Member</p>
                    )}

                    {(profile.location || profile.current_city) && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                        <MapPin className="w-4 h-4" />
                        {[profile.current_city, profile.current_state, profile.current_country].filter(Boolean).join(', ') || profile.location}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <GraduationCap className="w-4 h-4" />
                      Class of {graduationYearDisplay}
                    </div>
                    {profile.employmentStatus && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Briefcase className="w-4 h-4 text-blue-400" />
                        {profile.employmentStatus}
                      </div>
                    )}
                    {profile.timezone && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Globe className="w-4 h-4 text-indigo-400" />
                        {profile.timezone}
                      </div>
                    )}
                    {/* Additional Details */}
                    {profile.industry && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                        <Building2 className="w-4 h-4" />
                        {profile.industry}
                      </div>
                    )}
                    {profile.yearsOfExperience && profile.yearsOfExperience > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <Briefcase className="w-4 h-4" />
                        {profile.yearsOfExperience} Years Experience
                      </div>
                    )}

                    {/* Connection Stats */}
                    {(profile.totalConnections > 0 || profile.mutualConnections > 0) && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-4 text-sm">
                          {profile.totalConnections > 0 && (
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <Users className="w-4 h-4 text-[#008060]" />
                              <span className="font-medium">{profile.totalConnections}</span>
                              <span className="text-gray-400">connections</span>
                            </div>
                          )}
                          {profile.mutualConnections > 0 && currentUser && (
                            <div className="flex items-center gap-1.5 text-[#008060] bg-[#008060]/5 px-2 py-1 rounded-full">
                              <Users className="w-3.5 h-3.5" />
                              <span className="font-semibold text-xs">{profile.mutualConnections} mutual</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Desktop Actions */}
                  {!isOwnProfile && currentUser && (
                    <div className="mt-6 flex flex-col gap-3">
                      {connectionStatus === 'none' && (
                        <Button
                          onClick={handleSendConnectionRequest}
                          disabled={sendingRequest}
                          variant="brand"
                          className="w-full"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          {sendingRequest ? 'Sending...' : 'Connect'}
                        </Button>
                      )}

                      {connectionStatus === 'pending' && (
                        isRequester ? (
                          <Button
                            onClick={handleWithdrawRequest}
                            disabled={sendingRequest}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 w-full font-medium transition-colors"
                          >
                            <X className="w-4 h-4 mr-2" />
                            {sendingRequest ? 'Withdrawing...' : 'Withdraw Request'}
                          </Button>
                        ) : (
                          <Button variant="outline" disabled className="w-full bg-gray-50">
                            <UserPlus className="w-4 h-4 mr-2" />
                            Pending
                          </Button>
                        )
                      )}

                      {connectionStatus === 'connected' && (
                        <Button
                          variant="outline"
                          onClick={handleDisconnect}
                          className="w-full border-[#008060] text-[#008060] bg-[#008060]/5 hover:bg-red-50 hover:text-red-600 hover:border-red-600 transition-colors group/disconnect"
                          disabled={sendingRequest}
                        >
                          <span className="group-hover/disconnect:hidden flex items-center">
                            <Check className="w-4 h-4 mr-2" />
                            Connected
                          </span>
                          <span className="hidden group-hover/disconnect:flex items-center">
                            <UserMinus className="w-4 h-4 mr-2" />
                            Disconnect
                          </span>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => setLocation(`/inbox?user=${profile.user_id}`)}
                        className="w-full"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                    </div>
                  )}

                  {isOwnProfile && (
                    <Button onClick={() => setLocation('/profile')} variant="outline" className="w-full mt-6">
                      Edit Profile
                    </Button>
                  )}

                  {/* Contact Info Section */}
                  <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">Contact Info</h3>
                    {/* Always show email/phone for own profile, otherwise respect privacy settings */}
                    {((isOwnProfile || profile.show_email) && profile.email) && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${profile.email}`} className="hover:text-[#008060] truncate">{profile.email}</a>
                      </div>
                    )}
                    {((isOwnProfile || profile.show_phone) && profile.phone) && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${profile.phone}`} className="hover:text-[#008060]">{profile.phone}</a>
                      </div>
                    )}
                    {profile.linkedinUrl && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Linkedin className="w-4 h-4" />
                        <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="hover:text-[#008060] truncate">LinkedIn Profile</a>
                      </div>
                    )}
                    {profile.githubUrl && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Github className="w-4 h-4" />
                        <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="hover:text-[#008060] truncate">GitHub Profile</a>
                      </div>
                    )}
                    {profile.twitterUrl && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Twitter className="w-4 h-4" />
                        <a href={profile.twitterUrl} target="_blank" rel="noreferrer" className="hover:text-[#008060] truncate">Twitter / X</a>
                      </div>
                    )}
                    {profile.personalWebsite && (
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Globe className="w-4 h-4" />
                        <a href={profile.personalWebsite} target="_blank" rel="noreferrer" className="hover:text-[#008060] truncate">Website</a>
                      </div>
                    )}
                  </div>

                  {/* Share/Download */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const vCard = `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nEMAIL:${profile.showEmail ? profile.email : ''}\nTEL:${profile.showPhone ? profile.phone : ''}\nEND:VCARD`;
                        const blob = new Blob([vCard], { type: 'text/vcard' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${displayName.replace(/\s+/g, '_')}.vcf`;
                        a.click();
                      }}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      vCard
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: `${displayName} - Alumni Profile`,
                            text: `Check out ${displayName}'s profile on TKS Alumni Portal`,
                            url: window.location.href,
                          }).catch(() => {
                            // Fallback to clipboard
                            navigator.clipboard.writeText(window.location.href);
                            toast({ title: "Profile link copied!" });
                          });
                        } else {
                          navigator.clipboard.writeText(window.location.href);
                          toast({ title: "Profile link copied!" });
                        }
                      }}
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      Share
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        window.print();
                      }}
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      Print
                    </Button>
                  </div>

                  {/* Languages Section */}
                  {profile.languages && profile.languages.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Languages</h3>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        {profile.languages.map((lang: any) => (
                          <div
                            key={lang.id}
                            className={`relative flex flex-col p-2 sm:p-3 rounded-lg border transition-all hover:shadow-sm ${lang.is_native
                              ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-200'
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                              } min-w-[100px] sm:min-w-[140px] w-[calc(50%-0.25rem)] sm:w-auto`}
                          >
                            {/* Language Name and Native Badge */}
                            <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                              <span className={`font-semibold text-xs sm:text-sm leading-tight truncate flex-1 min-w-0 ${lang.is_native ? 'text-indigo-900' : 'text-gray-900'}`}>
                                {lang.language_name}
                              </span>
                              {lang.is_native && (
                                <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wide bg-indigo-200 text-indigo-700 whitespace-nowrap shrink-0">
                                  Native
                                </span>
                              )}
                            </div>

                            {/* Proficiency Level */}
                            <span className={`text-[10px] sm:text-xs mb-1.5 sm:mb-2.5 capitalize ${lang.is_native ? 'text-indigo-600' : 'text-gray-500'}`}>
                              {lang.proficiency_level}
                            </span>

                            {/* Skills Indicators */}
                            <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-auto">
                              {lang.can_speak && (
                                <span className={`inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-medium ${lang.is_native
                                  ? 'bg-indigo-200/60 text-indigo-700 border border-indigo-300/50'
                                  : 'bg-white text-gray-600 border border-gray-200'
                                  }`}>
                                  Speak
                                </span>
                              )}
                              {lang.can_read && (
                                <span className={`inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-medium ${lang.is_native
                                  ? 'bg-indigo-200/60 text-indigo-700 border border-indigo-300/50'
                                  : 'bg-white text-gray-600 border border-gray-200'
                                  }`}>
                                  Read
                                </span>
                              )}
                              {lang.can_write && (
                                <span className={`inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-medium ${lang.is_native
                                  ? 'bg-indigo-200/60 text-indigo-700 border border-indigo-300/50'
                                  : 'bg-white text-gray-600 border border-gray-200'
                                  }`}>
                                  Write
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            </div>

            {/* === RIGHT COLUMN: Detailed Content === */}
            <div className="lg:col-span-8 space-y-6 pb-12">

              {/* Profile Stats Card */}
              {(profile.experiences?.length > 0 || profile.projects?.length > 0 || profile.achievements?.length > 0) && (
                <Card className="border-0 shadow-sm bg-gradient-to-br from-[#008060]/5 to-transparent">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-5 h-5 text-[#008060]" />
                      <h3 className="font-semibold text-gray-900">Profile Activity</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {profile.experiences?.length > 0 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#008060]">{profile.experiences.length}</div>
                          <div className="text-xs text-gray-500 mt-1">Experience{profile.experiences.length !== 1 ? 's' : ''}</div>
                        </div>
                      )}
                      {profile.projects?.length > 0 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#008060]">{profile.projects.length}</div>
                          <div className="text-xs text-gray-500 mt-1">Project{profile.projects.length !== 1 ? 's' : ''}</div>
                        </div>
                      )}
                      {profile.achievements?.length > 0 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#008060]">{profile.achievements.length}</div>
                          <div className="text-xs text-gray-500 mt-1">Achievement{profile.achievements.length !== 1 ? 's' : ''}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* About Section */}
              {profile.bio && (
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-[#008060]" />
                      About
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{profile.bio}</p>
                  </CardContent>
                </Card>
              )}

              {/* Volunteer Interests */}
              {volunteerInterests.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Heart className="w-5 h-5 text-[#008060]" />
                      Volunteering & Interests
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {volunteerInterests.map((item: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-gray-700 bg-red-50 hover:bg-red-100 hover:text-red-700 border-red-200">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Experience Section */}
              {profile.experiences && profile.experiences.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-[#008060]" />
                      Experience
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="space-y-2">
                      {profile.experiences.map((exp: any) => (
                        <ExperienceItem key={exp.id} exp={exp} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Skills Section */}
              {profile.skills && profile.skills.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Code className="w-5 h-5 text-[#008060]" />
                      Skills & Expertise
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Primary Skills */}
                    {profile.skills.some((s: any) => s.is_primary === true) && (
                      <div className="ml-2">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          Primary Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {profile.skills.filter((s: any) => s.is_primary === true).map((skill: any) => (
                            <div
                              key={skill.id}
                              className="px-4 py-2.5 bg-gradient-to-r from-[#008060] to-[#00a078] text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-sm">{skill.skill_name}</span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {skill.proficiency_level && (
                                      <span className="text-xs opacity-90 bg-white/20 px-2 py-0.5 rounded">
                                        {skill.proficiency_level}
                                      </span>
                                    )}
                                    {skill.verified && (
                                      <span className="text-xs opacity-90 bg-white/20 px-2 py-0.5 rounded flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Verified
                                      </span>
                                    )}
                                    {skill.endorsements_count > 0 && (
                                      <span className="text-xs opacity-90 bg-white/20 px-2 py-0.5 rounded">
                                        {skill.endorsements_count} endorsements
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other Skills */}
                    {profile.skills.some((s: any) => s.is_primary !== true) && (
                      <div className="ml-2">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Tag className="w-4 h-4 text-gray-500" />
                          Other Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {profile.skills.filter((s: any) => s.is_primary !== true).map((skill: any) => (
                            <Badge key={skill.id} className="bg-white text-gray-700 border-gray-200 hover:bg-[#008060]/5 hover:border-[#008060] px-3 py-1.5 text-sm transition-colors cursor-default">
                              <div className="flex items-center gap-1.5">
                                {skill.skill_name}
                                {skill.verified && <CheckCircle2 className="w-3 h-3 text-[#008060]" />}
                                {skill.proficiency_level && <span className="ml-1 opacity-50 text-xs font-normal">| {skill.proficiency_level}</span>}
                                {skill.endorsements_count > 0 && (
                                  <span className="ml-1 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                    {skill.endorsements_count}
                                  </span>
                                )}
                              </div>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Expertise & Keywords Section */}
              {(expertise.length > 0 || (profile.keywords && parseList(profile.keywords).length > 0)) && (
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[#008060]" />
                      Expertise & Interests
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {expertise.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Areas of Expertise</h4>
                        <div className="flex flex-wrap gap-2">
                          {expertise.map((item: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile.keywords && parseList(profile.keywords).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {parseList(profile.keywords).map((item: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Startup Founder Section */}
              {profile.isStartupFounder && (
                <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2 text-blue-900">
                      <Rocket className="w-5 h-5 text-blue-600" />
                      Startup Founder
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Company</p>
                        <p className="text-lg font-bold text-gray-900">{profile.startupName || 'Founder'}</p>
                        <p className="text-sm text-gray-600">{profile.startupRole}</p>
                      </div>
                      <div className="flex flex-col gap-3">
                        {profile.fundingStage && (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-white text-blue-700 border-blue-200 shadow-sm">{profile.fundingStage}</Badge>
                            <span className="text-xs text-gray-400">Funding Stage</span>
                          </div>
                        )}
                        {profile.foundingYear && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span>Founded in {profile.foundingYear}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Projects Section */}
              {profile.projects && profile.projects.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold flex items-center gap-2 px-1">
                    <Code className="w-5 h-5 text-[#008060]" />
                    Projects
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.projects.map((project: any) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                </div>
              )}

              {/* Education Section */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[#008060]" />
                    Education
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* TKS Education */}
                  {profile.batch && (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-[#008060]/10 rounded-lg flex items-center justify-center text-[#008060]">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">The Kalyani School</h3>
                        <p className="text-gray-600">Class of {profile.batch}</p>
                        {(profile.course || profile.branch) && (
                          <p className="text-sm text-gray-500 mt-1">
                            {profile.course} {profile.branch ? `• ${profile.branch}` : ''}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-2">
                          {profile.cgpa && (
                            <div className="text-xs text-gray-400">
                              <span className="font-medium">CGPA:</span> {profile.cgpa}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Higher Education */}
                  {profile.education && profile.education.length > 0 && (
                    <>
                      {profile.batch && <div className="border-t border-gray-100" />}
                      {profile.education.map((edu: any) => (
                        <div key={edu.id} className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 shrink-0">
                            <Building2 className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                              <div>
                                <h3 className="font-semibold text-gray-900 text-lg">{edu.school}</h3>
                                <p className="text-gray-700 font-medium">
                                  {edu.degree}
                                  {edu.field_of_study && ` • ${edu.field_of_study}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-gray-500 whitespace-nowrap">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {format(new Date(edu.start_date), 'MMM yyyy')} - {edu.is_current ? 'Present' : (edu.end_date ? format(new Date(edu.end_date), 'MMM yyyy') : '')}
                                </span>
                              </div>
                            </div>

                            {edu.grade && <p className="text-sm text-gray-500 mt-1">Grade: {edu.grade}</p>}
                            {edu.activities && <p className="mt-2 text-sm text-gray-600">Activities: {edu.activities}</p>}
                            {edu.description && <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{edu.description}</p>}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Certifications Section */}
              {profile.certifications && profile.certifications.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Award className="w-5 h-5 text-[#008060]" />
                      Certifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6">
                      {profile.certifications.map((cert: any) => (
                        <div key={cert.id || cert.certification_name} className={`relative flex gap-4 items-start p-4 rounded-xl border transition-all ml-2 ${cert.is_active !== false ? 'bg-orange-50/30 border-orange-100 hover:bg-orange-50/50' : 'bg-gray-50 border-gray-200'}`}>
                          {cert.is_active !== false && <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full mt-3 mr-3 shadow-sm" />}
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-orange-600 shrink-0 shadow-sm border border-orange-100">
                            <BadgeCheck className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{cert.certification_name}</h3>
                            <p className="text-sm text-gray-600 font-medium">{cert.issuing_organization}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              <p className="text-xs text-gray-400">
                                {format(new Date(cert.issue_date), 'MMM yyyy')}
                                {cert.expiry_date && ` - ${format(new Date(cert.expiry_date), 'MMM yyyy')}`}
                                {cert.duration && ` • ${cert.duration}`}
                              </p>
                              {cert.credential_id && (
                                <p className="text-xs text-gray-400">ID: {cert.credential_id}</p>
                              )}
                            </div>
                            {cert.description && (
                              <p className="text-xs text-gray-500 mt-2 line-clamp-2">{cert.description}</p>
                            )}
                            {cert.skills_gained && cert.skills_gained.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {cert.skills_gained.map((skill: string, idx: number) => (
                                  <span key={idx} className="text-[10px] bg-white text-orange-700 px-1.5 py-0.5 rounded border border-orange-100">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                            {cert.credential_url && (
                              <a href={cert.credential_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[#008060] hover:text-[#005c45] transition-colors">
                                View Certificate <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Achievements Section */}
              {profile.achievements && profile.achievements.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-[#008060]" />
                      Honors & Awards
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {profile.achievements.map((ach: any) => (
                        <div key={ach.id} className={`flex gap-4 p-4 rounded-xl border transition-all ml-2 ${ach.is_featured ? 'bg-amber-50/40 border-amber-200 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
                          <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${ach.is_featured ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                            {ach.is_featured ? <Sparkles className="w-5 h-5 fill-amber-600 text-amber-600" /> : <Award className="w-5 h-5 text-gray-500" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">{ach.title}</h4>
                              {ach.is_featured && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] leading-none py-0.5 border-amber-200 uppercase font-bold">
                                  Featured
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 font-medium">
                              {ach.issuing_organization} • {format(new Date(ach.date_received), 'MMM yyyy')}
                            </p>
                            {ach.category && (
                              <Badge variant="outline" className="mt-1 text-[10px] text-gray-400 border-gray-100 font-normal">
                                {ach.category} {ach.level ? `• ${ach.level}` : ''}
                              </Badge>
                            )}
                            {ach.description && <p className="text-sm text-gray-500 mt-2 leading-relaxed">{ach.description}</p>}
                            {ach.url && (
                              <a href={ach.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[#008060] hover:underline">
                                View details <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
