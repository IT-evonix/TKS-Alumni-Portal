import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
    FolderGit2,
    Trash2,
    Pencil,
    Plus,
    Calendar,
    Link as LinkIcon,
    X
} from "lucide-react";
import { format } from "date-fns";
import { projectValidationSchema } from "@shared/validation";
import { z } from "zod";

interface Project {
    id: string;
    projectName: string;
    description: string;
    startDate: string;
    endDate: string | null;
    projectUrl?: string;
    technologiesUsed: string[];
}

interface ProjectManagerProps {
    userId: string;
}

export const ProjectManager = ({ userId }: ProjectManagerProps): JSX.Element => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        projectName: "",
        description: "",
        startDate: "",
        endDate: "",
        projectUrl: "",
        technologiesUsed: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/profile/projects', {
                headers: { 'user-id': userId }
            });
            if (response.ok) {
                const data = await response.json();
                setProjects(data.projects);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchProjects();
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

    const handleOpenDialog = (project?: Project) => {
        if (project) {
            setEditingProject(project);
            setFormData({
                projectName: project.projectName,
                description: project.description,
                startDate: project.startDate ? project.startDate.split('T')[0] : "",
                endDate: project.endDate ? project.endDate.split('T')[0] : "",
                projectUrl: project.projectUrl || "",
                technologiesUsed: project.technologiesUsed?.join(', ') || "",
            });
        } else {
            setEditingProject(null);
            setFormData({
                projectName: "",
                description: "",
                startDate: "",
                endDate: "",
                projectUrl: "",
                technologiesUsed: "",
            });
        }
        setIsDialogOpen(true);
        setErrors({});
    };

    const handleSave = async () => {
        setErrors({});

        // Prepare data for validation - technologiesUsed expects array in schema if I remember correctly?
        // Checking shared/validation.ts: technologiesUsed: z.array(z.string()).optional()
        // But here formData has string. I need to transform it for validation or schema handles it?
        // Wait, safeParse(req.body) on backend expects what?
        // Schema: technologiesUsed: z.array(z.string()).optional()
        // Here formData.technologiesUsed is string.
        // Let's coerce validation data.

        const payloadForValidation = {
            ...formData,
            technologiesUsed: formData.technologiesUsed.split(',').map(s => s.trim()).filter(Boolean)
        };

        const validation = projectValidationSchema.safeParse(payloadForValidation);

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
            const url = editingProject
                ? `/api/profile/projects/${editingProject.id}`
                : '/api/profile/projects';

            const method = editingProject ? 'PUT' : 'POST';

            const payload = {
                ...formData,
                technologiesUsed: formData.technologiesUsed.split(',').map(s => s.trim()).filter(Boolean)
            };

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': userId
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: `Project ${editingProject ? 'updated' : 'added'} successfully`,
                });
                setIsDialogOpen(false);
                fetchProjects();
                // Trigger profile header refresh
                window.dispatchEvent(new Event('profileUpdated'));
            } else {
                throw new Error('Failed to save project');
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
            const response = await fetch(`/api/profile/projects/${id}`, {
                method: 'DELETE',
                headers: {
                    'user-id': userId
                }
            });

            if (response.ok) {
                toast({
                    title: "Success",
                    description: "Project deleted successfully",
                });
                fetchProjects();
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete project",
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
        return <div>Loading projects...</div>;
    }

    return (
        <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <FolderGit2 className="w-5 h-5 text-[#008060]" />
                    Projects
                </CardTitle>
                <Button
                    onClick={() => handleOpenDialog()}
                    className="bg-[#008060] hover:bg-[#007055]"
                    size="sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Project
                </Button>
            </CardHeader>

            {projects.length > 0 && (
                <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        {projects.map((project) => (
                            <Card key={project.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">{project.projectName}</h3>
                                        <div className="flex gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                onClick={() => handleOpenDialog(project)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(project.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                        <Calendar className="w-3 h-3" />
                                        <span>
                                            {safeFormatDate(project.startDate)}
                                            {project.endDate && ` - ${safeFormatDate(project.endDate)}`}
                                        </span>
                                    </div>

                                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{project.description}</p>

                                    {project.technologiesUsed && project.technologiesUsed.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {project.technologiesUsed.map((tech, i) => (
                                                <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                                    {tech}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {project.projectUrl && (
                                        <a
                                            href={project.projectUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm text-[#008060] hover:underline"
                                        >
                                            <LinkIcon className="w-3 h-3" /> View Project
                                        </a>
                                    )}
                                </CardContent>
                            </Card>
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
                                    {editingProject ? 'Edit Project' : 'Add Project'}
                                </h3>
                                <p className="text-sm text-gray-500">Showcase your best work</p>
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
                            <form id="project-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="projectName" className="text-sm font-medium">
                                        Project Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="projectName"
                                        value={formData.projectName}
                                        onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                                        placeholder="Ex: E-commerce Platform"
                                        className={`h-10 ${errors.projectName ? 'border-red-500' : ''}`}
                                        required
                                    />
                                    {errors.projectName && <p className="text-red-500 text-xs mt-1">{errors.projectName}</p>}
                                </div>

                                {/* Dates */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="startDate">Start Date</Label>
                                        <Input
                                            id="startDate"
                                            type="date"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                            className={`h-10 ${errors.startDate ? 'border-red-500' : ''}`}
                                        />
                                        {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="endDate">End Date</Label>
                                        <Input
                                            id="endDate"
                                            type="date"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                            className={`h-10 ${errors.endDate ? 'border-red-500' : ''}`}
                                        />
                                        {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="technologiesUsed">Technologies Used</Label>
                                    <Input
                                        id="technologiesUsed"
                                        value={formData.technologiesUsed}
                                        onChange={(e) => setFormData({ ...formData, technologiesUsed: e.target.value })}
                                        placeholder="Ex: React, Node.js, PostgreSQL (comma separated)"
                                        className="h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="projectUrl">Project URL</Label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="projectUrl"
                                            value={formData.projectUrl}
                                            onChange={(e) => setFormData({ ...formData, projectUrl: e.target.value })}
                                            placeholder="https://github.com/username/project"
                                            className={`pl-10 h-10 ${errors.projectUrl ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                    {errors.projectUrl && <p className="text-red-500 text-xs mt-1">{errors.projectUrl}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={5}
                                        placeholder="Describe the project, your specific role, the problems you solved, and the outcomes achieved..."
                                        className={`resize-none ${errors.description ? 'border-red-500' : ''}`}
                                        required
                                    />
                                    {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
                                    <p className="text-xs text-gray-500 text-right">
                                        {formData.description.length}/2000 characters
                                    </p>
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
                                form="project-form"
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
