import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { X, ChevronRight, Check } from 'lucide-react';
import { PhoneInput } from '@/components/ui/phone-input';
import { getGraduationYearOptions } from '@/constants/graduationYear';

interface WizardProps {
  profile: any;
  onClose: () => void;
  onSave: (updates: any) => Promise<void>;
}

export const ProfileCompletionWizard: React.FC<WizardProps> = ({
  profile,
  onClose,
  onSave
}) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    phone: profile.phone || '',
    batch: profile.batch || '',
    gender: profile.gender || '',
    profilePicture: profile.profilePicture || '',
    bio: profile.bio || '',
    currentCompany: profile.currentCompany || '',
    currentPosition: profile.currentPosition || '',
    location: profile.location || '',
    linkedinUrl: profile.linkedinUrl || '',
    employmentStatus: profile.employmentStatus || '',
    yearsOfExperience: profile.yearsOfExperience || 0,
    expertiseAreas: (() => {
      try {
        const parsed = JSON.parse(profile.expertiseAreas || '[]');
        return Array.isArray(parsed) ? parsed.join(', ') : '';
      } catch { return ''; }
    })(),
    languagesKnown: (() => {
      try {
        const parsed = JSON.parse(profile.languagesKnown || '[]');
        return Array.isArray(parsed) ? parsed.join(', ') : '';
      } catch { return ''; }
    })(),
    certifications: (() => {
      try {
        const parsed = JSON.parse(profile.certifications || '[]');
        return Array.isArray(parsed) ? parsed.join('\n') : '';
      } catch { return ''; }
    })(),
    achievements: (() => {
      try {
        const parsed = JSON.parse(profile.achievements || '[]');
        return Array.isArray(parsed) ? parsed.join('\n') : '';
      } catch { return ''; }
    })(),
    awards: (() => {
      try {
        const parsed = JSON.parse(profile.awards || '[]');
        return Array.isArray(parsed) ? parsed.join('\n') : '';
      } catch { return ''; }
    })(),
  });

  const steps = [
    {
      id: 'basic',
      title: 'Basic Information',
      fields: [
        { key: 'firstName', label: 'First Name', type: 'text', required: true },
        { key: 'lastName', label: 'Last Name', type: 'text', required: true },
        { key: 'email', label: 'Email', type: 'email', required: true },
        { key: 'phone', label: 'Phone', type: 'phone', required: true },
      ]
    },
    {
      id: 'personal',
      title: 'Personal Details',
      fields: [
        { key: 'batch', label: 'Graduation Year', type: 'select', required: true },
        { key: 'gender', label: 'Gender', type: 'select', required: true },
        { key: 'profilePicture', label: 'Profile Picture', type: 'file', required: false },
      ]
    },
    {
      id: 'professional',
      title: 'Professional Information',
      fields: [
        { key: 'currentCompany', label: 'Current Company', type: 'text', required: false },
        { key: 'currentPosition', label: 'Current Position', type: 'text', required: false },
        { key: 'location', label: 'Location', type: 'text', required: false },
        { key: 'employmentStatus', label: 'Employment Status', type: 'select-employment', required: false },
        { key: 'yearsOfExperience', label: 'Years of Experience', type: 'number', required: false },
      ]
    },
    {
      id: 'about',
      title: 'About You',
      fields: [
        { key: 'bio', label: 'Bio', type: 'textarea', required: false },
        { key: 'linkedinUrl', label: 'LinkedIn URL', type: 'text', required: false },
      ]
    },
    {
      id: 'skills',
      title: 'Skills & Expertise',
      fields: [
        { key: 'expertiseAreas', label: 'Expertise Areas (comma-separated)', type: 'textarea', required: false },
        { key: 'languagesKnown', label: 'Languages Known (comma-separated)', type: 'text', required: false },
        { key: 'certifications', label: 'Certifications (one per line)', type: 'textarea', required: false },
      ]
    },
    {
      id: 'achievements',
      title: 'Achievements & Awards',
      fields: [
        { key: 'achievements', label: 'Achievements (one per line)', type: 'textarea', required: false },
        { key: 'awards', label: 'Awards (one per line)', type: 'textarea', required: false },
      ]
    }
  ];

  const currentStepData = steps[currentStep];
  const missingFields = currentStepData.fields.filter(
    field => field.required && !formData[field.key as keyof typeof formData]
  );

  const canProceed = missingFields.length === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = async () => {
    // Validate current step fields
    for (const field of currentStepData.fields) {
      const value = formData[field.key as keyof typeof formData];

      if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        toast({
          title: "Validation Error",
          description: `${field.label} is required`,
          variant: "destructive",
        });
        return;
      }

      // Specific validations
      if (field.key === 'phone' && value) {
        const phoneDigits = String(value).replace(/\D/g, '');
        if (phoneDigits.length < 10 || phoneDigits.length > 15) {
          toast({
            title: "Validation Error",
            description: "Phone number must be between 10 and 15 digits",
            variant: "destructive",
          });
          return;
        }
      }

      if (field.key === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          toast({
            title: "Validation Error",
            description: "Please enter a valid email address",
            variant: "destructive",
          });
          return;
        }
      }

      if (field.key === 'batch' && value) {
        const currentYear = new Date().getFullYear();
        const parts = String(value).split('-');
        const endYear = parseInt(parts[parts.length - 1], 10);
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
            description: "Batch end year must be 2018 or later",
            variant: "destructive",
          });
          return;
        }
        if (endYear > currentYear + 10) {
          toast({
            title: "Validation Error",
            description: `Batch end year cannot be later than ${currentYear + 10}`,
            variant: "destructive",
          });
          return;
        }
      }

      if (field.key === 'linkedinUrl' && value && String(value).trim() !== '') {
        const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|pub|company|school)\/[a-zA-Z0-9-]+\/?$/i;
        if (!linkedinRegex.test(String(value))) {
          toast({
            title: "Validation Error",
            description: "Please enter a valid LinkedIn profile URL",
            variant: "destructive",
          });
          return;
        }
      }

      if ((field.key === 'firstName' || field.key === 'lastName') && value) {
        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameRegex.test(String(value))) {
          toast({
            title: "Validation Error",
            description: `${field.label} should contain only letters and spaces`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    if (isLastStep) {
      try {
        // Convert comma/newline separated fields to JSON arrays
        const dataToSave = {
          ...formData,
          expertiseAreas: formData.expertiseAreas
            ? JSON.stringify(formData.expertiseAreas.split(',').map(s => s.trim()).filter(Boolean))
            : '[]',
          languagesKnown: formData.languagesKnown
            ? JSON.stringify(formData.languagesKnown.split(',').map(s => s.trim()).filter(Boolean))
            : '[]',
          certifications: formData.certifications
            ? JSON.stringify(formData.certifications.split('\n').map(s => s.trim()).filter(Boolean))
            : '[]',
          achievements: formData.achievements
            ? JSON.stringify(formData.achievements.split('\n').map(s => s.trim()).filter(Boolean))
            : '[]',
          awards: formData.awards
            ? JSON.stringify(formData.awards.split('\n').map(s => s.trim()).filter(Boolean))
            : '[]',
        };

        await onSave(dataToSave);
        toast({
          title: "Success",
          description: "Profile updated successfully!",
        });
        onClose();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save profile",
          variant: "destructive",
        });
      }
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    // Prevent skipping steps with required fields that are empty or invalid
    for (const field of currentStepData.fields) {
      if (field.required) {
        const value = formData[field.key as keyof typeof formData];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          toast({
            title: "Required Field",
            description: `${field.label} is required and cannot be skipped`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const renderField = (field: any) => {
    const value = formData[field.key as keyof typeof formData];

    if (field.type === 'phone') {
      return (
        <PhoneInput
          value={value}
          onChange={(val) => setFormData({ ...formData, [field.key]: val })}
          placeholder="Enter phone number"
          className={field.required && !value ? 'border-red-300' : ''}
        />
      );
    }

    if (field.type === 'file') {
      return (
        <div className="space-y-2">
          <Input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
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

                  const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                  setFormData({ ...formData, profilePicture: compressedBase64 });
                };
                img.src = ev.target?.result as string;
              };
              reader.readAsDataURL(file);
            }}
            className="cursor-pointer"
          />
          {formData.profilePicture && (
            <img src={formData.profilePicture} alt="Preview" className="w-20 h-20 rounded-full object-cover" />
          )}
        </div>
      );
    }

    if (field.type === 'select' && field.key === 'batch') {
      return (
        <select
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
          className={`flex h-10 w-full rounded-md border ${field.required && !value ? 'border-red-300' : 'border-input'} bg-background px-3 py-2 text-sm`}
        >
          <option value="">Select graduation year</option>
          {getGraduationYearOptions().map((year) => (
            <option key={year} value={year.toString()}>{year}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'select' && field.key === 'gender') {
      return (
        <select
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
          className={`flex h-10 w-full rounded-md border ${field.required && !value ? 'border-red-300' : 'border-input'} bg-background px-3 py-2 text-sm`}
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      );
    }

    if (field.type === 'select-employment') {
      return (
        <select
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select status</option>
          <option value="employed">Employed</option>
          <option value="self-employed">Self-Employed</option>
          <option value="entrepreneur">Entrepreneur</option>
          <option value="student">Student</option>
          <option value="looking">Looking for Opportunities</option>
        </select>
      );
    }

    if (field.type === 'number') {
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.key]: parseInt(e.target.value) || 0 })}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          min="0"
        />
      );
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          rows={4}
        />
      );
    }

    return (
      <Input
        type={field.type}
        value={value}
        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        className={field.required && !value ? 'border-red-300' : ''}
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-gray-200">
        <CardHeader className="border-b bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{currentStepData.title}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex gap-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 flex-1 rounded-full transition-colors ${idx <= currentStep ? 'bg-[#008060]' : 'bg-gray-200'
                    }`}
                />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4 bg-white">
          {currentStepData.fields.map((field) => (
            <div key={field.key}>
              <Label>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {renderField(field)}
            </div>
          ))}

          {missingFields.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              ⚠️ Please fill in all required fields to continue
            </div>
          )}

          <div className="flex justify-between pt-4 border-t bg-white sticky bottom-0">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="border-gray-300 hover:bg-gray-50"
            >
              Skip
            </Button>

            <Button
              onClick={handleNext}
              disabled={!canProceed && currentStepData.fields.some(f => f.required)}
              className="bg-[#008060] hover:bg-[#007055] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLastStep ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Complete
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};