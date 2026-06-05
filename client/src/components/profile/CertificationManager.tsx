
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Plus, Award, Edit, Trash2, X, ExternalLink, Calendar } from 'lucide-react';
import { certificationValidationSchema } from "@shared/validation";
import { z } from "zod";

interface Certification {
    id: string;
    certificationName: string;
    issuingOrganization: string;
    issueDate: string;
    duration?: string;
    credentialId?: string;
    credentialUrl?: string;
    skillsGained?: string[];
    description?: string;
}

interface CertificationManagerProps {
    userId: string;
}

export const CertificationManager: React.FC<CertificationManagerProps> = ({ userId }) => {
    const [certifications, setCertifications] = useState<Certification[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const { toast } = useToast();

    const [formData, setFormData] = useState<Partial<Certification>>({
        certificationName: '',
        issuingOrganization: '',
        issueDate: '',
        duration: '',
        credentialId: '',
        credentialUrl: '',
        skillsGained: [],
        description: '',
    });

    // Separate state for duration components
    const [durationYears, setDurationYears] = useState<string>('0');
    const [durationMonths, setDurationMonths] = useState<string>('0');
    const [durationDays, setDurationDays] = useState<string>('0');
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchCertifications();
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

    const fetchCertifications = async () => {
        try {
            const response = await fetch('/api/profile/certifications', {
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                const data = await response.json();
                setCertifications(data.certifications || []);
            }
        } catch (error) {
            console.error('Error fetching certifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        // Build duration string from components
        const years = parseInt(durationYears);
        const months = parseInt(durationMonths);
        const days = parseInt(durationDays);

        let durationString = '';
        if (years === 0 && months === 0 && days === 0) {
            durationString = '';
        } else {
            const parts = [];
            if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
            if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
            if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
            durationString = parts.join(', ');
        }

        const submissionData = {
            ...formData,
            duration: durationString
        };

        const validation = certificationValidationSchema.safeParse(submissionData);

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
                ? `/api/profile/certifications/${editingId}`
                : '/api/profile/certifications';

            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': userId,
                },
                body: JSON.stringify(submissionData),
            });

            if (response.ok) {
                toast({
                    title: 'Success',
                    description: `Certification ${editingId ? 'updated' : 'added'} successfully!`,
                });
                fetchCertifications();
                // Trigger profile header refresh
                window.dispatchEvent(new Event('profileUpdated'));
                resetForm();
            } else {
                const error = await response.json();
                toast({
                    title: 'Error',
                    description: error.error || 'Failed to save certification',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save certification',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this certification?')) return;

        try {
            const response = await fetch(`/api/profile/certifications/${id}`, {
                method: 'DELETE',
                headers: { 'user-id': userId },
            });

            if (response.ok) {
                toast({
                    title: 'Success',
                    description: 'Certification deleted successfully!',
                });
                fetchCertifications();
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete certification',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = (cert: Certification) => {
        setFormData(cert);
        setEditingId(cert.id);

        // Parse existing duration string back into components
        if (cert.duration) {
            const duration = cert.duration.toLowerCase();
            if (duration.includes('lifetime') || duration.includes('no expiry')) {
                setDurationYears('0');
                setDurationMonths('0');
                setDurationDays('0');
            } else {
                // Extract years, months, days from string like "2 years, 3 months"
                const yearMatch = duration.match(/(\d+)\s*year/);
                const monthMatch = duration.match(/(\d+)\s*month/);
                const dayMatch = duration.match(/(\d+)\s*day/);

                setDurationYears(yearMatch ? yearMatch[1] : '0');
                setDurationMonths(monthMatch ? monthMatch[1] : '0');
                setDurationDays(dayMatch ? dayMatch[1] : '0');
            }
        } else {
            setDurationYears('0');
            setDurationMonths('0');
            setDurationDays('0');
        }

        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            certificationName: '',
            issuingOrganization: '',
            issueDate: '',
            duration: '',
            credentialId: '',
            credentialUrl: '',
            skillsGained: [],
            description: '',
        });
        setDurationYears('0');
        setDurationMonths('0');
        setDurationDays('0');
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
                    <Award className="w-5 h-5 text-[#008060]" />
                    Certifications
                </CardTitle>
                <Button
                    onClick={() => setShowForm(true)}
                    className="bg-[#008060] hover:bg-[#007055]"
                    size="sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Certification
                </Button>
            </CardHeader>

            {certifications.length > 0 && (
                <CardContent className="space-y-4">
                    {/* Certification List */}
                    <div className="space-y-4">
                        {certifications.map((cert) => (
                            <div
                                key={cert.id}
                                className="border border-gray-200 rounded-lg p-4 hover:border-[#008060] transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg text-gray-900">{cert.certificationName}</h3>
                                        <p className="text-[#008060] font-medium">{cert.issuingOrganization}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(cert)}
                                            className="text-gray-600 hover:text-[#008060]"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(cert.id)}
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
                                            <span>
                                                Issued: {formatDate(cert.issueDate)}
                                                {cert.duration && ` · Duration: ${cert.duration}`}
                                            </span>
                                        </div>
                                        {cert.credentialId && (
                                            <div className="text-gray-500">
                                                ID: {cert.credentialId}
                                            </div>
                                        )}
                                        {cert.credentialUrl && (
                                            <a
                                                href={cert.credentialUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-[#008060] hover:underline"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Show Credential
                                            </a>
                                        )}
                                    </div>

                                    {cert.description && (
                                        <p className="text-gray-700 mt-2">{cert.description}</p>
                                    )}

                                    {cert.skillsGained && cert.skillsGained.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {cert.skillsGained.map((skill, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
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
                        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] h-auto overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Sticky Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    {editingId ? 'Edit Certification' : 'Add Certification'}
                                </h3>
                                <p className="text-sm text-gray-500">Show off your credentials</p>
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
                            <form id="cert-form" onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="certificationName" className="text-sm font-medium">
                                        Certification Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="certificationName"
                                        value={formData.certificationName}
                                        onChange={(e) => setFormData({ ...formData, certificationName: e.target.value })}
                                        placeholder="e.g. AWS Certified Solutions Architect"
                                        className={`h-10 ${errors.certificationName ? 'border-red-500' : ''}`}
                                        required
                                    />
                                    {errors.certificationName && <p className="text-red-500 text-xs mt-1">{errors.certificationName}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="issuingOrganization" className="text-sm font-medium">
                                        Issuing Organization <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="issuingOrganization"
                                        value={formData.issuingOrganization}
                                        onChange={(e) => setFormData({ ...formData, issuingOrganization: e.target.value })}
                                        placeholder="e.g. Amazon Web Services"
                                        className={`h-10 ${errors.issuingOrganization ? 'border-red-500' : ''}`}
                                        required
                                    />
                                    {errors.issuingOrganization && <p className="text-red-500 text-xs mt-1">{errors.issuingOrganization}</p>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="issueDate" className="text-sm font-medium">
                                            Issue Date <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="issueDate"
                                            type="date"
                                            value={formData.issueDate}
                                            onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                                            className={`h-10 ${errors.issueDate ? 'border-red-500' : ''}`}
                                            required
                                        />
                                        {errors.issueDate && <p className="text-red-500 text-xs mt-1">{errors.issueDate}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">
                                            Duration
                                        </Label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <Label htmlFor="durationYears" className="text-xs text-gray-600">Years</Label>
                                                <Select
                                                    value={durationYears}
                                                    onValueChange={setDurationYears}
                                                >
                                                    <SelectTrigger id="durationYears">
                                                        <SelectValue placeholder="0" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-[200px] z-[200]">
                                                        {Array.from({ length: 51 }, (_, i) => i).map(y => (
                                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="durationMonths" className="text-xs text-gray-600">Months</Label>
                                                <Select
                                                    value={durationMonths}
                                                    onValueChange={setDurationMonths}
                                                >
                                                    <SelectTrigger id="durationMonths">
                                                        <SelectValue placeholder="0" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-[200px] z-[200]">
                                                        {Array.from({ length: 13 }, (_, i) => i).map(m => (
                                                            <SelectItem key={m} value={m.toString()}>{m}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="durationDays" className="text-xs text-gray-600">Days</Label>
                                                <Select
                                                    value={durationDays}
                                                    onValueChange={setDurationDays}
                                                >
                                                    <SelectTrigger id="durationDays">
                                                        <SelectValue placeholder="0" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-[200px] z-[200]">
                                                        {Array.from({ length: 30 }, (_, i) => i).map(d => (
                                                            <SelectItem key={d} value={d.toString()}>{d}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {parseInt(durationYears) === 0 && parseInt(durationMonths) === 0 && parseInt(durationDays) === 0
                                                ? ''
                                                : `Valid for: ${(() => {
                                                    const parts = [];
                                                    if (parseInt(durationYears) > 0) parts.push(`${durationYears} year${parseInt(durationYears) > 1 ? 's' : ''}`);
                                                    if (parseInt(durationMonths) > 0) parts.push(`${durationMonths} month${parseInt(durationMonths) > 1 ? 's' : ''}`);
                                                    if (parseInt(durationDays) > 0) parts.push(`${durationDays} day${parseInt(durationDays) > 1 ? 's' : ''}`);
                                                    return parts.join(', ');
                                                })()}`
                                            }
                                        </p>
                                        {errors.duration && <p className="text-red-500 text-xs mt-1">{errors.duration}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="credentialId" className="text-sm font-medium">Credential ID</Label>
                                        <Input
                                            id="credentialId"
                                            value={formData.credentialId}
                                            onChange={(e) => setFormData({ ...formData, credentialId: e.target.value })}
                                            placeholder="e.g., ABC123XYZ"
                                            className="h-10"
                                        />
                                        {errors.credentialId && <p className="text-red-500 text-xs mt-1">{errors.credentialId}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="credentialUrl" className="text-sm font-medium">Credential URL</Label>
                                        <div className="relative">
                                            <ExternalLink className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                            <Input
                                                id="credentialUrl"
                                                value={formData.credentialUrl}
                                                onChange={(e) => setFormData({ ...formData, credentialUrl: e.target.value })}
                                                placeholder="https://example.com/credential"
                                                className={`pl-10 h-10 ${errors.credentialUrl ? 'border-red-500' : ''}`}
                                            />
                                        </div>
                                        {errors.credentialUrl && <p className="text-red-500 text-xs mt-1">{errors.credentialUrl}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe what you learned or achieved..."
                                        rows={3}
                                        className={`resize-none ${errors.description ? 'border-red-500' : ''}`}
                                    />
                                    {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
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
                                form="cert-form"
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
