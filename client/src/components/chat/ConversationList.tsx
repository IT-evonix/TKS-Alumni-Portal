import React from 'react';
import { Conversation, AlumniUser } from './types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/dateUtils';

interface ConversationListProps {
    conversations: Conversation[];
    selectedConversationId: string | null;
    onSelect: (conversation: Conversation) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onNewMessage: () => void;
    currentUserId: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
    conversations,
    selectedConversationId,
    onSelect,
    searchQuery,
    onSearchChange,
    onNewMessage,
}) => {
    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-100 w-full md:w-[380px] lg:w-[420px]">
            {/* Header & Search */}
            <div className="p-5 flex flex-col gap-4 border-b border-gray-50/50">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Messages</h1>
                    <Button
                        onClick={onNewMessage}
                        size="icon"
                        className="rounded-full bg-[#008060] hover:bg-[#006e53] shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>

                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#008060] transition-colors w-4 h-4" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search conversations..."
                        className="pl-10 bg-gray-50/50 border-transparent hover:bg-gray-50 focus:bg-white focus:border-[#008060]/20 focus:ring-4 focus:ring-[#008060]/5 rounded-xl transition-all h-11"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                            <Search className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-medium">No conversations found</p>
                        <p className="text-sm text-gray-400 mt-1">Start a new chat to connect with alumni</p>
                    </div>
                ) : (
                    conversations.map((conv) => {
                        // Basic fallback avatar logic if no profile picture
                        const initials = (conv.firstName?.[0] || conv.username?.[0] || 'A').toUpperCase();
                        const isActive = selectedConversationId === conv.userId;

                        return (
                            <div
                                key={conv.userId}
                                onClick={() => onSelect(conv)}
                                className={cn(
                                    "group flex items-center gap-4 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border border-transparent",
                                    isActive
                                        ? "bg-[#008060]/5 border-[#008060]/10 shadow-sm"
                                        : "hover:bg-gray-50"
                                )}
                            >
                                <div className="relative flex-shrink-0">
                                    <Avatar className="w-12 h-12 border-2 border-white shadow-sm group-hover:scale-105 transition-transform">
                                        {/* Add src for image if we had it in Conversation type, assuming profile_picture isn't currently populated in the map, otherwise use Dicebear */}
                                        <AvatarImage src={conv.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${conv.username}`} />
                                        <AvatarFallback className="bg-gradient-to-br from-[#008060] to-[#004d3a] text-white font-medium">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    {/* Online Indicator Mockup - Ideally passed via prop */}
                                    {conv.isOnline && (
                                        <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between">
                                        <h3 className={cn(
                                            "font-semibold truncate text-[15px] capitalize",
                                            isActive ? "text-[#008060]" : "text-gray-900"
                                        )}>
                                            {conv.firstName && conv.lastName
                                                ? `${conv.firstName} ${conv.lastName}`
                                                : conv.username}
                                        </h3>
                                        <span className={cn(
                                            "text-[11px] font-medium flex-shrink-0",
                                            isActive ? "text-[#008060]/70" : "text-gray-400"
                                        )}>
                                            {formatTimeAgo(conv.lastMessageTime)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                        <p className={cn(
                                            "truncate text-sm pr-2 flex items-center gap-1",
                                            conv.unreadCount > 0 ? "text-gray-900 font-semibold" : "text-gray-500",
                                            isActive && "text-gray-700"
                                        )}>
                                            {(() => {
                                                // parseMessageContent is not imported, let's just do a regex check locally or import it
                                                // importing is cleaner but for this small snippet we can parse
                                                // Format: [📎 filename.ext](url) or just text
                                                const attachmentMatch = conv.lastMessage.match(/\[📎 (.*?)\]\((.*?)\)/);

                                                if (attachmentMatch) {
                                                    const fileName = attachmentMatch[1];
                                                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
                                                    const isVideo = /\.(mp4|webm|ogg)$/i.test(fileName);
                                                    const isDoc = /\.(pdf|doc|docx|txt|xls|xlsx|ppt|pptx)$/i.test(fileName);

                                                    const icon = isImage ? '📷' : isVideo ? '🎥' : '📎';

                                                    // Check if there is text before the attachment
                                                    const textPart = conv.lastMessage.replace(/\[📎 .*?\]\(.*?\)/g, "").trim();

                                                    if (textPart) {
                                                        return <>{icon} {fileName} <span className="text-gray-400 mx-1">•</span> {textPart}</>;
                                                    }
                                                    return <>{icon} {fileName}</>;
                                                }

                                                return conv.lastMessage || "Attachment";
                                            })()}
                                        </p>
                                        {conv.unreadCount > 0 && (
                                            <Badge className="bg-[#008060] hover:bg-[#008060] text-white border-none h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full text-[10px] animate-scale-in">
                                                {conv.unreadCount}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
