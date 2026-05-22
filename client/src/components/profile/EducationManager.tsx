import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
    Building2,
    Trash2,
    Pencil,
    Plus,
    Calendar,
    GraduationCap,
    X
} from "lucide-react";
import { format } from "date-fns";
import { educationValidationSchema } from "@shared/validation";
import { z } from "zod";

interface Education {
    id: string;
    school: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string | null;
    grade: string;
    activities: string;
    description: string;
    isCurrent: boolean;
}

interface EducationManagerProps {
    userId: string;
}

export const EducationManager = ({ userId }: EducationManagerProps): JSX.Element => {
    const [educationList, setEducationList] = useState<Education[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEducation, setEditingEducation] = useState<Education | null>(null);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        school: "",
        degree: "",
        fieldOfStudy: "",
        startDate: "",
        endDate: "",
        grade: "",
        activities: "",
        description: "",
        isCurrent: false,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fetchEducation = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/profile/education', {
                headers: { 'user-id': userId }
            });
            if (response.ok) {
                const data = await response.json();
                setEducationList(data.education);
            }
        } catch (error) {
            console.error('Error fetching education:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchEducation();
        }
    }, [userId]);

    // Scroll lock when modal is open
    useEffect(() => {
        if (isDialogOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isDialogOpen]);

    const handleOpenDialog = (education?: Education) => {
        if (education) {
            setEditingEducation(education);
            setFormData({
                school: education.school,
                degree: education.degree,
                fieldOfStudy: education.fieldOfStudy || "",
                startDate: education.startDate ? education.startDate.split('T')[0] : "",
                endDate: education.endDate ? education.endDate.split('T')[0] : "",
                grade: education.grade || "",
                activities: education.activities || "",
                description: education.description || "",
                isCurrent: education.isCurrent,
            });
        } else {
            setEditingEducation(null);
            setFormData({
                school: "",
                degree: "",
                fieldOfStudy: "",
                startDate: "",
                endDate: "",
                grade: "",
                activities: "",
                description: "",
                isCurrent: false,
            });
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        setErrors({});
        // Validate form data
        const validation = educationValidationSchema.safeParse(formData);

        if (!validation.success) {
            const newErrors: Record<string, string> = {};
            validation.error.errors.forEach((err) => {
                if (err.path[0]) {
                    newErrors[err.path[0] as string] = err.message;
                }
            });
            setErrors(newErrors);
            toast({
                title: "Validation Error",
                description: "Please check the form for errors",
                variant: "destructive",
            });
            return;
        }

        try {
            const url = editingEducation
                ? `/api/profile/education/${editingEducation.id}`
                : '/api/profile/education';

            const method = editingEducation ? 'PUT' : 'POST';

            // Prepare data for submission - ensure endDate is null if isCurrent is true
            const submitData = {
                ...formData,
                endDate: formData.isCurrent ? null : (formData.endDate || null),
                grade: formData.grade || null,
                activities: formData.activities || null,
                description: formData.description || null,
                fieldOfStudy: formData.fieldOfStudy || null,
            };

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': userId
                },
                body: JSON.stringify(submitData)
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: `Education ${editingEducation ? 'updated' : 'added'} successfully`,
                });
                setIsDialogOpen(false);
                fetchEducation();
                // Trigger profile header refresh
                window.dispatchEvent(new Event('profileUpdated'));
            } else {
                throw new Error('Failed to save education');
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save changes",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`/api/profile/education/${id}`, {
                method: 'DELETE',
                headers: {
                    'user-id': userId
                }
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Education deleted successfully",
                });
                fetchEducation();
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete education",
                variant: "destructive",
            });
        }
    };

    const safeFormatDate = (dateString: string | null | undefined): string => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            return format(date, 'MMM yyyy');
        } catch {
            return '';
        }
    };

    if (loading) {
        return <div>Loading education...</div>;
    }

    return (
        <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[#008060]" />
                    Education
                </CardTitle>
                <Button
                    onClick={() => handleOpenDialog()}
                    className="bg-[#008060] hover:bg-[#007055]"
                    size="sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Education
                </Button>
            </CardHeader>

            {educationList.length > 0 && (
                <CardContent className="space-y-6">
                    <div className="space-y-6">
                        {educationList.map((edu) => (
                            <div key={edu.id} className="relative pl-6 border-l-2 border-gray-200 last:border-0 group">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-[#008060]" />

                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-semibold text-lg text-gray-900">{edu.school}</h3>
                                        <p className="text-gray-700 font-medium">
                                            {edu.degree}
                                            {edu.fieldOfStudy && ` in ${edu.fieldOfStudy}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            onClick={() => handleOpenDialog(edu)}
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleDelete(edu.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                    <Calendar className="w-4 h-4" />
                                    <span>
                                        {safeFormatDate(edu.startDate)} - {edu.isCurrent ? 'Present' : safeFormatDate(edu.endDate)}
                                    </span>
                                </div>

                                {edu.grade && (
                                    <p className="text-sm text-gray-600 mb-1">Grade: {edu.grade}</p>
                                )}

                                {edu.activities && (
                                    <p className="text-sm text-gray-600 mb-1">Activities: {edu.activities}</p>
                                )}

                                {edu.description && (
                                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{edu.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
            )}

            {/* Add/Edit Modal */}
            {isDialogOpen && (
                <div
                    className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
                    onClick={() => setIsDialogOpen(false)}
                >
                    <div
                        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] h-auto overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Sticky Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {editingEducation ? 'Edit Education' : 'Add Education'}
                                </h3>
                                <p className="text-sm text-gray-500">Add details about your educational background</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsDialogOpen(false)}
                                className="rounded-full hover:bg-gray-100 -mr-2"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </Button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
                            <form id="education-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="school" className="text-sm font-medium">
                                        School / University <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="school"
                                        value={formData.school}
                                        onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                                        placeholder="Ex: Boston University"
                                        className={`h-10 ${errors.school ? 'border-red-500' : ''}`}
                                        required
                                    />
                                    {errors.school && <p className="text-red-500 text-xs mt-1">{errors.school}</p>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="degree" className="text-sm font-medium">
                                            Degree <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="degree"
                                            value={formData.degree}
                                            onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                                            placeholder="Ex: Bachelor's"
                                            className={`h-10 ${errors.degree ? 'border-red-500' : ''}`}
                                            required
                                        />
                                        {errors.degree && <p className="text-red-500 text-xs mt-1">{errors.degree}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fieldOfStudy" className="text-sm font-medium">
                                            Field of Study
                                        </Label>
                                        <Input
                                            id="fieldOfStudy"
                                            value={formData.fieldOfStudy}
                                            onChange={(e) => setFormData({ ...formData, fieldOfStudy: e.target.value })}
                                            placeholder="Ex: Business"
                                            className="h-10"
                                        />
                                    </div>
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
                                            I am currently studying here
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
                                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                                required
                                                className={`h-10 ${errors.startDate ? 'border-red-500' : ''}`}
                                            />
                                            {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="endDate" className={formData.isCurrent ? 'text-gray-400' : ''}>
                                                End Date
                                            </Label>
                                            <Input
                                                id="endDate"
                                                type="date"
                                                value={formData.endDate}
                                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                                disabled={formData.isCurrent}
                                                className={`h-10 ${formData.isCurrent ? 'bg-gray-50 text-gray-400' : ''} ${errors.endDate ? 'border-red-500' : ''}`}
                                            />
                                            {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="grade">Grade (Optional)</Label>
                                    <Input
                                        id="grade"
                                        value={formData.grade}
                                        onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                                        placeholder="Ex: 3.8/4.0"
                                        className="h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="activities">Activities and Societies</Label>
                                    <Textarea
                                        id="activities"
                                        value={formData.activities}
                                        onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
                                        placeholder="Ex: Volleyball, Drama Club"
                                        rows={2}
                                        className="resize-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Description of your studies, awards, etc."
                                        rows={4}
                                        className="resize-none"
                                    />
                                </div>
                            </form>
                        </div>

                        {/* Footer - Always visible at bottom */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0 rounded-b-xl">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                className="min-w-[80px]"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="education-form"
                                variant="brand"
                                className="min-w-[100px]"
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};
