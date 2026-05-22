import React, { useState } from 'react';
import { Message } from './types';
import { MessageAttachment } from './MessageAttachment';
import { parseMessageContent } from '@/lib/messageUtils';
import { Check, CheckCheck, Smile, MoreVertical, Reply, Trash2, Copy, Pencil } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from "@/lib/utils";

// Re-implementing helper locally to avoid circular deps or complex imports if utility is not shared
const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

interface MessageBubbleProps {
    message: Message;
    isSent: boolean;
    onReply: (message: Message) => void;
    onReact: (messageId: string, emoji: string) => void;
    onDelete?: (messageId: string) => void;
    onEdit?: (message: Message) => void;
    previousMessage?: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isSent,
    onReply,
    onReact,
    onDelete,
    onEdit,
    previousMessage
}) => {
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const parsedContent = parseMessageContent(message.content);

    // Group logic: If previous message was from same sender and within 5 mins, compact view
    const isGrouped = previousMessage &&
        previousMessage.sender_id === message.sender_id &&
        (new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime() < 5 * 60 * 1000);

    const canEdit = isSent && (new Date().getTime() - new Date(message.created_at).getTime() < 2 * 60 * 1000);
    const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

    return (
        <div
            className={cn(
                "flex w-full mb-1 group relative",
                isSent ? "justify-end" : "justify-start",
                isGrouped ? "mt-0.5" : "mt-4"
            )}
        >
            {/* Message Container */}
            <div className={cn(
                "relative max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] flex flex-col",
                isSent ? "items-end" : "items-start"
            )}>

                {/* Reply Context */}
                {/* Note: This assumes we can parse 'Replying to...' text or have a proper reply object. 
            For now, we'll skip visual reply context unless it's strictly structured data, 
            as the current implementation embeds it in text. */}

                {/* Bubble */}
                <div
                    className={cn(
                        "relative px-4 py-2 shadow-sm transition-all duration-200",
                        // Rounded corners logic
                        isSent
                            ? "bg-[#008060] text-white rounded-2xl rounded-tr-sm"
                            : "bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm",
                        // Grouping adjustments
                        isGrouped && isSent && "rounded-tr-2xl",
                        isGrouped && !isSent && "rounded-tl-2xl"
                    )}
                >
                    {/* Text Content */}
                    {parsedContent.text && (
                        <p className={cn(
                            "whitespace-pre-wrap break-words text-[15px] leading-relaxed",
                            // Check if it consists purely of emojis (simple heuristic)
                            /^\p{Extended_Pictographic}+$/u.test(parsedContent.text) && parsedContent.text.length < 10 ? "text-4xl py-2" : ""
                        )}>
                            {parsedContent.text}
                        </p>
                    )}

                    {/* Attachments */}
                    {parsedContent.attachments.length > 0 && (
                        <div className={cn("flex flex-col gap-2", parsedContent.text ? "mt-3" : "")}>
                            {parsedContent.attachments.map((att, i) => (
                                <MessageAttachment key={i} attachment={att} />
                            ))}
                        </div>
                    )}

                    {/* Metadata (Time & Status) */}
                    <div className={cn(
                        "flex items-center gap-1.5 mt-1 select-none",
                        isSent ? "justify-end text-white/70" : "justify-end text-gray-400"
                    )}>
                        {message.is_edited && (
                            <span className="text-[9px] sm:text-[10px] italic font-normal opacity-80">
                                Edited
                            </span>
                        )}
                        <span className="text-[10px] sm:text-[11px] font-medium">
                            {formatTime(message.created_at)}
                        </span>
                        {isSent && (
                            <span className="ml-0.5">
                                {message.is_read ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                                ) : (
                                    <Check className="w-3.5 h-3.5 text-white/70" />
                                )}
                            </span>
                        )}
                    </div>
                </div>

                {/* Reactions Display */}
                {message.reactions && message.reactions.length > 0 && (
                    <div className={cn(
                        "flex flex-wrap gap-1 mt-1 z-10",
                        isSent ? "mr-1 justify-end" : "ml-1 justify-start"
                    )}>
                        {/* Group reactions by emoji for cleaner display */}
                        {Array.from(new Set(message.reactions.map(r => r.emoji))).map((emoji) => (
                            <button
                                key={emoji}
                                onClick={() => onReact(message.id, emoji)}
                                className="bg-white hover:bg-gray-50 border border-gray-100 shadow-sm rounded-full px-2 py-0.5 text-xs animate-scale-in transition-transform active:scale-95 flex items-center gap-1"
                            >
                                <span>{emoji}</span>
                                <span className="text-[10px] text-gray-500 font-medium">
                                    {message.reactions?.filter(r => r.emoji === emoji).length}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Actions Menu (Hover) */}
                <div className={cn(
                    "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-full p-1",
                    isSent ? "-left-16 -translate-x-full" : "-right-12 translate-x-full"
                )}>
                    {canEdit && onEdit && (
                        <button
                            onClick={() => onEdit(message)}
                            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                            title="Edit"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => onReply(message)}
                        className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                        title="Reply"
                    >
                        <Reply className="w-4 h-4" />
                    </button>

                    <DropdownMenu open={showReactionPicker} onOpenChange={setShowReactionPicker}>
                        <DropdownMenuTrigger asChild>
                            <button className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors" title="React">
                                <Smile className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" className="flex gap-1 p-2 min-w-0">
                            {commonEmojis.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => onReact(message.id, emoji)}
                                    className="hover:bg-gray-100 p-1.5 rounded text-lg transition-transform hover:scale-125"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {isSent && onDelete && (
                        <button
                            onClick={() => onDelete(message.id)}
                            className="p-1.5 hover:bg-red-50 rounded-full text-red-500 transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Replies Display */}
                {message.replies && message.replies.length > 0 && (
                    <div className={cn(
                        "mt-2 space-y-2 w-full max-w-[95%]",
                        isSent ? "items-end ml-auto" : "items-start mr-auto"
                    )}>
                        {message.replies.map((reply) => (
                            <div key={reply.id} className={cn(
                                "flex flex-col p-2.5 rounded-2xl bg-white/50 border border-gray-100 shadow-sm backdrop-blur-sm",
                                isSent ? "rounded-tr-none" : "rounded-tl-none"
                            )}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-[#008060] uppercase tracking-wider">
                                        {reply.sender?.username || 'user'}
                                    </span>
                                    <span className="text-[9px] text-gray-400 font-medium">
                                        {formatTime(reply.created_at)}
                                    </span>
                                </div>
                                <p className="text-[13px] text-gray-700 leading-relaxed">
                                    {reply.content}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
};
