import React, { useState } from 'react';
import { File, Download, Image as ImageIcon, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFileTypeName } from '@/lib/messageUtils';

interface MessageAttachmentProps {
    attachment: {
        fileName: string;
        url: string;
        type: 'image' | 'video' | 'document';
    };
}

export const MessageAttachment: React.FC<MessageAttachmentProps> = ({ attachment }) => {
    const [imageError, setImageError] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isDownloading) return;
        setIsDownloading(true);

        try {
            const response = await fetch(attachment.url);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = attachment.fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            // Fallback
            window.open(attachment.url, '_blank');
        } finally {
            setIsDownloading(false);
        }
    };

    if (attachment.type === 'image') {
        if (imageError) {
            return (
                <div
                    onClick={handleDownload}
                    className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-lg hover:bg-gray-100/50 transition-colors cursor-pointer border border-gray-100"
                >
                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                            {attachment.fileName}
                        </p>
                        <p className="text-xs text-gray-400">Image</p>
                    </div>
                    <Button variant="ghost" size="icon" disabled={isDownloading} className="h-8 w-8 text-gray-500 hover:text-[#008060]">
                        <Download className={`w-4 h-4 ${isDownloading ? 'opacity-50' : ''}`} />
                    </Button>
                </div>
            );
        }

        return (
            <div className="flex flex-col group relative rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="block hover:opacity-95 transition-opacity bg-black/5"
                >
                    <img
                        src={attachment.url}
                        alt={attachment.fileName}
                        className="w-full max-w-sm max-h-64 object-contain"
                        onError={() => setImageError(true)}
                    />
                </a>
                <div className="px-3 py-2 bg-white flex items-center justify-between border-t border-gray-100">
                    <p className="text-xs text-gray-600 truncate flex items-center gap-1.5 flex-1 mr-2">
                        <ImageIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{attachment.fileName}</span>
                    </p>
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="text-gray-400 hover:text-[#008060] transition-colors p-1.5 rounded-full hover:bg-gray-50"
                        title="Download image"
                    >
                        <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-pulse' : ''}`} />
                    </button>
                </div>
            </div>
        );
    }

    if (attachment.type === 'video') {
        return (
            <div className="flex flex-col rounded-lg overflow-hidden border border-gray-100 shadow-sm bg-black/5">
                <video
                    src={attachment.url}
                    controls
                    className="w-full max-w-sm max-h-64"
                    onClick={(e) => e.stopPropagation()}
                />
                <div className="px-3 py-2 bg-white flex items-center justify-between border-t border-gray-100">
                    <p className="text-xs text-gray-600 truncate flex items-center gap-1.5 flex-1 mr-2">
                        <Video className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{attachment.fileName}</span>
                    </p>
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="text-gray-400 hover:text-[#008060] transition-colors p-1.5 rounded-full hover:bg-gray-50"
                        title="Download video"
                    >
                        <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-pulse' : ''}`} />
                    </button>
                </div>
            </div>
        );
    }

    // Document type
    return (
        <div
            onClick={handleDownload}
            className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-[#008060]/30 transition-all cursor-pointer group"
        >
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 group-hover:bg-[#008060]/5 transition-colors">
                <File className="w-5 h-5 text-gray-500 group-hover:text-[#008060] transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate group-hover:text-[#008060] transition-colors">
                    {attachment.fileName}
                </p>
                <p className="text-xs text-gray-400">
                    {getFileTypeName(attachment.fileName)}
                </p>
            </div>
            <Button variant="ghost" size="icon" disabled={isDownloading} className="h-8 w-8 text-gray-400 group-hover:text-[#008060] group-hover:bg-[#008060]/10">
                <Download className={`w-4 h-4 ${isDownloading ? 'opacity-50' : ''}`} />
            </Button>
        </div>
    );
};
