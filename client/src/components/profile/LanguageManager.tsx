
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Languages, Edit, Trash2, X } from 'lucide-react';
import { languageValidationSchema } from "@shared/validation";
import { z } from "zod";

interface Language {
    id: string;
    languageName: string;
    proficiencyLevel: string;
    canRead: boolean;
    canWrite: boolean;
    canSpeak: boolean;
    isNative: boolean;
}

interface LanguageManagerProps {
    userId: string;
}

export const LanguageManager: React.FC<LanguageManagerProps> = ({ userId }) => {
    const [languages, setLanguages] = useState<Language[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const { toast } = useToast();

    const [formData, setFormData] = useState<Partial<Language>>({
        languageName: '',
        proficiencyLevel: 'intermediate',
        canRead: true,
        canWrite: true,
        canSpeak: true,
        isNative: false,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchLanguages();
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

    const fetchLanguages = async () => {
        try {
            const response = await fetch('/api/profile/languages', {
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                const data = await response.json();
                setLanguages(data.languages || []);
            }
        } catch (error) {
            console.error('Error fetching languages:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const validation = languageValidationSchema.safeParse(formData);

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
                ? `/api/profile/languages/${editingId}`
                : '/api/profile/languages';

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
                    description: `Language ${editingId ? 'updated' : 'added'} successfully!`,
                });
                fetchLanguages();
                // Trigger profile header refresh
                window.dispatchEvent(new Event('profileUpdated'));
                resetForm();
            } else {
                const error = await response.json();
                toast({
                    title: 'Error',
                    description: error.error || 'Failed to save language',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save language',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this language?')) return;

        try {
            const response = await fetch(`/api/profile/languages/${id}`, {
                method: 'DELETE',
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                toast({
                    title: 'Success',
                    description: 'Language deleted successfully!',
                });
                fetchLanguages();
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete language',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = (lang: Language) => {
        setFormData(lang);
        setEditingId(lang.id);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            languageName: '',
            proficiencyLevel: 'intermediate',
            canRead: true,
            canWrite: true,
            canSpeak: true,
            isNative: false,
        });
        setEditingId(null);
        setErrors({});
        setShowForm(false);
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
                    <Languages className="w-5 h-5 text-[#008060]" />
                    Languages
                </CardTitle>
                <Button
                    onClick={() => setShowForm(true)}
                    className="bg-[#008060] hover:bg-[#007055]"
                    size="sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Language
                </Button>
            </CardHeader>

            {languages.length > 0 && (
                <CardContent className="space-y-4">
                    {/* List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {languages.map((lang) => (
                            <div
                                key={lang.id}
                                className="border border-gray-200 rounded-lg p-4 hover:border-[#008060] transition-colors flex justify-between items-center"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-lg text-gray-900">{lang.languageName}</h3>
                                        {lang.isNative && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                                Native
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 capitalize">{lang.proficiencyLevel}</p>
                                    <div className="flex gap-2 mt-1 text-xs text-gray-500">
                                        {lang.canRead && <span>Read</span>}
                                        {lang.canRead && lang.canWrite && <span>·</span>}
                                        {lang.canWrite && <span>Write</span>}
                                        {(lang.canRead || lang.canWrite) && lang.canSpeak && <span>·</span>}
                                        {lang.canSpeak && <span>Speak</span>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(lang)}
                                        className="text-gray-600 hover:text-[#008060]"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(lang.id)}
                                        className="text-gray-600 hover:text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
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
                        className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] h-auto overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Sticky Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {editingId ? 'Edit Language' : 'Add Language'}
                                </h3>
                                <p className="text-sm text-gray-500">Add languages you know</p>
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
                            <form id="lang-form" onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="languageName" className="text-sm font-medium">
                                        Language <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="languageName"
                                        value={formData.languageName}
                                        onChange={(e) => setFormData({ ...formData, languageName: e.target.value })}
                                        placeholder="e.g. English, French"
                                        className={`h-10 ${errors.languageName ? 'border-red-500' : ''}`}
                                        required
                                    />
                                    {errors.languageName && <p className="text-red-500 text-xs mt-1">{errors.languageName}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="proficiencyLevel" className="text-sm font-medium">Proficiency</Label>
                                    <select
                                        id="proficiencyLevel"
                                        value={formData.proficiencyLevel}
                                        onChange={(e) => setFormData({ ...formData, proficiencyLevel: e.target.value })}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <option value="basic">Basic</option>
                                        <option value="conversational">Conversational</option>
                                        <option value="fluent">Fluent</option>
                                        <option value="native">Native/Bilingual</option>
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Capabilities</Label>
                                    <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={formData.canRead}
                                                onChange={(e) => setFormData({ ...formData, canRead: e.target.checked })}
                                                className="w-4 h-4 text-[#008060] rounded border-gray-300 focus:ring-[#008060]"
                                            />
                                            <span className="text-sm">Read</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={formData.canWrite}
                                                onChange={(e) => setFormData({ ...formData, canWrite: e.target.checked })}
                                                className="w-4 h-4 text-[#008060] rounded border-gray-300 focus:ring-[#008060]"
                                            />
                                            <span className="text-sm">Write</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer hover:text-gray-900 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={formData.canSpeak}
                                                onChange={(e) => setFormData({ ...formData, canSpeak: e.target.checked })}
                                                className="w-4 h-4 text-[#008060] rounded border-gray-300 focus:ring-[#008060]"
                                            />
                                            <span className="text-sm">Speak</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.isNative}
                                            onChange={(e) => setFormData({ ...formData, isNative: e.target.checked })}
                                            className="w-5 h-5 text-[#008060] rounded border-gray-300 focus:ring-[#008060]"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm font-medium flex items-center gap-2 text-gray-900">
                                                Native Language
                                            </span>
                                            <p className="text-xs text-gray-500 mt-0.5">This is my first language</p>
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
                                form="lang-form"
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
