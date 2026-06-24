import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileCompletenessIndicator } from "@/components/ProfileCompletenessIndicator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { LinkedInIntegration } from "@/components/LinkedInIntegration";
import { PhoneInput } from "@/components/ui/phone-input";
import { ExperienceManager } from "@/components/profile/ExperienceManager";
import { SkillsManager } from "@/components/profile/SkillsManager";
import { EducationManager } from "@/components/profile/EducationManager";
import { ProjectManager } from "@/components/profile/ProjectManager";
import { CertificationManager } from "@/components/profile/CertificationManager";
import { AchievementManager } from "@/components/profile/AchievementManager";
import { LanguageManager } from "@/components/profile/LanguageManager";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { InterestPicker } from "@/components/profile/InterestPicker";
import { getUserFriendlyError, logError, handleAPIError } from "@/utils/errorHandler";
import { BackButton } from "@/components/common/BackButton";
import { CityAutocomplete } from "@/components/profile/CityAutocomplete";
import { LocationManager } from "@/components/profile/LocationManager";
import { validateName, validateEmail, validateLinkedInURL, validateTextLength, sanitizeString, validateGitHubURL, validateTwitterURL, validateWebsiteURL } from "@/utils/validation";
import { getGraduationYearOptions } from "@/constants/graduationYear";

