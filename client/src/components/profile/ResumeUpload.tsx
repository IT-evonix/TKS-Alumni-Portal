import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Trash2, Download, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ResumeUploadProps {
    userId: string;
    currentResumeUrl?: string;
    onResumeUpdate: (resumeUrl: string | null) => void;
}

export function ResumeUpload({ userId, currentResumeUrl, onResumeUpdate }: ResumeUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { toast } = useToast();

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            toast({
                title: 'Invalid file type',
                description: 'Please upload a PDF or Word document (.pdf, .doc, .docx)',
                variant: 'destructive',
            });
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            toast({
                title: 'File too large',
                description: 'Resume must be less than 5MB',
                variant: 'destructive',
            });
            return;
        }

        setUploading(true);

        try {
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('resume', file);

            // Upload via backend API
            const response = await fetch('/api/resume/upload', {
                method: 'POST',
                headers: {
                    'user-id': userId,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to upload resume');
            }

            const data = await response.json();
            onResumeUpdate(data.resumeUrl);

            toast({
                title: 'Resume uploaded successfully',
                description: 'Your resume has been saved to your profile',
            });
        } catch (error) {
            console.error('Resume upload error:', error);
            toast({
                title: 'Upload failed',
                description: error instanceof Error ? error.message : 'Failed to upload resume',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
            // Reset input
            event.target.value = '';
        }
    };

    const handleDelete = async () => {
        if (!currentResumeUrl) return;

        setDeleting(true);

        try {
            // Delete via backend API
            const response = await fetch('/api/resume/delete', {
                method: 'DELETE',
                headers: {
                    'user-id': userId,
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete resume');
            }

            onResumeUpdate(null);

            toast({
                title: 'Resume deleted',
                description: 'Your resume has been removed from your profile',
            });
        } catch (error) {
            console.error('Resume delete error:', error);
            toast({
                title: 'Delete failed',
                description: error instanceof Error ? error.message : 'Failed to delete resume',
                variant: 'destructive',
            });
        } finally {
            setDeleting(false);
        }
    };

    const handleDownload = () => {
        if (currentResumeUrl) {
            window.open(currentResumeUrl, '_blank');
        }
    };

    return (
        <Card id="resume-section" className="border-0 shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#008060]" />
                    Resume
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Upload your resume</p>
                        <p className="text-xs text-blue-700">
                            Accepted formats: PDF, DOC, DOCX (Max size: 5MB). Your resume will be visible to your connections.
                        </p>
                    </div>
                </div>

                {currentResumeUrl ? (
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">Resume uploaded</p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {currentResumeUrl.split('/').pop()?.split('_')[1] || 'resume.pdf'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownload}
                                    className="text-[#008060] border-[#008060] hover:bg-[#008060] hover:text-white w-full sm:w-auto min-h-[44px] sm:min-h-[auto] text-sm sm:text-sm flex items-center justify-center gap-1.5 sm:gap-1"
                                >
                                    <Download className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
                                    <span className="whitespace-nowrap">View</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="text-red-600 border-red-300 hover:bg-red-50 w-full sm:w-auto min-h-[44px] sm:min-h-[auto] text-sm sm:text-sm flex items-center justify-center gap-1.5 sm:gap-1 disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
                                    <span className="whitespace-nowrap">{deleting ? 'Deleting...' : 'Delete'}</span>
                                </Button>
                            </div>
                        </div>

                        <div className="relative">
                            <input
                                type="file"
                                id="resume-replace"
                                accept=".pdf,.doc,.docx"
                                onChange={handleFileUpload}
                                disabled={uploading}
                                className="hidden"
                            />
                            <label htmlFor="resume-replace">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    disabled={uploading}
                                    asChild
                                >
                                    <span className="cursor-pointer">
                                        <Upload className="w-4 h-4 mr-2" />
                                        {uploading ? 'Uploading...' : 'Replace Resume'}
                                    </span>
                                </Button>
                            </label>
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <input
                            type="file"
                            id="resume-upload"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                        <label htmlFor="resume-upload">
                            <Button
                                variant="brand"
                                className="w-full"
                                disabled={uploading}
                                asChild
                            >
                                <span className="cursor-pointer">
                                    <Upload className="w-4 h-4 mr-2" />
                                    {uploading ? 'Uploading...' : 'Upload Resume'}
                                </span>
                            </Button>
                        </label>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
