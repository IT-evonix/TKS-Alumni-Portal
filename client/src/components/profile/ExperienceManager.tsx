import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Briefcase, Edit, Trash2, X, MapPin, Calendar, Building2 } from 'lucide-react';
import { experienceValidationSchema } from "@shared/validation";
import { z } from "zod";

interface Experience {
    id: string;
    companyName: string;
    position: string;
    employmentType?: string;
    location?: string;
    locationType?: string;
    startDate: string;
    endDate?: string;
    isCurrent: boolean;
    description?: string;
    responsibilities?: string[];
    achievements?: string[];
    skillsUsed?: string[];
    industry?: string;
    companySize?: string;
    companyUrl?: string;
}

interface ExperienceManagerProps {
    userId: string;
}

export const ExperienceManager: React.FC<ExperienceManagerProps> = ({ userId }) => {
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const { toast } = useToast();

    const [formData, setFormData] = useState<Partial<Experience>>({
        companyName: '',
        position: '',
        employmentType: 'full-time',
        location: '',
        locationType: 'onsite',
        startDate: '',
        endDate: '',
        isCurrent: false,
        description: '',
        responsibilities: [],
        achievements: [],
        skillsUsed: [],
        industry: '',
        companySize: '',
        companyUrl: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchExperiences();
    }, [userId]);

    // Scroll lock when modal is open
    useEffect(() => {
        if (showForm) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showForm]);

    const fetchExperiences = async () => {
        try {
            const response = await fetch('/api/profile/experiences', {
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                const data = await response.json();
                setExperiences(data.experiences || []);
            }
        } catch (error) {
            console.error('Error fetching experiences:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const validation = experienceValidationSchema.safeParse(formData);

        if (!validation.success) {
            const newErrors: Record<string, string> = {};
            validation.error.errors.forEach((err) => {
                if (err.path[0]) {
                    newErrors[err.path[0] as string] = err.message;
                }
            });
            setErrors(newErrors);
            toast({
                title: 'Validation Error',
                description: 'Please check the form for errors',
                variant: 'destructive',
            });
            return;
        }

        try {
            const url = editingId
                ? `/api/profile/experiences/${editingId}`
                : '/api/profile/experiences';

            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': userId,
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                toast({
                    title: 'Success',
                    description: `Experience ${editingId ? 'updated' : 'added'} successfully!`,
                });
                fetchExperiences();
                resetForm();
                // Trigger profile header refresh for auto-sync
                window.dispatchEvent(new Event('profileUpdated'));
            } else {
                const error = await response.json();
                toast({
                    title: 'Error',
                    description: error.error || 'Failed to save experience',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save experience',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this experience?')) return;

        try {
            const response = await fetch(`/api/profile/experiences/${id}`, {
                method: 'DELETE',
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                toast({
                    title: 'Success',
                    description: 'Experience deleted successfully!',
                });
                fetchExperiences();
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete experience',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = (experience: Experience) => {
        setFormData(experience);
        setEditingId(experience.id);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            companyName: '',
            position: '',
            employmentType: 'full-time',
            location: '',
            locationType: 'onsite',
            startDate: '',
            endDate: '',
            isCurrent: false,
            description: '',
            responsibilities: [],
            achievements: [],
            skillsUsed: [],
            industry: '',
            companySize: '',
            companyUrl: '',
        });
        setEditingId(null);
        setErrors({});
        setShowForm(false);
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const calculateDuration = (start: string, end?: string) => {
        if (!start) return '';

        const startDate = new Date(start);
        const endDate = end ? new Date(end) : new Date();

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return '';
        }

        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
            (endDate.getMonth() - startDate.getMonth());

        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;

        if (years === 0) return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
        if (remainingMonths === 0) return `${years} year${years !== 1 ? 's' : ''}`;
        return `${years} year${years !== 1 ? 's' : ''} ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    };

    if (loading) {
        return (
            <Card className="border-0 shadow-lg">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center py-8">
                        <div className="w-8 h-8 border-4 border-[#008060]/30 border-t-[#008060] rounded-full animate-spin"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#008060]" />
                    Professional Experience
                </CardTitle>
                <Button
                    onClick={() => setShowForm(true)}
                    className="bg-[#008060] hover:bg-[#007055]"
                    size="sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Experience
                </Button>
            </CardHeader>

            {experiences.length > 0 && (
                <CardContent className="space-y-4">
                    <div className="space-y-4">
                        {experiences.map((exp) => (
                            <div
                                key={exp.id}
                                className="border border-gray-200 rounded-lg p-4 hover:border-[#008060] transition-colors"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-start gap-3">
                                            <div className="w-12 h-12 bg-[#008060]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Building2 className="w-6 h-6 text-[#008060]" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg text-gray-900">{exp.position}</h3>
                                                <p className="text-[#008060] font-medium">{exp.companyName}</p>
                                                {exp.isCurrent && (
                                                    <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                                        Current Position
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(exp)}
                                            className="text-gray-600 hover:text-[#008060]"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(exp.id)}
                                            className="text-gray-600 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-gray-600 ml-15 pl-[3.75rem]">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span>
                                                {formatDate(exp.startDate)} - {exp.isCurrent ? 'Present' : formatDate(exp.endDate || '')}
                                            </span>
                                            <span className="text-gray-400">
                                                ({calculateDuration(exp.startDate, exp.isCurrent ? undefined : exp.endDate)})
                                            </span>
                                        </div>
                                        {exp.location && (
                                            <div className="flex items-center gap-1">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                <span>{exp.location}</span>
                                                {exp.locationType && (
                                                    <span className="text-gray-400">({exp.locationType})</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {exp.description && (
                                        <p className="text-gray-700 mt-2 whitespace-pre-wrap">{exp.description}</p>
                                    )}

                                    {exp.skillsUsed && exp.skillsUsed.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {exp.skillsUsed.map((skill, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-200"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            )}

            {/* Add/Edit Modal */}
            {showForm && (
                <div
                    className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
                    onClick={resetForm}
                >
                    <div
                        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col h-[90vh] sm:h-[85vh] max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Sticky Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {editingId ? 'Edit Experience' : 'Add Experience'}
                                </h3>
                                <p className="text-sm text-gray-500">Share your professional journey</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={resetForm}
                                className="rounded-full hover:bg-gray-100 -mr-2"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </Button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
                            <form id="experience-form" onSubmit={handleSubmit} className="space-y-6">

                                {/* Company & Role */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="companyName" className="text-sm font-medium">
                                            Company Name <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="companyName"
                                            value={formData.companyName}
                                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                            placeholder="e.g. Google, Microsoft"
                                            className={`h-10 ${errors.companyName ? 'border-red-500' : ''}`}
                                            required
                                        />
                                        {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="position" className="text-sm font-medium">
                                            Job Title <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="position"
                                            value={formData.position}
                                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                            placeholder="e.g. Senior Product Designer"
                                            className={`h-10 ${errors.position ? 'border-red-500' : ''}`}
                                            required
                                        />
                                        {errors.position && <p className="text-red-500 text-xs mt-1">{errors.position}</p>}
                                    </div>
                                </div>

                                {/* Employment Types */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="employmentType">Employment Type</Label>
                                        <select
                                            id="employmentType"
                                            value={formData.employmentType}
                                            onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <option value="full-time">Full-time</option>
                                            <option value="part-time">Part-time</option>
                                            <option value="contract">Contract</option>
                                            <option value="internship">Internship</option>
                                            <option value="freelance">Freelance</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="locationType">Location Type</Label>
                                        <select
                                            id="locationType"
                                            value={formData.locationType}
                                            onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <option value="onsite">On-site</option>
                                            <option value="hybrid">Hybrid</option>
                                            <option value="remote">Remote</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="location">Location</Label>
                                    <Input
                                        id="location"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="e.g. San Francisco, CA"
                                        className="h-10"
                                    />
                                </div>

                                {/* Dates */}
                                <div className="space-y-4 pt-2 pb-2 border-y border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="isCurrent"
                                            checked={formData.isCurrent}
                                            onChange={(e) => {
                                                const isCurrent = e.target.checked;
                                                setFormData({
                                                    ...formData,
                                                    isCurrent,
                                                    endDate: isCurrent ? '' : formData.endDate
                                                });
                                                // Clear end date error when marking as current
                                                if (isCurrent && errors.endDate) {
                                                    const newErrors = { ...errors };
                                                    delete newErrors.endDate;
                                                    setErrors(newErrors);
                                                }
                                            }}
                                            className="w-4 h-4 text-[#008060] rounded border-gray-300 focus:ring-[#008060]"
                                        />
                                        <Label htmlFor="isCurrent" className="font-normal cursor-pointer">
                                            I am currently working in this role
                                        </Label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="startDate">
                                                Start Date <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="startDate"
                                                type="date"
                                                value={formData.startDate}
                                                min="2021-01-01" // Cannot be before 2021
                                                max={new Date().toISOString().split('T')[0]} // Cannot be in the future
                                                onChange={(e) => {
                                                    const startDate = e.target.value;
                                                    const newErrors = { ...errors };

                                                    // Validate start date
                                                    if (startDate) {
                                                        const start = new Date(startDate);
                                                        const minDate = new Date('2021-01-01');
                                                        const today = new Date();
                                                        today.setHours(23, 59, 59, 999); // End of today

                                                        if (start < minDate) {
                                                            newErrors.startDate = 'Start date cannot be before 2021';
                                                        } else if (start > today) {
                                                            newErrors.startDate = 'Start date cannot be in the future';
                                                        } else {
                                                            delete newErrors.startDate;
                                                        }

                                                        // Validate end date if it exists
                                                        if (formData.endDate && !formData.isCurrent) {
                                                            const end = new Date(formData.endDate);
                                                            if (end < start) {
                                                                newErrors.endDate = 'End date cannot be earlier than start date';
                                                            } else {
                                                                delete newErrors.endDate;
                                                            }
                                                        }
                                                    } else {
                                                        delete newErrors.startDate;
                                                    }

                                                    setFormData({ ...formData, startDate });
                                                    setErrors(newErrors);
                                                }}
                                                required
                                                className={`h-10 ${errors.startDate ? 'border-red-500' : ''}`}
                                            />
                                            {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="endDate" className={formData.isCurrent ? 'text-gray-400' : ''}>
                                                End Date {!formData.isCurrent && <span className="text-gray-500 text-xs">(optional)</span>}
                                            </Label>
                                            <Input
                                                id="endDate"
                                                type="date"
                                                value={formData.endDate}
                                                min={formData.startDate || undefined} // Cannot be before start date
                                                max={formData.isCurrent ? undefined : new Date().toISOString().split('T')[0]} // Cannot be in the future if not current
                                                onChange={(e) => {
                                                    const endDate = e.target.value;
                                                    const newErrors = { ...errors };

                                                    if (endDate && formData.startDate) {
                                                        const start = new Date(formData.startDate);
                                                        const end = new Date(endDate);
                                                        const today = new Date();
                                                        today.setHours(23, 59, 59, 999);

                                                        if (end < start) {
                                                            newErrors.endDate = 'End date cannot be earlier than start date';
                                                        } else if (!formData.isCurrent && end > today) {
                                                            newErrors.endDate = 'End date cannot be in the future';
                                                        } else {
                                                            delete newErrors.endDate;
                                                        }
                                                    } else if (endDate && !formData.startDate) {
                                                        newErrors.endDate = 'Please select a start date first';
                                                    } else {
                                                        delete newErrors.endDate;
                                                    }

                                                    setFormData({ ...formData, endDate });
                                                    setErrors(newErrors);
                                                }}
                                                disabled={formData.isCurrent}
                                                className={`h-10 ${formData.isCurrent ? 'bg-gray-50 text-gray-400' : ''} ${errors.endDate ? 'border-red-500' : ''}`}
                                            />
                                            {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
                                            {!formData.isCurrent && formData.startDate && !errors.endDate && (
                                                <p className="text-gray-500 text-xs mt-1">
                                                    Must be on or after {new Date(formData.startDate).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe your key responsibilities and achievements..."
                                        rows={5}
                                        className={`resize-none ${errors.description ? 'border-red-500' : ''}`}
                                    />
                                    {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
                                    <p className="text-xs text-gray-500 text-right">
                                        {formData.description?.length || 0}/2000 characters
                                    </p>
                                </div>
                            </form>
                        </div>

                        {/* Footer - Always visible at bottom */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0 rounded-b-xl">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={resetForm}
                                className="min-w-[80px]"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="experience-form"
                                variant="brand"
                                className="min-w-[120px]"
                            >
                                {editingId ? 'Save Changes' : 'Add Experience'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};
