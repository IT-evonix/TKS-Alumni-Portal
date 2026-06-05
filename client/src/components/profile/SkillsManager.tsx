import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Code, Edit, Trash2, X, Star } from 'lucide-react';
import { skillValidationSchema } from "@shared/validation";
import { z } from "zod";

interface Skill {
    id: string;
    skillName: string;
    category?: string;
    proficiencyLevel?: string;
    yearsOfExperience?: number;
    isPrimary?: boolean;
    description?: string;
}

interface SkillsManagerProps {
    userId: string;
}

const proficiencyColors = {
    beginner: 'bg-gray-200',
    intermediate: 'bg-blue-200',
    advanced: 'bg-green-200',
    expert: 'bg-purple-200',
};

const proficiencyTextColors = {
    beginner: 'text-gray-700',
    intermediate: 'text-blue-700',
    advanced: 'text-green-700',
    expert: 'text-purple-700',
};

export const SkillsManager: React.FC<SkillsManagerProps> = ({ userId }) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const { toast } = useToast();
    const [userBatch, setUserBatch] = useState<number | null>(null);
    const [userAge, setUserAge] = useState<number | null>(null);

    const [formData, setFormData] = useState<Partial<Skill>>({
        skillName: '',
        category: 'technical',
        proficiencyLevel: 'intermediate',
        yearsOfExperience: undefined,
        isPrimary: false,
        description: '',
    })
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Calculate user's age from date of birth
    const calculateAge = (dateOfBirth: string | null | undefined): number | null => {
        if (!dateOfBirth) return null;
        try {
            const birthDate = new Date(dateOfBirth);
            if (isNaN(birthDate.getTime())) return null;
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age > 0 ? age : null;
        } catch {
            return null;
        }
    };

    useEffect(() => {
        fetchSkills();
        fetchUserContext();
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

    const fetchUserContext = async () => {
        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'user-id': userId },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.alumni?.date_of_birth) {
                    const age = calculateAge(data.alumni.date_of_birth);
                    setUserAge(age);
                }
                if (data.alumni?.batch) {
                    // Extract start year from batch string (e.g., "2021", "2021-2025")
                    const match = data.alumni.batch.match(/(\d{4})/);
                    if (match) {
                        setUserBatch(parseInt(match[1]));
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching user context:', error);
        }
    };

    const fetchSkills = async () => {
        try {
            const response = await fetch('/api/profile/skills', {
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                const data = await response.json();
                setSkills(data.skills || []);
            }
        } catch (error) {
            console.error('Error fetching skills:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        // Validate years of experience against user's age and batch
        const newErrors: Record<string, string> = {};
        if (formData.yearsOfExperience !== undefined && formData.yearsOfExperience !== null) {
            const yoe = formData.yearsOfExperience;
            const currentYear = new Date().getFullYear();

            // Smart calculation for max allowed experience
            let maxAllowed = 10; // Default reasonable max for generic profile

            if (userBatch) {
                // If we know their batch (start year or grad year), we can estimate career length
                // Assuming batch usually indicates graduation year or start usage
                // Max experience ~ (Current Year - (Batch - 4))?
                // Simpler: If batch is 2024, max exp is unlikely to be 10 years.
                // Let's assume max professional experience = (Current Year - 2018) for this portal context
                // OR (Current Year - Batch) + 5 (allowing internships/pre-college coding)

                // If Batch is 2021, currentYear 2026 -> 5 years post grad + 3 years early start = 8
                maxAllowed = Math.max(5, (currentYear - userBatch) + 5);
            }

            // Age constraint is hard limit
            if (userAge !== null) {
                const ageBasedMax = userAge < 10 ? userAge : Math.max(userAge - 5, 0);
                maxAllowed = Math.min(maxAllowed, ageBasedMax);
            } else {
                // Fallback if no age but we have context about portal (recent alumni)
                // Cap at 15 years if no other data to prevent obvious outliers
                maxAllowed = Math.min(maxAllowed, 15);
            }

            if (yoe < 0) {
                newErrors.yearsOfExperience = 'Years of experience cannot be negative';
            } else if (yoe > maxAllowed) {
                newErrors.yearsOfExperience = `Years of experience seems too high (${yoe} years) based on your profile`;
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast({
                title: 'Validation Error',
                description: 'Please check the form for errors',
                variant: 'destructive',
            });
            return;
        }

        const validation = skillValidationSchema.safeParse(formData);

        if (!validation.success) {
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
                ? `/api/profile/skills/${editingId}`
                : '/api/profile/skills';

            const method = editingId ? 'PUT' : 'POST';

            // Prepare data for submission - ensure undefined values are handled correctly
            const submitData = {
                ...formData,
                yearsOfExperience: formData.yearsOfExperience !== undefined && formData.yearsOfExperience !== null
                    ? formData.yearsOfExperience
                    : null,
            };

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': userId,
                },
                body: JSON.stringify(submitData),
            });

            if (response.ok) {
                toast({
                    title: 'Success',
                    description: `Skill ${editingId ? 'updated' : 'added'} successfully!`,
                });
                fetchSkills();
                // Trigger profile header refresh
                window.dispatchEvent(new Event('profileUpdated'));
                resetForm();
            } else {
                const error = await response.json();
                toast({
                    title: 'Error',
                    description: error.error || 'Failed to save skill',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save skill',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this skill?')) return;

        try {
            const response = await fetch(`/api/profile/skills/${id}`, {
                method: 'DELETE',
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                toast({
                    title: 'Success',
                    description: 'Skill deleted successfully!',
                });
                fetchSkills();
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete skill',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = (skill: Skill) => {
        setFormData(skill);
        setEditingId(skill.id);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            skillName: '',
            category: 'technical',
            proficiencyLevel: 'intermediate',
            yearsOfExperience: undefined,
            isPrimary: false,
            description: '',
        });
        setEditingId(null);
        setErrors({});
        setShowForm(false);
    };

    const groupedSkills = skills.reduce((acc, skill) => {
        const category = skill.category || 'other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(skill);
        return acc;
    }, {} as Record<string, Skill[]>);

    const categoryLabels: Record<string, string> = {
        technical: 'Technical Skills',
        soft: 'Soft Skills',
        tool: 'Tools & Technologies',
        framework: 'Frameworks & Libraries',
        domain: 'Domain Knowledge',
        other: 'Other Skills',
    };

    const calculateMaxExperience = () => {
        const currentYear = new Date().getFullYear();
        let maxAllowed = 15; // Upper bound fallback

        if (userBatch) {
            // If batch is 2021, max exp = (2026 - 2021) + 2 = 7 years roughly
            maxAllowed = Math.max(5, (currentYear - userBatch) + 5);
        }

        if (userAge !== null) {
            const ageBasedMax = userAge < 10 ? userAge : Math.max(userAge - 5, 0);
            maxAllowed = Math.min(maxAllowed, ageBasedMax);
        }

        return maxAllowed;
    };

    const maxExperience = calculateMaxExperience();

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
            {/* Header ... */}
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-[#008060]" />
                    Skills & Expertise
                </CardTitle>
                <Button
                    onClick={() => setShowForm(true)}
                    className="bg-[#008060] hover:bg-[#007055]"
                    size="sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Skill
                </Button>
            </CardHeader>

            {skills.length > 0 && (
                <CardContent className="space-y-8">
                    {/* Primary Skills */}
                    {skills.some(s => s.isPrimary) && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="bg-yellow-100 p-1 rounded-md">
                                    <Star className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600" />
                                </span>
                                Primary Skills
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {skills.filter(s => s.isPrimary).map((skill) => (
                                    <div
                                        key={skill.id}
                                        className="group relative p-3 bg-gradient-to-br from-[#008060]/5 to-[#008060]/10 border border-[#008060]/20 rounded-lg hover:shadow-md transition-all duration-200"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-semibold text-gray-900 text-sm truncate pr-2">{skill.skillName}</h4>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-white/80 backdrop-blur-sm rounded-md shadow-sm border border-gray-100 p-0.5">
                                                <button
                                                    onClick={() => handleEdit(skill)}
                                                    className="p-1 hover:bg-white rounded text-gray-500 hover:text-[#008060] transition-colors"
                                                >
                                                    <Edit className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(skill.id)}
                                                    className="p-1 hover:bg-red-50 rounded text-gray-500 hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {skill.proficiencyLevel && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-[#008060] border border-[#008060]/20">
                                                    {skill.proficiencyLevel.charAt(0).toUpperCase() + skill.proficiencyLevel.slice(1)}
                                                </span>
                                            )}
                                            {skill.yearsOfExperience && skill.yearsOfExperience > 0 && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-gray-600 border border-gray-200">
                                                    {skill.yearsOfExperience}y
                                                </span>
                                            )}
                                            {skill.category && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-gray-600 border border-gray-200">
                                                    {categoryLabels[skill.category] || skill.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Skills by Category */}
                    <div className="space-y-6">
                        {Object.entries(groupedSkills).map(([category, categorySkills]) => {
                            const nonPrimarySkills = categorySkills.filter(s => !s.isPrimary);
                            if (nonPrimarySkills.length === 0) return null;

                            return (
                                <div key={category} className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-4 capitalize">
                                        {categoryLabels[category] || category}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
                                        {nonPrimarySkills.map((skill) => (
                                            <div
                                                key={skill.id}
                                                className="group relative bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-[#008060]/30 hover:shadow-md transition-all duration-200"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0 mr-2">
                                                        <p className="font-medium text-gray-900 text-sm truncate" title={skill.skillName}>
                                                            {skill.skillName}
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {skill.proficiencyLevel && (
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${skill.proficiencyLevel === 'expert' ? 'bg-purple-50 text-purple-700' :
                                                                    skill.proficiencyLevel === 'advanced' ? 'bg-green-50 text-green-700' :
                                                                        skill.proficiencyLevel === 'intermediate' ? 'bg-blue-50 text-blue-700' :
                                                                            'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                    {skill.proficiencyLevel}
                                                                </span>
                                                            )}
                                                            {skill.yearsOfExperience && skill.yearsOfExperience > 0 && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                                                    {skill.yearsOfExperience}y
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-white shadow-sm rounded-md p-0.5 border border-gray-100">
                                                        <button
                                                            onClick={() => handleEdit(skill)}
                                                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-[#008060] transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(skill.id)}
                                                            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
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
                        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] h-auto overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Sticky Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {editingId ? 'Edit Skill' : 'Add Skill'}
                                </h3>
                                <p className="text-sm text-gray-500">Highlight your expertise</p>
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
                            <form id="skill-form" onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="skillName" className="text-sm font-medium">
                                        Skill Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="skillName"
                                        value={formData.skillName}
                                        onChange={(e) => setFormData({ ...formData, skillName: e.target.value })}
                                        placeholder="React, Python, Leadership, etc."
                                        className={`h-10 ${errors.skillName ? 'border-red-500' : ''}`}
                                        required
                                    />
                                    {errors.skillName && <p className="text-red-500 text-xs mt-1">{errors.skillName}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <select
                                        id="category"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <option value="technical">Technical</option>
                                        <option value="soft">Soft Skills</option>
                                        <option value="tool">Tools & Technologies</option>
                                        <option value="framework">Frameworks & Libraries</option>
                                        <option value="domain">Domain Knowledge</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="proficiencyLevel">Proficiency</Label>
                                        <select
                                            id="proficiencyLevel"
                                            value={formData.proficiencyLevel}
                                            onChange={(e) => setFormData({ ...formData, proficiencyLevel: e.target.value })}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <option value="beginner">Beginner</option>
                                            <option value="intermediate">Intermediate</option>
                                            <option value="advanced">Advanced</option>
                                            <option value="expert">Expert</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="yearsOfExperience">
                                            Years of Experience
                                            <span className="text-xs text-gray-500 ml-1">
                                                (Max: {maxExperience} years)
                                            </span>
                                        </Label>
                                        <Input
                                            id="yearsOfExperience"
                                            type="number"
                                            min="0"
                                            max={maxExperience}
                                            value={formData.yearsOfExperience !== undefined && formData.yearsOfExperience !== null ? formData.yearsOfExperience : ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                // Allow empty string for clearing the field
                                                if (value === '') {
                                                    setFormData({ ...formData, yearsOfExperience: undefined });
                                                    // Clear error when field is cleared
                                                    if (errors.yearsOfExperience) {
                                                        const newErrors = { ...errors };
                                                        delete newErrors.yearsOfExperience;
                                                        setErrors(newErrors);
                                                    }
                                                } else {
                                                    const numValue = parseInt(value);
                                                    if (!isNaN(numValue)) {
                                                        const newErrors = { ...errors };

                                                        // Real-time validation
                                                        if (numValue < 0) {
                                                            newErrors.yearsOfExperience = 'Years of experience cannot be negative';
                                                        } else if (numValue > maxExperience) {
                                                            newErrors.yearsOfExperience = `Cannot exceed ${maxExperience} years based on your profile`;
                                                        } else {
                                                            delete newErrors.yearsOfExperience;
                                                        }

                                                        setFormData({ ...formData, yearsOfExperience: numValue });
                                                        setErrors(newErrors);
                                                    }
                                                }
                                            }}
                                            placeholder="e.g. 5"
                                            className={`h-10 ${errors.yearsOfExperience ? 'border-red-500' : ''}`}
                                        />
                                        {errors.yearsOfExperience && (
                                            <p className="text-red-500 text-xs mt-1">{errors.yearsOfExperience}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.isPrimary}
                                            onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                                            className="w-5 h-5 text-[#008060] rounded border-gray-300 focus:ring-[#008060]"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm font-medium flex items-center gap-2 text-gray-900">
                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                Mark as Primary Skill
                                            </span>
                                            <p className="text-xs text-gray-500 mt-0.5">Primary skills appear at the top of your profile</p>
                                        </div>
                                    </label>
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
                                form="skill-form"
                                variant="brand"
                                className="min-w-[100px]"
                            >
                                {editingId ? 'Save' : 'Add'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};
