
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trophy, Edit, Trash2, X, ExternalLink, Calendar } from 'lucide-react';
import { achievementValidationSchema } from "@shared/validation";
import { z } from "zod";

interface Achievement {
    id: string;
    achievementType: string;
    title: string;
    description?: string;
    issuingOrganization?: string;
    dateReceived: string;
    category?: string;
    level?: string;
    url?: string;
    isFeatured?: boolean;
}

interface AchievementManagerProps {
    userId: string;
}

export const AchievementManager: React.FC<AchievementManagerProps> = ({ userId }) => {
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const { toast } = useToast();

    const [formData, setFormData] = useState<Partial<Achievement>>({
        achievementType: 'award',
        title: '',
        description: '',
        issuingOrganization: '',
        dateReceived: '',
        category: '',
        level: '',
        url: '',
        isFeatured: false,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchAchievements();
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

    const fetchAchievements = async () => {
        try {
            const response = await fetch('/api/profile/achievements', {
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                const data = await response.json();
                setAchievements(data.achievements || []);
            }
        } catch (error) {
            console.error('Error fetching achievements:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const validation = achievementValidationSchema.safeParse(formData);

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
                ? `/api/profile/achievements/${editingId}`
                : '/api/profile/achievements';

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
                    description: `Achievement ${editingId ? 'updated' : 'added'} successfully!`,
                });
                fetchAchievements();
                // Trigger profile header refresh
                window.dispatchEvent(new Event('profileUpdated'));
                resetForm();
            } else {
                const error = await response.json();
                toast({
                    title: 'Error',
                    description: error.error || 'Failed to save achievement',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save achievement',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this achievement?')) return;

        try {
            const response = await fetch(`/api/profile/achievements/${id}`, {
                method: 'DELETE',
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                toast({
                    title: 'Success',
                    description: 'Achievement deleted successfully!',
                });
                fetchAchievements();
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete achievement',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = (item: Achievement) => {
        setFormData(item);
        setEditingId(item.id);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            achievementType: 'award',
            title: '',
            description: '',
            issuingOrganization: '',
            dateReceived: '',
            category: '',
            level: '',
            url: '',
            isFeatured: false,
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
                    <Trophy className="w-5 h-5 text-[#008060]" />
                    Achievements & Awards
                </CardTitle>
                <Button
                    onClick={() => setShowForm(true)}
                    className="bg-[#008060] hover:bg-[#007055]"
                    size="sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Achievement
                </Button>
            </CardHeader>

            {achievements.length > 0 && (
                <CardContent className="space-y-4">
                    {/* List */}
                    <div className="space-y-4">
                        {achievements.map((item) => (
                            <div
                                key={item.id}
                                className="border border-gray-200 rounded-lg p-4 hover:border-[#008060] transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-lg text-gray-900">{item.title}</h3>
                                            {item.isFeatured && (
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                                    Featured
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[#008060] font-medium">{item.achievementType.toUpperCase()} {item.issuingOrganization && `· ${item.issuingOrganization}`}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(item)}
                                            className="text-gray-600 hover:text-[#008060]"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(item.id)}
                                            className="text-gray-600 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-gray-600">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            <span>Received: {formatDate(item.dateReceived)}</span>
                                        </div>
                                        {item.level && (
                                            <div className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium">
                                                {item.level}
                                            </div>
                                        )}
                                        {item.url && (
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-[#008060] hover:underline"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                See Detail
                                            </a>
                                        )}
                                    </div>

                                    {item.description && (
                                        <p className="text-gray-700 mt-2">{item.description}</p>
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
                        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] h-auto overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Sticky Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {editingId ? 'Edit Achievement' : 'Add Achievement'}
                                </h3>
                                <p className="text-sm text-gray-500">Showcase your awards and wins</p>
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
                            <form id="achievement-form" onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="achievementType" className="text-sm font-medium">
                                            Type <span className="text-red-500">*</span>
                                        </Label>
                                        <select
                                            id="achievementType"
                                            value={formData.achievementType}
                                            onChange={(e) => setFormData({ ...formData, achievementType: e.target.value })}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <option value="award">Award</option>
                                            <option value="scholarship">Scholarship</option>
                                            <option value="publication">Publication</option>
                                            <option value="patent">Patent</option>
                                            <option value="competition">Competition</option>
                                            <option value="other">Other</option>
                                        </select>
                                        {errors.achievementType && <p className="text-red-500 text-xs mt-1">{errors.achievementType}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="level" className="text-sm font-medium">Level</Label>
                                        <select
                                            id="level"
                                            value={formData.level}
                                            onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            <option value="">Select Level</option>
                                            <option value="international">International</option>
                                            <option value="national">National</option>
                                            <option value="state">State/Regional</option>
                                            <option value="local">Local/Institutional</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="title" className="text-sm font-medium">
                                        Title <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Winner of National Coding Contest"
                                        className={`h-10 ${errors.title ? 'border-red-500' : ''}`}
                                        required
                                    />
                                    {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="issuingOrganization" className="text-sm font-medium">
                                        Issuing Organization
                                    </Label>
                                    <Input
                                        id="issuingOrganization"
                                        value={formData.issuingOrganization}
                                        onChange={(e) => setFormData({ ...formData, issuingOrganization: e.target.value })}
                                        placeholder="e.g. Google, IEEE, University"
                                        className={`h-10 ${errors.issuingOrganization ? 'border-red-500' : ''}`}
                                    />
                                    {errors.issuingOrganization && <p className="text-red-500 text-xs mt-1">{errors.issuingOrganization}</p>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="dateReceived" className="text-sm font-medium">
                                            Date Received <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="dateReceived"
                                            type="date"
                                            value={formData.dateReceived}
                                            onChange={(e) => setFormData({ ...formData, dateReceived: e.target.value })}
                                            className={`h-10 ${errors.dateReceived ? 'border-red-500' : ''}`}
                                            required
                                        />
                                        {errors.dateReceived && <p className="text-red-500 text-xs mt-1">{errors.dateReceived}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="url" className="text-sm font-medium">URL</Label>
                                        <div className="relative">
                                            <ExternalLink className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                            <Input
                                                id="url"
                                                value={formData.url}
                                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                                placeholder="Link to proof or details"
                                                className={`pl-10 h-10 ${errors.url ? 'border-red-500' : ''}`}
                                            />
                                        </div>
                                        {errors.url && <p className="text-red-500 text-xs mt-1">{errors.url}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className={`resize-none ${errors.description ? 'border-red-500' : ''}`}
                                    />
                                    {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.isFeatured}
                                            onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                                            className="w-5 h-5 text-[#008060] rounded border-gray-300 focus:ring-[#008060]"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm font-medium flex items-center gap-2 text-gray-900">
                                                <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                Feature on Profile
                                            </span>
                                            <p className="text-xs text-gray-500 mt-0.5">Featured achievements appear prominently</p>
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
                                form="achievement-form"
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