import {
  Save,
  Eye,
  EyeOff,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Globe,
  Github,
  Twitter,
  Download,
  Printer,
  Menu,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Briefcase,
  Rocket,
  Heart,
  Info,
  BadgeCheck,
  Languages
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const employmentOptions = [
  'Employed',
  'Self-Employed',
  'Entrepreneur',
  'Student',
  'Looking for Opportunities',
  'Freelance',
  'Internship'
];

const fundingStages = [
  'Bootstrapped',
  'Pre-seed',
  'Seed',
  'Series A',
  'Series B+',
  'Acquired',
  'Public'
];

export const UserProfilePage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, alumni } = useAuth();

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    batch: '',
    currentCompany: '',
    currentRole: '',
    currentCity: '',
    currentState: '',
    currentCountry: '',
    location: '',
    linkedinUrl: '',
    githubUrl: '',
    twitterUrl: '',
    personalWebsite: '',
    bio: '',
    gender: '',
    profilePicture: '',
    // Advanced fields
    employmentStatus: '',
    yearsOfExperience: 0,
    expertiseAreas: '[]',
    volunteerInterests: '[]',
    keywords: '[]',
    interestAreas: '[]',
    timezone: 'Asia/Kolkata',
    resumeUrl: '',
    // New startup-related fields
    isStartupFounder: false,
    startupName: '',
    startupRole: '',
    fundingStage: '',
    foundingYear: '',
    // Privacy settings
    showEmail: true,
    showPhone: true,
    linkedin_photo_url: '',
    latitude: null as number | null,
    longitude: null as number | null,
    locationLabel: '',
  });
  const [originalProfile, setOriginalProfile] = useState<typeof profile | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [autoSaveLastSaved, setAutoSaveLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [tagInputs, setTagInputs] = useState({
    expertise: '',
    volunteer: '',
    keyword: ''
  });
  const [isDragging, setIsDragging] = useState(false);
  const [showSectionNav, setShowSectionNav] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Refs for scrolling to incomplete sections
  const personalInfoRef = React.useRef<HTMLDivElement>(null);
  const professionalInfoRef = React.useRef<HTMLDivElement>(null);
  const experienceRef = React.useRef<HTMLDivElement>(null);
  const educationRef = React.useRef<HTMLDivElement>(null);
  const projectsRef = React.useRef<HTMLDivElement>(null);
  const skillsRef = React.useRef<HTMLDivElement>(null);
  const certificationsRef = React.useRef<HTMLDivElement>(null);
  const languagesRef = React.useRef<HTMLDivElement>(null);
  const achievementsRef = React.useRef<HTMLDivElement>(null);
  const handleSaveRef = useRef<() => Promise<void>>(async () => { });
  const saveButtonRef = React.useRef<HTMLButtonElement>(null);

  // State to track data from all managers
  const [profileData, setProfileData] = useState({
    experiences: [] as any[],
    education: [] as any[],
    projects: [] as any[],
    skills: [] as any[],
    certifications: [] as any[],
    languages: [] as any[],
    achievements: [] as any[],
  });

  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      if (!userId) {
        toast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive",
        });
        setLocation('/login');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/auth/me', {
        headers: {
          'user-id': userId,
          'Authorization': `Bearer ${token || ''}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        if (data.alumni) {
          const profilePic = data.alumni.profile_picture || '';

          const loadedProfile = {
            firstName: data.alumni.first_name || '',
            lastName: data.alumni.last_name || '',
            email: data.user.email || '',
            phone: data.alumni.phone || '',
            batch: data.alumni.batch || '',
            currentCompany: data.alumni.current_company || '',
            currentRole: data.alumni.current_role || '',
            currentCity: data.alumni.current_city || '',
            currentState: data.alumni.current_state || '',
            currentCountry: data.alumni.current_country || '',
            latitude: data.alumni.latitude || null,
            longitude: data.alumni.longitude || null,
            locationLabel: data.alumni.location_label || '',
            location: data.alumni.location || (data.alumni.current_city ? `${data.alumni.current_city}${data.alumni.current_country ? `, ${data.alumni.current_country}` : ''}` : ''),
            linkedinUrl: data.alumni.linkedin_url || '',
            bio: data.alumni.bio || '',
            gender: data.alumni.gender || '',
            profilePicture: profilePic,
            // Advanced fields
            employmentStatus: data.alumni.employment_status || '',
            yearsOfExperience: data.alumni.years_of_experience || 0,
            previousCompanies: data.alumni.previous_companies || '[]',
            employmentHistory: data.alumni.employment_history || '[]',
            certifications: data.alumni.certifications || '[]',
            languagesKnown: data.alumni.languages_known || '[]',
            expertiseAreas: data.alumni.expertise_areas || '[]',
            interestAreas: data.alumni.interest_areas || '[]',
            keywords: data.alumni.keywords || '[]',
            timezone: data.alumni.timezone || 'Asia/Kolkata',
            achievements: data.alumni.achievements || '[]',
            awards: data.alumni.awards || '[]',
            volunteerInterests: data.alumni.volunteer_interests || '[]',
            resumeUrl: data.alumni.resume_url || '',
            // Startup info
            isStartupFounder: !!data.alumni.is_startup_founder,
            startupName: data.alumni.startup_name || '',
            startupRole: data.alumni.startup_role || '',
            fundingStage: data.alumni.funding_stage || '',
            foundingYear: data.alumni.founding_year || '',
            // New social media fields
            githubUrl: data.alumni.github_url || '',
            twitterUrl: data.alumni.twitter_url || '',
            personalWebsite: data.alumni.personal_website || '',
            // Privacy settings (default to false if null/undefined)
            showEmail: data.alumni.show_email === true,
            showPhone: data.alumni.show_phone === true,
            linkedin_photo_url: data.alumni.linkedin_photo_url || '',
          };

          setProfile(loadedProfile);
          setOriginalProfile(loadedProfile);
          setHasChanges(false);
        } else {
          const defaultProfile = {
            ...profile,
            email: data.user.email || ''
          };
          setProfile(defaultProfile);
          setOriginalProfile(defaultProfile);
          setHasChanges(false);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Set page title
  useEffect(() => {
    document.title = "My Profile - TKS Alumni Portal";
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchAllProfileData();

    // Listen for profile updates from child components
    const handleProfileUpdate = () => {
      fetchProfile();
      // Reset file input to allow new photo uploads after LinkedIn sync
      const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      // Small delay to ensure child components have finished updating
      setTimeout(() => {
        fetchAllProfileData();
      }, 500);
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [user, toast, setLocation]);

  const handleAddTag = (field: string, inputKey: 'expertise' | 'volunteer' | 'keyword') => {
    const value = tagInputs[inputKey].trim();
    if (!value) return;

    let currentTags: string[] = [];
    try {
      const rawValue = (profile as any)[field];
      currentTags = Array.isArray(rawValue) ? rawValue : JSON.parse(rawValue || '[]');
    } catch {
      currentTags = [];
    }

    if (!currentTags.includes(value)) {
      const updatedTags = [...currentTags, value];
      setProfile({ ...profile, [field]: JSON.stringify(updatedTags) });
    }
    setTagInputs({ ...tagInputs, [inputKey]: '' });
  };

  const handleRemoveTag = (field: string, tagToRemove: string) => {
    let currentTags: string[] = [];
    try {
      const rawValue = (profile as any)[field];
      currentTags = Array.isArray(rawValue) ? rawValue : JSON.parse(rawValue || '[]');
    } catch {
      currentTags = [];
    }

    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    setProfile({ ...profile, [field]: JSON.stringify(updatedTags) });
  };

  // Helper to scroll to section
  const scrollToSection = (ref: React.RefObject<HTMLElement>) => {
    const element = ref.current;
    if (!element) return;

    // Try to find the specific app scroll container first
    const container = document.getElementById('app-main-scroll-container');

    if (container) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Calculate relative position within the container
      // We add the current scrollTop to get the absolute position within the scrollable content
      const absoluteElementTop = elementRect.top - containerRect.top + container.scrollTop;

      // target = absolute position - padding (20px)
      const targetScroll = absoluteElementTop - 20;

      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    } else {
      // Fallback: standard scrollIntoView if container not found
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Real-time validation
  useEffect(() => {
    const errors: Record<string, string> = {};

    if (profile.firstName && !validateName(profile.firstName, 'First Name').isValid) {
      errors.firstName = validateName(profile.firstName, 'First Name').error || '';
    }
    if (profile.lastName && !validateName(profile.lastName, 'Last Name').isValid) {
      errors.lastName = validateName(profile.lastName, 'Last Name').error || '';
    }
    if (profile.email && !validateEmail(profile.email).isValid) {
      errors.email = validateEmail(profile.email).error || '';
    }
    if (profile.linkedinUrl && !validateLinkedInURL(profile.linkedinUrl).isValid) {
      errors.linkedinUrl = validateLinkedInURL(profile.linkedinUrl).error || '';
    }
    if (profile.githubUrl && !validateGitHubURL(profile.githubUrl).isValid) {
      errors.githubUrl = validateGitHubURL(profile.githubUrl).error || '';
    }
    if (profile.twitterUrl && !validateTwitterURL(profile.twitterUrl).isValid) {
      errors.twitterUrl = validateTwitterURL(profile.twitterUrl).error || '';
    }
    if (profile.personalWebsite && !validateWebsiteURL(profile.personalWebsite).isValid) {
      errors.personalWebsite = validateWebsiteURL(profile.personalWebsite).error || '';
    }
    if (profile.bio && !validateTextLength(profile.bio, 'Bio', 0, 2000).isValid) {
      errors.bio = validateTextLength(profile.bio, 'Bio', 0, 2000).error || '';
    }

    // Phone validation
    const phoneDigits = profile.phone.replace(/\D/g, '');
    if (profile.phone && phoneDigits.length < 10) {
      errors.phone = "Phone number must be at least 10 digits";
    } else if (profile.phone && phoneDigits.length > 15) {
      errors.phone = "Phone number is too long (maximum 15 digits)";
    }

    // Startup validation
    if (profile.isStartupFounder && !profile.startupName.trim()) {
      errors.startupName = "Startup name is required";
    }

    setValidationErrors(errors);
  }, [profile.firstName, profile.lastName, profile.email, profile.linkedinUrl, profile.githubUrl, profile.twitterUrl, profile.personalWebsite, profile.bio, profile.phone, profile.isStartupFounder, profile.startupName]);

  // Validate required fields and detect changes
  useEffect(() => {
    const requiredFields = [
      profile.firstName,
      profile.lastName,
      profile.email,
      profile.phone,
      profile.batch,
      profile.gender
    ];

    const allRequiredFieldsFilled = requiredFields.every(field =>
      field !== undefined && field !== null && String(field).trim() !== ''
    );

    setIsFormValid(allRequiredFieldsFilled && Object.keys(validationErrors).length === 0);

    // Check if profile has changed from original (more efficient comparison)
    if (originalProfile) {
      let changed = false;

      // Compare each field individually (skip profilePicture for efficiency, compare as strings)
      const fieldsToCompare: (keyof typeof profile)[] = [
        'firstName', 'lastName', 'email', 'phone', 'batch', 'gender',
        'currentCompany', 'currentRole', 'location', 'linkedinUrl', 'bio', 'githubUrl', 'twitterUrl',
        'personalWebsite', 'showEmail', 'showPhone', 'employmentStatus', 'yearsOfExperience',
        'expertiseAreas', 'volunteerInterests', 'keywords', 'interestAreas', 'timezone', 'resumeUrl',
        'isStartupFounder', 'startupName', 'startupRole', 'fundingStage', 'foundingYear',
        'linkedin_photo_url', 'currentCity', 'currentState', 'currentCountry', 'latitude', 'longitude', 'locationLabel'
      ];

      for (const field of fieldsToCompare) {
        // Compare as strings to handle numeric/boolean/null values consistently
        if (String(profile[field] ?? '') !== String(originalProfile[field] ?? '')) {
          changed = true;
          break;
        }
      }

      // Compare profilePicture separately (check if it's different, even if both are long base64 strings)
      if (!changed && profile.profilePicture !== originalProfile.profilePicture) {
        changed = true;
      }

      setHasChanges(changed);
    }
  }, [profile, originalProfile, validationErrors]);

  // Auto-save function
  const handleAutoSave = useCallback(async () => {
    if (!isFormValid || !hasChanges) return;

    setIsAutoSaving(true);
    try {
      const userId = user?.id || localStorage.getItem('userId');
      if (!userId) return;

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId,
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          firstName: sanitizeString(profile.firstName),
          lastName: sanitizeString(profile.lastName),
          email: profile.email.trim().toLowerCase(),
          phone: profile.phone,
          batch: profile.batch,
          gender: profile.gender,
          currentCompany: sanitizeString(profile.currentCompany),
          currentRole: sanitizeString(profile.currentRole),
          currentCity: sanitizeString(profile.currentCity),
          currentState: sanitizeString(profile.currentState),
          currentCountry: sanitizeString(profile.currentCountry),
          location: [profile.currentCity, profile.currentState, profile.currentCountry].filter(Boolean).join(', ') || sanitizeString(profile.location),
          linkedinUrl: profile.linkedinUrl?.trim() || null,
          bio: sanitizeString(profile.bio),

          resumeUrl: profile.resumeUrl,
          profilePicture: profile.profilePicture || null,
          githubUrl: profile.githubUrl?.trim() || null,
          twitterUrl: profile.twitterUrl?.trim() || null,
          personalWebsite: profile.personalWebsite?.trim() || null,
          showEmail: profile.showEmail,
          showPhone: profile.showPhone,
          // Sync all additional fields
          employmentStatus: profile.employmentStatus,
          yearsOfExperience: profile.yearsOfExperience,
          expertiseAreas: profile.expertiseAreas,
          volunteerInterests: profile.volunteerInterests,
          keywords: profile.keywords,
          interestAreas: profile.interestAreas,
          timezone: profile.timezone,
          isStartupFounder: profile.isStartupFounder,
          startupName: profile.startupName,
          startupRole: profile.startupRole,
          fundingStage: profile.fundingStage,
          foundingYear: profile.foundingYear,
          latitude: profile.latitude,
          longitude: profile.longitude,
          locationLabel: profile.locationLabel,
        })
      });

      if (response.ok) {
        setAutoSaveLastSaved(new Date());
        // Update original profile to current profile to mark as saved
        setOriginalProfile(JSON.parse(JSON.stringify(profile)));
        setHasChanges(false);
        window.dispatchEvent(new Event('profileUpdated'));
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [profile, isFormValid, hasChanges, user?.id]);

  // Auto-save functionality with debouncing
  useEffect(() => {
    if (!hasChanges || !isFormValid || !originalProfile) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (5 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, 5000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [profile, hasChanges, isFormValid, handleAutoSave, originalProfile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isFormValid && hasChanges) {
          handleSaveRef.current();
        }
      }
      // Esc to cancel/go back
      if (e.key === 'Escape' && hasChanges) {
        if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
          setLocation('/feed');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormValid, hasChanges, setLocation]);

  const handleSave = async () => {
    try {
      const userId = user?.id || localStorage.getItem('userId');
      if (!userId) {
        toast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive",
        });
        return;
      }

      // Validate required fields using utility functions
      const firstNameValidation = validateName(profile.firstName, 'First Name');
      if (!firstNameValidation.isValid) {
        toast({
          title: "Validation Error",
          description: firstNameValidation.error,
          variant: "destructive",
        });
        return;
      }

      const lastNameValidation = validateName(profile.lastName, 'Last Name');
      if (!lastNameValidation.isValid) {
        toast({
          title: "Validation Error",
          description: lastNameValidation.error,
          variant: "destructive",
        });
        return;
      }

      const emailValidation = validateEmail(profile.email);
      if (!emailValidation.isValid) {
        toast({
          title: "Validation Error",
          description: emailValidation.error,
          variant: "destructive",
        });
        return;
      }

      // Validate phone number format and length
      const phoneDigits = profile.phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        toast({
          title: "Validation Error",
          description: "Phone number must be at least 10 digits",
          variant: "destructive",
        });
        return;
      }

      if (phoneDigits.length > 15) {
        toast({
          title: "Validation Error",
          description: "Phone number is too long (maximum 15 digits)",
          variant: "destructive",
        });
        return;
      }

      // Validate batch/graduation year
      if (!profile.batch) {
        toast({
          title: "Validation Error",
          description: "Graduation year is required",
          variant: "destructive",
        });
        return;
      }

      const currentYear = new Date().getFullYear();
      const batchParts = profile.batch.split('-');
      const endYear = parseInt(batchParts[batchParts.length - 1], 10);
      if (isNaN(endYear)) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid batch year (e.g. 2022 or 2018-2022).",
          variant: "destructive",
        });
        return;
      }
      if (endYear < 2018) {
        toast({
          title: "Validation Error",
          description: "Batch end year cannot be earlier than 2018.",
          variant: "destructive",
        });
        return;
      }
      if (endYear > currentYear + 10) {
        toast({
          title: "Validation Error",
          description: `Batch end year cannot be later than ${currentYear + 10}.`,
          variant: "destructive",
        });
        return;
      }

      // Validate gender
      if (!profile.gender) {
        toast({
          title: "Validation Error",
          description: "Gender is required",
          variant: "destructive",
        });
        return;
      }

      // Validate LinkedIn URL if provided
      if (profile.linkedinUrl && profile.linkedinUrl.trim() !== '') {
        const linkedinValidation = validateLinkedInURL(profile.linkedinUrl);
        if (!linkedinValidation.isValid) {
          toast({
            title: "Validation Error",
            description: linkedinValidation.error,
            variant: "destructive",
          });
          return;
        }
      }

      // Validate bio length
      if (profile.bio) {
        const bioValidation = validateTextLength(profile.bio, 'Bio', 0, 2000);
        if (!bioValidation.isValid) {
          toast({
            title: "Validation Error",
            description: bioValidation.error,
            variant: "destructive",
          });
          return;
        }
      }

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId,
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          firstName: sanitizeString(profile.firstName),
          lastName: sanitizeString(profile.lastName),
          email: profile.email.trim().toLowerCase(),
          phone: profile.phone,
          batch: profile.batch,
          gender: profile.gender,
          currentCompany: sanitizeString(profile.currentCompany),
          currentRole: sanitizeString(profile.currentRole),
          currentCity: sanitizeString(profile.currentCity),
          currentState: sanitizeString(profile.currentState),
          currentCountry: sanitizeString(profile.currentCountry),
          location: [profile.currentCity, profile.currentState, profile.currentCountry].filter(Boolean).join(', ') || sanitizeString(profile.location),
          linkedinUrl: profile.linkedinUrl?.trim() || null,
          githubUrl: profile.githubUrl?.trim() || null,
          twitterUrl: profile.twitterUrl?.trim() || null,
          personalWebsite: profile.personalWebsite?.trim() || null,
          bio: sanitizeString(profile.bio),
          resumeUrl: profile.resumeUrl,
          profilePicture: profile.profilePicture || null,
          showEmail: profile.showEmail,
          showPhone: profile.showPhone,
          // Integrated Additional Info
          employmentStatus: profile.employmentStatus,
          yearsOfExperience: profile.yearsOfExperience,
          expertiseAreas: profile.expertiseAreas,
          volunteerInterests: profile.volunteerInterests,
          keywords: profile.keywords,
          interestAreas: profile.interestAreas,
          timezone: profile.timezone,
          isStartupFounder: profile.isStartupFounder,
          startupName: profile.startupName,
          startupRole: profile.startupRole,
          fundingStage: profile.fundingStage,
          foundingYear: profile.foundingYear,
          latitude: profile.latitude,
          longitude: profile.longitude,
          locationLabel: profile.locationLabel,
        })
      });

      if (response.ok) {
        const data = await response.json();

        toast({
          title: "Success",
          description: "Profile updated successfully!",
        });

        // Trigger custom event to refresh profile across the app
        window.dispatchEvent(new Event('profileUpdated'));

        // Refresh the profile data and reset changes tracking
        if (user?.id) {
          await fetchProfile();
          setHasChanges(false);
        }
      } else {
        const errorInfo = await handleAPIError(response);
        logError(errorInfo, 'UserProfilePage.handleSave');
        toast({
          title: "Error",
          description: getUserFriendlyError(errorInfo),
          variant: "destructive",
        });
      }
    } catch (error) {
      logError(error, 'UserProfilePage.handleSave');
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    }
  };

  // Sync ref so keyboard shortcut effect always invokes the latest handleSave
  handleSaveRef.current = handleSave;

  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || user?.username || 'User';

  const getDefaultProfilePicture = () => {
    // Use uploaded profile picture if available
    if (profile.profilePicture && profile.profilePicture.trim() !== '') {

      // Check if it's a base64 image or URL
      if (profile.profilePicture.startsWith('data:image') || profile.profilePicture.startsWith('http')) {
        return profile.profilePicture;
      }
      // If it's stored without the data:image prefix, add it
      if (profile.profilePicture.includes('base64,')) {
        return `data:image/jpeg;${profile.profilePicture}`;
      }
    }

    // Fallback to LinkedIn photo if available
    if (profile.linkedin_photo_url && profile.linkedin_photo_url.trim() !== '') {
      return profile.linkedin_photo_url;
    }

    // Default profile pictures based on gender
    const seed = encodeURIComponent(displayName);

    switch (profile.gender) {
      case 'male':
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      case 'female':
        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      case 'other':
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
      case 'prefer_not_to_say':
        return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=6c63ff`;
      default:
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    }
  };

  const processImageFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size should be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);

    try {
      // Compress and convert image to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Set max dimensions
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to base64 with compression
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

          setProfile(prev => ({ ...prev, profilePicture: compressedBase64 }));

          // Reset file input to allow selecting the same file again if needed
          const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }

          toast({
            title: "Success",
            description: "Profile picture uploaded. Click 'Save Changes' to apply.",
          });
        };
        img.onerror = () => {
          toast({
            title: "Error",
            description: "Failed to process image",
            variant: "destructive",
          });
          setUploadingImage(false);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to read image file",
          variant: "destructive",
        });
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
      setUploadingImage(false);
    } finally {
      setTimeout(() => setUploadingImage(false), 500);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const getMissingFields = () => {
    const missing = [];
    if (!profile.firstName) missing.push('firstName');
    if (!profile.lastName) missing.push('lastName');
    if (!profile.email) missing.push('email');
    if (!profile.phone) missing.push('phone');
    if (!profile.batch) missing.push('batch');
    if (!profile.gender) missing.push('gender');
    return missing;
  };

  // Fetch all profile data for completeness calculation
  const fetchAllProfileData = async () => {
    const userId = user?.id || localStorage.getItem('userId');
    if (!userId) return;

    try {
      const [experiencesRes, educationRes, projectsRes, skillsRes, certificationsRes, languagesRes, achievementsRes] = await Promise.all([
        fetch('/api/profile/experiences', { headers: { 'user-id': userId } }),
        fetch('/api/profile/education', { headers: { 'user-id': userId } }),
        fetch('/api/profile/projects', { headers: { 'user-id': userId } }),
        fetch('/api/profile/skills', { headers: { 'user-id': userId } }),
        fetch('/api/profile/certifications', { headers: { 'user-id': userId } }),
        fetch('/api/profile/languages', { headers: { 'user-id': userId } }),
        fetch('/api/profile/achievements', { headers: { 'user-id': userId } }),
      ]);

      const experiences = experiencesRes.ok ? (await experiencesRes.json()).experiences || [] : [];
      const education = educationRes.ok ? (await educationRes.json()).education || [] : [];
      const projects = projectsRes.ok ? (await projectsRes.json()).projects || [] : [];
      const skills = skillsRes.ok ? (await skillsRes.json()).skills || [] : [];
      const certifications = certificationsRes.ok ? (await certificationsRes.json()).certifications || [] : [];
      const languages = languagesRes.ok ? (await languagesRes.json()).languages || [] : [];
      const achievements = achievementsRes.ok ? (await achievementsRes.json()).achievements || [] : [];

      setProfileData({
        experiences,
        education,
        projects,
        skills,
        certifications,
        languages,
        achievements,
      });
    } catch (error) {
      console.error('Error fetching profile data:', error);
    }
  };

  const calculateProfileCompleteness = () => {
    const fields = [
      // Essential fields (weight: 3) - Must have
      { value: profile.firstName, weight: 3, name: 'First Name', section: 'personal' },
      { value: profile.lastName, weight: 3, name: 'Last Name', section: 'personal' },
      { value: profile.email, weight: 3, name: 'Email', section: 'personal' },
      { value: profile.phone, weight: 3, name: 'Phone', section: 'personal' },
      { value: profile.batch, weight: 3, name: 'Batch', section: 'personal' },
      { value: profile.gender, weight: 3, name: 'Gender', section: 'personal' },

      // Important fields (weight: 2.5) - Highly recommended
      { value: profile.profilePicture, weight: 2.5, name: 'Profile Picture', section: 'personal' },
      { value: profile.bio, weight: 2.5, name: 'Bio', section: 'professional' },
      { value: profile.currentCompany, weight: 2.5, name: 'Current Company', section: 'professional' },
      { value: profile.currentRole, weight: 2.5, name: 'Current Role', section: 'professional' },
      { value: profile.location, weight: 2.5, name: 'Location', section: 'professional' },

      // Professional fields (weight: 2) - Important for networking
      { value: profile.linkedinUrl, weight: 2, name: 'LinkedIn', section: 'professional' },

      // Experience section (total weight: 5 points, complete if >= 1)
      {
        weight: 5,
        name: 'Work Experience',
        section: 'experience',
        checkFunction: () => profileData.experiences.length >= 1
      },

      // Education section (total weight: 4 points, complete if >= 1)
      {
        weight: 4,
        name: 'Education',
        section: 'education',
        checkFunction: () => profileData.education.length >= 1
      },

      // Skills section (total weight: 4.5 points, complete if >= 1)
      {
        weight: 4.5,
        name: 'Skills',
        section: 'skills',
        checkFunction: () => profileData.skills.length >= 1
      },

      // Projects section (total weight: 3 points, complete if >= 1)
      {
        weight: 3,
        name: 'Projects',
        section: 'projects',
        checkFunction: () => profileData.projects.length >= 1
      },

      // Certifications section (total weight: 3 points, complete if >= 1)
      {
        weight: 3,
        name: 'Certifications',
        section: 'certifications',
        checkFunction: () => profileData.certifications.length >= 1
      },

      // Languages section (total weight: 3 points, complete if >= 1)
      {
        weight: 3,
        name: 'Languages',
        section: 'languages',
        checkFunction: () => profileData.languages.length >= 1
      },

      // Achievements section (total weight: 3 points, complete if >= 1)
      {
        weight: 3,
        name: 'Achievements',
        section: 'achievements',
        checkFunction: () => profileData.achievements.length >= 1
      },
    ];

    let completedWeight = 0;
    let totalWeight = 0;

    fields.forEach(field => {
      totalWeight += field.weight;
      if (field.checkFunction) {
        // Section fields with checkFunction
        if (field.checkFunction()) {
          completedWeight += field.weight;
        }
      } else {
        // Regular text/image fields
        if (field.value && String(field.value).trim() !== '' && String(field.value) !== '[]') {
          completedWeight += field.weight;
        }
      }
    });

    return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  };

  // Find the section with least information and scroll to it
  const scrollToIncompleteSection = () => {
    // Define sections with their completeness criteria and priority
    // Priority: Lower number = Higher priority for redirection
    const sections = [
      {
        id: 'personal',
        ref: personalInfoRef,
        label: 'Personal Information',
        // Essential fields must be filled
        isComplete: () => {
          const { firstName, lastName, email, phone, batch, gender } = profile;
          return !!(firstName && lastName && email && phone && batch && gender);
        },
        priority: 1
      },
      {
        id: 'professional',
        ref: professionalInfoRef,
        label: 'Professional Information',
        // Important fields should be filled
        isComplete: () => {
          // Check if at least one professional detail is added if they are employed
          const hasBasicInfo = !!(profile.linkedinUrl || profile.bio || profile.location);
          return hasBasicInfo;
        },
        priority: 2
      },
      {
        id: 'experience',
        ref: experienceRef,
        label: 'Work Experience',
        // At least one experience entries
        isComplete: () => profileData.experiences.length > 0,
        priority: 3
      },
      {
        id: 'education',
        ref: educationRef,
        label: 'Education',
        // At least one education entry
        isComplete: () => profileData.education.length > 0,
        priority: 3
      },
      {
        id: 'skills',
        ref: skillsRef,
        label: 'Skills',
        // At least 3 skills recommended
        isComplete: () => profileData.skills.length >= 1,
        priority: 4
      },
      {
        id: 'projects',
        ref: projectsRef,
        label: 'Projects',
        // At least 1 project
        isComplete: () => profileData.projects.length > 0,
        priority: 4
      },
      {
        id: 'certifications',
        ref: certificationsRef,
        label: 'Certifications',
        isComplete: () => profileData.certifications.length > 0,
        priority: 5
      },
      {
        id: 'languages',
        ref: languagesRef,
        label: 'Languages',
        isComplete: () => profileData.languages.length > 0,
        priority: 5
      },
      {
        id: 'achievements',
        ref: achievementsRef,
        label: 'Achievements',
        isComplete: () => profileData.achievements.length > 0,
        priority: 5
      }
    ];

    // Find the highest priority incomplete section
    const incompleteSection = sections
      .sort((a, b) => a.priority - b.priority)
      .find(s => !s.isComplete());

    if (incompleteSection && incompleteSection.ref.current) {
      setTimeout(() => {
        const element = incompleteSection.ref.current;
        if (element) {
          scrollToSection(incompleteSection.ref);

          // Highlight effect
          element.style.transition = 'box-shadow 0.5s ease-in-out';
          element.style.boxShadow = '0 0 0 4px rgba(0, 128, 96, 0.4)';

          toast({
            title: "Complete your Profile",
            description: `Please add your ${incompleteSection.label} to improve your profile score.`,
            duration: 4000,
          });

          setTimeout(() => {
            if (element) {
              element.style.boxShadow = '';
            }
          }, 2000);
        }
      }, 100);
    } else {
      // If all "Genuninely Incomplete" sections are done, but score is not 100%
      const currentScore = calculateProfileCompleteness();
      if (currentScore < 100) {
        toast({
          title: "Great Progress!",
          description: "You've completed all the essentials. Fill in more details in any section to reach 100%!",
        });
      }
    }
  };


  if (loading) {
    return (
      <AppLayout currentPage="feed">
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const completenessPercentage = calculateProfileCompleteness();
  const missingFields = getMissingFields();

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 pb-24 sm:pb-28">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Back Button */}
          <div className="mb-4 sm:mb-6">
            <BackButton className="sm:hidden" />
          </div>

          {/* Profile Header */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <div
                  className={`relative group ${isDragging ? 'ring-4 ring-[#008060] ring-offset-2' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Avatar className="w-24 h-24 sm:w-32 sm:h-32 shadow-md">
                    <AvatarImage src={getDefaultProfilePicture()} />
                    <AvatarFallback className="text-3xl sm:text-4xl bg-[#008060] text-white">
                      {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute bottom-0 right-0 rounded-full w-8 h-8 sm:w-10 sm:h-10 bg-white shadow-sm hover:bg-gray-50"
                    onClick={() => document.getElementById('profilePictureInput')?.click()}
                    disabled={uploadingImage}
                    title="Upload profile picture"
                  >
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                  {isDragging && (
                    <div className="absolute inset-0 bg-[#008060]/20 rounded-full flex items-center justify-center border-2 border-dashed border-[#008060]">
                      <p className="text-[#008060] font-semibold text-sm">Drop image here</p>
                    </div>
                  )}
                  <input
                    id="profilePictureInput"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{displayName}</h1>
                  <p className="text-gray-600 mt-1">{profile.currentRole || (user?.user_role === 'faculty' ? 'Faculty' : user?.user_role === 'student' ? 'Current Student' : user?.user_role === 'administrator' || (user?.user_role as string) === 'admin' ? 'Administrator' : (user?.user_role as string) === 'user' ? 'User' : 'Alumni')} {profile.currentCompany && `at ${profile.currentCompany}`}</p>
                  <p className="text-sm text-gray-500 mt-1 flex items-center justify-center sm:justify-start gap-1">
                    <span>📍</span> {profile.location || 'Location not set'}
                  </p>
                </div>

                {/* Profile Completeness Indicator - Responsive */}
                <div className="flex justify-center sm:justify-end">
                  <ProfileCompletenessIndicator
                    percentage={completenessPercentage}
                    onClick={scrollToIncompleteSection}
                  />
                </div>
              </div>

              {/* Auto-save Status */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center gap-3">
                {isAutoSaving && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-4 h-4 border-2 border-[#008060] border-t-transparent rounded-full animate-spin"></div>
                    <span>Auto-saving...</span>
                  </div>
                )}

                {autoSaveLastSaved && !isAutoSaving && (
                  <div className="text-xs text-gray-500">
                    Saved {autoSaveLastSaved.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* LinkedIn Integration - Moved just below header */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-blue-50 border-b border-blue-100 p-4 sm:p-6">
              <CardTitle className="text-blue-900 flex items-center gap-2 text-base sm:text-lg">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
                LinkedIn Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <LinkedInIntegration
                hasPendingChanges={hasChanges}
                onSaveRequested={() => {
                  // Scroll to save button
                  setTimeout(() => {
                    scrollToSection(saveButtonRef);
                    if (saveButtonRef.current) {
                      // Highlight the button briefly
                      saveButtonRef.current.style.transition = 'box-shadow 0.3s ease';
                      saveButtonRef.current.style.boxShadow = '0 0 0 4px rgba(0, 128, 96, 0.4)';
                      setTimeout(() => {
                        if (saveButtonRef.current) {
                          saveButtonRef.current.style.boxShadow = '';
                        }
                      }, 2000);
                    }
                  }, 100);
                  toast({
                    title: "Save Your Changes",
                    description: "Please scroll down and click 'Save Changes' before connecting or refreshing LinkedIn.",
                    variant: "default",
                  });
                }}
              />
            </CardContent>
          </Card>

          {/* Resume Upload Section */}
          {user?.id && (
            <ResumeUpload
              userId={user.id}
              currentResumeUrl={profile.resumeUrl}
              onResumeUpdate={(resumeUrl) => {
                setProfile({ ...profile, resumeUrl: resumeUrl || '' });
                // Trigger profile update event
                window.dispatchEvent(new Event('profileUpdated'));
              }}
            />
          )}

          {/* Personal Information */}
          <Card ref={personalInfoRef} className="border-0 shadow-lg">
            <CardHeader className="p-4 sm:p-6 pb-0">
              <CardTitle className="text-xl">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="firstName"
                      value={profile.firstName}
                      onChange={(e) => {
                        setProfile({ ...profile, firstName: e.target.value });
                      }}
                      placeholder="Enter first name"
                      required
                      disabled={isPreviewMode}
                      className={`min-h-[44px] pr-8 ${validationErrors.firstName ? 'border-red-500 focus-visible:ring-red-500' : !profile.firstName.trim() ? 'border-red-300' : ''}`}
                    />
                    {profile.firstName && !validationErrors.firstName && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                    {validationErrors.firstName && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    )}
                  </div>
                  {validationErrors.firstName && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="lastName"
                      value={profile.lastName}
                      onChange={(e) => {
                        setProfile({ ...profile, lastName: e.target.value });
                      }}
                      placeholder="Enter last name"
                      required
                      disabled={isPreviewMode}
                      className={`min-h-[44px] pr-8 ${validationErrors.lastName ? 'border-red-500 focus-visible:ring-red-500' : !profile.lastName.trim() ? 'border-red-300' : ''}`}
                    />
                    {profile.lastName && !validationErrors.lastName && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                    {validationErrors.lastName && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    )}
                  </div>
                  {validationErrors.lastName && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.lastName}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => {
                      setProfile({ ...profile, email: e.target.value });
                    }}
                    placeholder="Enter email"
                    required
                    disabled={isPreviewMode}
                    className={`min-h-[44px] pr-8 ${validationErrors.email ? 'border-red-500 focus-visible:ring-red-500' : !profile.email.trim() ? 'border-red-300' : ''}`}
                  />
                  {profile.email && !validationErrors.email && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                  {validationErrors.email && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                  )}
                </div>
                {validationErrors.email && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.email}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">
                  Phone <span className="text-red-500">*</span>
                </Label>
                <PhoneInput
                  value={profile.phone}
                  onChange={(value) => {
                    setProfile({ ...profile, phone: value });
                  }}
                  placeholder="Enter phone number"
                  disabled={isPreviewMode}
                  error={validationErrors.phone || (!profile.phone.trim() ? 'Phone number is required' : undefined)}
                />
              </div>
              <div>
                <Label htmlFor="graduationYear">
                  Graduation Year <span className="text-red-500">*</span>
                </Label>
                <select
                  id="graduationYear"
                  value={profile.batch}
                  onChange={(e) => {
                    setProfile({ ...profile, batch: e.target.value });
                  }}
                  disabled={isPreviewMode}
                  className={`flex h-[44px] w-full rounded-md border ${!profile.batch ? 'border-red-300' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                  required
                >
                  <option value="">Select graduation year</option>
                  {getGraduationYearOptions().map((year) => (
                    <option key={year} value={year.toString()}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="gender">
                  Gender <span className="text-red-500">*</span>
                </Label>
                <select
                  id="gender"
                  value={profile.gender}
                  onChange={(e) => {
                    setProfile({ ...profile, gender: e.target.value });
                  }}
                  disabled={isPreviewMode}
                  className={`flex h-[44px] w-full rounded-md border ${!profile.gender ? 'border-red-300' : 'border-input'} bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                  required
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </CardContent>
          </Card>
          {/* Professional Information */}
          <Card ref={professionalInfoRef} className="border-0 shadow-lg">
            <CardHeader className="p-4 sm:p-6 pb-0">
              <CardTitle className="text-xl">Professional Information</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Current Company</label>
                  <p className="font-medium text-gray-900 truncate">{profile.currentCompany || 'Not set'}</p>
                  <p className="text-xs text-gray-400 mt-1">Synced from Experience</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <label className="text-xs text-gray-500 font-semibold uppercase">Current Role</label>
                  <p className="font-medium text-gray-900 truncate">{profile.currentRole || 'Not set'}</p>
                  <p className="text-xs text-gray-400 mt-1">Synced from Experience</p>
                </div>
              </div>



              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="location">Your Precise Location (City / Area / Village)</Label>
                  <CityAutocomplete
                    city={profile.locationLabel || profile.currentCity}
                    onCityChange={(val) => setProfile({ ...profile, locationLabel: val })}
                    onLocationSelect={(city, state, country, lat, lng, label) => {
                      setProfile({
                        ...profile,
                        currentCity: city,
                        currentState: state,
                        currentCountry: country,
                        latitude: lat || null,
                        longitude: lng || null,
                        locationLabel: label || ''
                      });
                    }}
                    disabled={isPreviewMode}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Search and select your exact location. This powers the interactive Alumni Map.
                  </p>
                </div>
              </div>

              <div className="border-t pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold">Additional Locations</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Add multiple locations (Home, University, Job, Internship) — each appears as a separate pin on the Alumni Map.
                </p>
                <LocationManager userId={user!.id} disabled={isPreviewMode} />
              </div>

              {/* Added Employment Status and Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employmentStatus">Employment Status</Label>
                  <select
                    id="employmentStatus"
                    value={profile.employmentStatus}
                    onChange={(e) => setProfile({ ...profile, employmentStatus: e.target.value })}
                    disabled={isPreviewMode}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select Status</option>
                    {employmentOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearsOfExperience">Total Years of Experience</Label>
                  <Input
                    id="yearsOfExperience"
                    type="number"
                    value={profile.yearsOfExperience}
                    onChange={(e) => setProfile({ ...profile, yearsOfExperience: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 5"
                    disabled={isPreviewMode}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="timezone"
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                    placeholder="e.g. Asia/Kolkata"
                    disabled={isPreviewMode}
                    className="min-h-[44px] pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="linkedinUrl">LinkedIn Profile</Label>
                <Input
                  id="linkedinUrl"
                  value={profile.linkedinUrl}
                  onChange={(e) => {
                    setProfile({ ...profile, linkedinUrl: e.target.value });
                  }}
                  placeholder="https://linkedin.com/in/yourprofile"
                  disabled={isPreviewMode}
                  className={`min-h-[44px] ${validationErrors.linkedinUrl ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {validationErrors.linkedinUrl && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.linkedinUrl}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="githubUrl">GitHub Profile</Label>
                  <div className="relative">
                    <Input
                      id="githubUrl"
                      value={profile.githubUrl}
                      onChange={(e) => {
                        setProfile({ ...profile, githubUrl: e.target.value });
                      }}
                      placeholder="https://github.com/username or username"
                      className={`min-h-[44px] pr-8 ${validationErrors.githubUrl ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      disabled={isPreviewMode}
                    />
                    {profile.githubUrl && !validationErrors.githubUrl && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                    {validationErrors.githubUrl && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    )}
                  </div>
                  {validationErrors.githubUrl && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.githubUrl}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="twitterUrl">Twitter / X Profile</Label>
                  <div className="relative">
                    <Input
                      id="twitterUrl"
                      value={profile.twitterUrl}
                      onChange={(e) => {
                        setProfile({ ...profile, twitterUrl: e.target.value });
                      }}
                      placeholder="https://x.com/username or username"
                      className={`min-h-[44px] pr-8 ${validationErrors.twitterUrl ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      disabled={isPreviewMode}
                    />
                    {profile.twitterUrl && !validationErrors.twitterUrl && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                    {validationErrors.twitterUrl && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    )}
                  </div>
                  {validationErrors.twitterUrl && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {validationErrors.twitterUrl}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="personalWebsite">Personal Website</Label>
                <div className="relative">
                  <Input
                    id="personalWebsite"
                    value={profile.personalWebsite}
                    onChange={(e) => {
                      setProfile({ ...profile, personalWebsite: e.target.value });
                    }}
                    placeholder="https://yourwebsite.com"
                    className={`min-h-[44px] pr-8 ${validationErrors.personalWebsite ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    disabled={isPreviewMode}
                  />
                  {profile.personalWebsite && !validationErrors.personalWebsite && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                  {validationErrors.personalWebsite && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                  )}
                </div>
                {validationErrors.personalWebsite && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.personalWebsite}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profile.bio}
                  onChange={(e) => {
                    setProfile({ ...profile, bio: e.target.value });
                  }}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  disabled={isPreviewMode}
                  className={`min-h-[100px] ${validationErrors.bio ? 'border-red-500' : ''}`}
                />
                {validationErrors.bio && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {validationErrors.bio}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">{profile.bio.length}/2000 characters</p>
              </div>

              {/* Privacy Settings */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Privacy Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="showEmail" className="text-sm font-normal">Show Email on Public Profile</Label>
                      <p className="text-xs text-gray-500">Allow others to see your email address</p>
                    </div>
                    <Switch
                      id="showEmail"
                      checked={profile.showEmail}
                      disabled={isPreviewMode}
                      onCheckedChange={(checked) => {
                        setProfile({ ...profile, showEmail: checked });
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="showPhone" className="text-sm font-normal">Show Phone on Public Profile</Label>
                      <p className="text-xs text-gray-500">Allow others to see your phone number</p>
                    </div>
                    <Switch
                      id="showPhone"
                      checked={profile.showPhone}
                      disabled={isPreviewMode}
                      onCheckedChange={(checked) => {
                        setProfile({ ...profile, showPhone: checked });
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>



          {/* Experience Manager */}
          <div ref={experienceRef}>
            {user?.id && <ExperienceManager userId={user.id} />}
          </div>

          {/* Education Manager */}
          <div ref={educationRef}>
            {user?.id && <EducationManager userId={user.id} />}
          </div>

          {/* Project Manager */}
          <div ref={projectsRef}>
            {user?.id && <ProjectManager userId={user.id} />}
          </div>

          {/* Skills Manager */}
          <div ref={skillsRef}>
            {user?.id && <SkillsManager userId={user.id} />}
          </div>

          {/* Certifications Section */}
          <div ref={certificationsRef}>
            {user?.id && <CertificationManager userId={user.id} />}
          </div>

          {/* Languages Section */}
          <div ref={languagesRef}>
            {user?.id && <LanguageManager userId={user.id} />}
          </div>

          {/* Achievements Section */}
          <div ref={achievementsRef}>
            {user?.id && <AchievementManager userId={user.id} />}
          </div>


          {/* Interests & Expertise Card */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="p-4 sm:p-6 pb-0">
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Interests & Expertise
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Areas of Expertise */}
              <div className="space-y-3">
                <Label>Areas of Expertise</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(() => {
                    try {
                      const tags = typeof profile.expertiseAreas === 'string' ? JSON.parse(profile.expertiseAreas || '[]') : profile.expertiseAreas;
                      return Array.isArray(tags) ? tags.map((tag: string) => (
                        <Badge key={tag} className="flex items-center gap-1 py-1 pl-3 bg-emerald-50 text-emerald-700 border-emerald-200">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag('expertiseAreas', tag)} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      )) : null;
                    } catch { return null; }
                  })()}
                </div>
                {!isPreviewMode && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add expertise (e.g. Cloud Arch, Marketing)"
                      value={tagInputs.expertise}
                      onChange={(e) => setTagInputs({ ...tagInputs, expertise: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag('expertiseAreas', 'expertise');
                        }
                      }}
                      className="min-h-[44px]"
                    />
                    <Button type="button" variant="outline" className="h-11" onClick={() => handleAddTag('expertiseAreas', 'expertise')}>Add</Button>
                  </div>
                )}
              </div>

              {/* Volunteer Interests */}
              <div className="space-y-3">
                <Label>Volunteer Interests</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(() => {
                    try {
                      const tags = typeof profile.volunteerInterests === 'string' ? JSON.parse(profile.volunteerInterests || '[]') : profile.volunteerInterests;
                      return Array.isArray(tags) ? tags.map((tag: string) => (
                        <Badge key={tag} className="flex items-center gap-1 py-1 pl-3 bg-red-50 text-red-700 border-red-200">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag('volunteerInterests', tag)} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      )) : null;
                    } catch { return null; }
                  })()}
                </div>
                {!isPreviewMode && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add interest (e.g. Teaching, Health)"
                      value={tagInputs.volunteer}
                      onChange={(e) => setTagInputs({ ...tagInputs, volunteer: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag('volunteerInterests', 'volunteer');
                        }
                      }}
                      className="min-h-[44px]"
                    />
                    <Button type="button" variant="outline" className="h-11" onClick={() => handleAddTag('volunteerInterests', 'volunteer')}>Add</Button>
                  </div>
                )}
              </div>

              {/* Keywords / General Interests */}
              <div className="space-y-3">
                <Label>Keywords / General Interests</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(() => {
                    try {
                      const tags = typeof profile.keywords === 'string' ? JSON.parse(profile.keywords || '[]') : profile.keywords;
                      return Array.isArray(tags) ? tags.map((tag: string) => (
                        <Badge key={tag} className="flex items-center gap-1 py-1 pl-3 bg-amber-50 text-amber-700 border-amber-200">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag('keywords', tag)} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      )) : null;
                    } catch { return null; }
                  })()}
                </div>
                {!isPreviewMode && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add keyword (e.g. AI, Crypto, Yoga)"
                      value={tagInputs.keyword}
                      onChange={(e) => setTagInputs({ ...tagInputs, keyword: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag('keywords', 'keyword');
                        }
                      }}
                      className="min-h-[44px]"
                    />
                    <Button type="button" variant="outline" className="h-11" onClick={() => handleAddTag('keywords', 'keyword')}>Add</Button>
                  </div>
                )}
              </div>

              {/* Mentorship Interest Areas */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-semibold">Mentorship Interest Areas</Label>
                  <p className="text-sm text-gray-500 mt-0.5">What you want to learn (mentee) or help others with (mentor)</p>
                </div>
                <InterestPicker
                  value={(() => {
                    try {
                      const parsed = typeof profile.interestAreas === 'string' ? JSON.parse(profile.interestAreas || '[]') : profile.interestAreas;
                      return Array.isArray(parsed) ? parsed : [];
                    } catch { return []; }
                  })()}
                  onChange={(v) => setProfile({ ...profile, interestAreas: JSON.stringify(v) })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Startup Info Card */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-blue-50/30">
            <CardHeader className="p-4 sm:p-6 pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-blue-600" />
                  Startup & Entrepreneurship
                </CardTitle>
                <Switch
                  checked={profile.isStartupFounder}
                  disabled={isPreviewMode}
                  onCheckedChange={(checked) => setProfile({ ...profile, isStartupFounder: checked })}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">Founding or leading a venture?</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {profile.isStartupFounder ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="startupName">Startup Name</Label>
                    <Input
                      id="startupName"
                      value={profile.startupName}
                      onChange={(e) => setProfile({ ...profile, startupName: e.target.value })}
                      placeholder="Awesome Startup Inc."
                      disabled={isPreviewMode}
                      className={`min-h-[44px] ${validationErrors.startupName ? 'border-red-500' : ''}`}
                    />
                    {validationErrors.startupName && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validationErrors.startupName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startupRole">Your Role</Label>
                    <Input
                      id="startupRole"
                      value={profile.startupRole}
                      onChange={(e) => setProfile({ ...profile, startupRole: e.target.value })}
                      placeholder="Founder & CEO"
                      disabled={isPreviewMode}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fundingStage">Funding Stage</Label>
                    <select
                      id="fundingStage"
                      value={profile.fundingStage}
                      onChange={(e) => setProfile({ ...profile, fundingStage: e.target.value })}
                      disabled={isPreviewMode}
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select Stage</option>
                      {fundingStages.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foundingYear">Founding Year</Label>
                    <Input
                      id="foundingYear"
                      type="number"
                      value={profile.foundingYear}
                      onChange={(e) => setProfile({ ...profile, foundingYear: e.target.value })}
                      placeholder="2024"
                      disabled={isPreviewMode}
                      className="min-h-[44px]"
                    />
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg">
                  Toggle the switch above to add your startup information.
                </div>
              )}
            </CardContent>
          </Card>


          {/* Actions - Sticky action bar at bottom (z-[40] below header z-[100] so ham menu is always clickable) */}
          <div className="sticky bottom-0 z-[40] sm:mt-6 sm:-mx-6 transition-all duration-300">
            <div className="flex justify-center items-end sm:items-center w-full">
              {/* Main footer container */}
              <div className="bg-white border-t border-gray-200 sm:border-t-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] w-full sm:w-auto px-3 py-2 sm:px-5 sm:py-4 sm:rounded-t-xl flex flex-row gap-2 sm:gap-3 items-center mx-auto justify-between sm:justify-start">

                <div className="flex flex-row gap-2 sm:gap-3 shrink-0 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (hasChanges) {
                        if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
                          setLocation('/feed');
                        }
                      } else {
                        setLocation('/feed');
                      }
                    }}
                    className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
                  >
                    Cancel
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4">
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={async () => {
                        try {
                          const profileText = `
ALUMNI PROFILE EXPORT
=====================

PERSONAL INFORMATION
--------------------
Name: ${profile.firstName} ${profile.lastName}
Email: ${profile.email}
Phone: ${profile.phone || 'Not set'}
Gender: ${profile.gender || 'Not set'}
Batch/Graduation Year: ${profile.batch}
Location: ${profile.location || 'Not set'}


PROFESSIONAL INFORMATION
------------------------
Current Company: ${profile.currentCompany || 'Not set'}
Current Position: ${profile.currentRole || 'Not set'}


SOCIAL MEDIA & LINKS
--------------------
LinkedIn: ${profile.linkedinUrl || 'Not set'}
GitHub: ${profile.githubUrl || 'Not set'}
Twitter/X: ${profile.twitterUrl || 'Not set'}
Personal Website: ${profile.personalWebsite || 'Not set'}
Resume: ${profile.resumeUrl || 'Not set'}

BIO
---
${profile.bio || 'Not set'}

${profileData.experiences.length > 0 ? `
PROFESSIONAL EXPERIENCE
-----------------------
${profileData.experiences.map((exp: any, idx: number) => `
${idx + 1}. ${exp.position} at ${exp.companyName}
   ${exp.startDate ? new Date(exp.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''} - ${exp.isCurrent ? 'Present' : exp.endDate ? new Date(exp.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
   ${exp.location ? `Location: ${exp.location}` : ''}
   ${exp.employmentType ? `Type: ${exp.employmentType}` : ''}
   ${exp.description ? `\n   ${exp.description}` : ''}
`).join('\n')}
` : ''}

${profileData.education.length > 0 ? `
EDUCATION
---------
${profileData.education.map((edu: any, idx: number) => `
${idx + 1}. ${edu.degree}
   ${edu.institution}
   ${edu.fieldOfStudy ? `Field: ${edu.fieldOfStudy}` : ''}
   ${edu.startDate ? new Date(edu.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''} - ${edu.isCurrent ? 'Present' : edu.endDate ? new Date(edu.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
   ${edu.grade ? `Grade: ${edu.grade}` : ''}
`).join('\n')}
` : ''}

${profileData.skills.length > 0 ? `
SKILLS & EXPERTISE
------------------
${profileData.skills.map((skill: any) =>
                            `• ${skill.skillName}${skill.proficiencyLevel ? ` (${skill.proficiencyLevel})` : ''}${skill.yearsOfExperience ? ` - ${skill.yearsOfExperience} years` : ''}${skill.isPrimary ? ' ⭐' : ''}`
                          ).join('\n')}
` : ''}

${profileData.projects.length > 0 ? `
PROJECTS
--------
${profileData.projects.map((project: any, idx: number) => `
${idx + 1}. ${project.title}
   ${project.description || ''}
   ${project.technologies && project.technologies.length > 0 ? `Technologies: ${project.technologies.join(', ')}` : ''}
   ${project.projectUrl ? `URL: ${project.projectUrl}` : ''}
   ${project.githubUrl ? `GitHub: ${project.githubUrl}` : ''}
`).join('\n')}
` : ''}

${profileData.certifications.length > 0 ? `
CERTIFICATIONS
--------------
${profileData.certifications.map((cert: any, idx: number) => `
${idx + 1}. ${cert.name}
   ${cert.issuingOrganization}
   ${cert.issueDate ? `Issued: ${new Date(cert.issueDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}
   ${cert.credentialId ? `Credential ID: ${cert.credentialId}` : ''}
`).join('\n')}
` : ''}

${profileData.achievements.length > 0 ? `
ACHIEVEMENTS & AWARDS
---------------------
${profileData.achievements.map((achievement: any, idx: number) => `
${idx + 1}. ${achievement.title}
   ${achievement.date ? new Date(achievement.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
   ${achievement.description || ''}
`).join('\n')}
` : ''}

${profileData.languages.length > 0 ? `
LANGUAGES
---------
${profileData.languages.map((lang: any) => `• ${lang.language} - ${lang.proficiency}`).join('\n')}
` : ''}

---
Exported on: ${new Date().toLocaleString()}
                            `.trim();

                          const blob = new Blob([profileText], { type: 'text/plain' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${profile.firstName}_${profile.lastName}_Profile.txt`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                          toast({ title: "Exported", description: "Profile exported as text" });
                        } catch (error) {
                          toast({ title: "Error", description: "Failed to export", variant: "destructive" });
                        }
                      }}>
                        <FileText className="w-4 h-4 mr-2" /> Export as Text
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        try {
                          const completeData = {
                            profile: { ...profile, exportedAt: new Date().toISOString() },
                            experiences: profileData.experiences,
                            education: profileData.education,
                            skills: profileData.skills,
                            projects: profileData.projects,
                            certifications: profileData.certifications,
                            achievements: profileData.achievements,
                            languages: profileData.languages,
                          };
                          const blob = new Blob([JSON.stringify(completeData, null, 2)], { type: 'application/json' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${profile.firstName}_${profile.lastName}_Profile.json`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                          toast({ title: "Exported", description: "Profile exported as JSON" });
                        } catch (error) {
                          toast({ title: "Error", description: "Failed to export", variant: "destructive" });
                        }
                      }}>
                        <Download className="w-4 h-4 mr-2" /> Export as JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        try {
                          const { generateProfilePDF } = await import('@/utils/pdfExport');
                          const completeData = {
                            profile,
                            experiences: profileData.experiences,
                            education: profileData.education,
                            skills: profileData.skills,
                            projects: profileData.projects,
                            certifications: profileData.certifications,
                            achievements: profileData.achievements,
                            languages: profileData.languages,
                          };
                          generateProfilePDF(completeData);
                          toast({ title: "Exported", description: "Profile exported as PDF" });
                        } catch (error) {
                          toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" });
                        }
                      }}>
                        <Printer className="w-4 h-4 mr-2" /> Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Group 2: Save Changes */}
                <div className="relative group shrink-0">
                  <Button
                    ref={saveButtonRef}
                    onClick={handleSave}
                    variant="brand"
                    className="h-9 sm:h-10 text-xs sm:text-sm px-4 sm:px-6 shadow-md hover:shadow-lg transition-all"
                    disabled={!isFormValid || !hasChanges}
                  >
                    <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                    <span className="sm:hidden">Save</span>
                    <span className="hidden sm:inline">Save Changes</span>
                    <span className="hidden sm:inline text-xs opacity-75 ml-1">(Ctrl+S)</span>
                  </Button>

                  {(!isFormValid || !hasChanges) && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1.5 px-3 whitespace-nowrap z-50 shadow-lg pointer-events-none">
                      {!isFormValid ? 'Please fill required fields (*)' : 'No changes to save'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status Notices */}
          <div className="space-y-3">
            {hasChanges && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-2">
                <span className="text-blue-600">💾</span>
                <div className="text-sm text-blue-800">
                  <p className="font-semibold">You have unsaved changes</p>
                  <p className="text-xs mt-1">Don't forget to click "Save Changes" to update your profile.</p>
                </div>
              </div>
            )}
            {!isFormValid && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-2">
                <span className="text-yellow-600">⚠️</span>
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold">Please complete all required fields</p>
                  <p className="text-xs mt-1">Fields marked with <span className="text-red-500">*</span> are mandatory and must be filled before saving.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};