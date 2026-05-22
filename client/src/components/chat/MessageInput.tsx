import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Smile, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Message } from './types';
import { X } from 'lucide-react';

interface MessageInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isSending: boolean;
    isUploading: boolean;
    replyingTo?: Message | null;
    onCancelReply?: () => void;
    editingMessage?: Message | null;
    onCancelEdit?: () => void;
    isBlocked?: boolean;
    hasBlocked?: boolean;
    onUnblock?: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
    value,
    onChange,
    onSend,
    onFileUpload,
    isSending,
    isUploading,
    replyingTo,
    onCancelReply,
    editingMessage,
    onCancelEdit,
    isBlocked,
    hasBlocked,
    onUnblock
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];

    const insertEmoji = (emoji: string) => {
        onChange(value + emoji);
        textareaRef.current?.focus();
    };

    return (
        <div className="flex flex-col w-full">
            {editingMessage && (
                <div className="px-4 py-2 bg-yellow-50/50 border-t border-yellow-100 flex items-center justify-between animate-in slide-in-from-bottom-2">
                    <div className="flex flex-col border-l-4 border-yellow-500 pl-3 py-1">
                        <span className="text-[11px] font-bold text-yellow-700 uppercase tracking-wider">
                            Editing Message
                        </span>
                        <span className="text-sm text-gray-600 line-clamp-1 italic">
                            {editingMessage.content}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-gray-400 hover:text-gray-600"
                        onClick={onCancelEdit}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}
            {replyingTo && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between animate-in slide-in-from-bottom-2">
                    <div className="flex flex-col border-l-4 border-[#008060] pl-3 py-1">
                        <span className="text-[11px] font-bold text-[#008060] uppercase tracking-wider">
                            Replying to {replyingTo.sender?.username || 'user'}
                        </span>
                        <span className="text-sm text-gray-600 line-clamp-1">
                            {replyingTo.content}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-gray-400 hover:text-gray-600"
                        onClick={onCancelReply}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}
            <div className="p-4 bg-white border-t border-gray-100 flex items-end gap-3 z-10 relative">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={onFileUpload}
                // accept="image/*,video/*,.pdf,.doc,.docx" // Optional restriction
                />

                <div className="flex-shrink-0 flex gap-2 pb-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={isUploading || isSending}
                        onClick={() => fileInputRef.current?.click()}
                        className="text-gray-400 hover:text-[#008060] hover:bg-[#008060]/5 rounded-full h-10 w-10 transition-colors"
                        title="Attach file"
                    >
                        <Paperclip className={cn("w-5 h-5", isUploading && "animate-pulse")} />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-full h-10 w-10 transition-colors hidden sm:flex"
                                title="Add emoji"
                            >
                                <Smile className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" className="p-2 gap-1 flex flex-wrap max-w-[200px]">
                            {commonEmojis.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => insertEmoji(emoji)}
                                    className="hover:bg-gray-100 p-2 rounded text-xl transition-transform hover:scale-125"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex-1 bg-gray-50 rounded-2xl border border-transparent focus-within:border-[#008060]/30 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#008060]/5 transition-all relative overflow-hidden">
                    {(isBlocked || hasBlocked) && (
                        <div className="absolute inset-0 bg-gray-100/90 backdrop-blur-md z-40 flex items-center justify-center px-6">
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[13px] font-semibold text-gray-700 text-center">
                                    {hasBlocked
                                        ? "Conversation Blocked"
                                        : "Messages Disabled"}
                                </span>
                                <span className="text-[11px] text-gray-500 text-center max-w-[200px]">
                                    {hasBlocked
                                        ? "You have blocked this user. You must unblock them to send a message."
                                        : "You cannot message this user because of privacy settings or blocks."}
                                </span>
                                {hasBlocked && onUnblock && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 h-7 px-3 text-[11px] font-bold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 bg-white shadow-sm"
                                        onClick={onUnblock}
                                    >
                                        Unblock User
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                    <Textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
                        disabled={isBlocked || hasBlocked}
                        className="min-h-[44px] max-h-[150px] py-3 px-4 bg-transparent border-none focus-visible:ring-0 resize-none text-[15px] placeholder:text-gray-400"
                        rows={1}
                    />
                </div>

                <Button
                    onClick={onSend}
                    disabled={!value.trim() || isSending || isBlocked || hasBlocked}
                    className={cn(
                        "rounded-full h-11 w-11 flex-shrink-0 shadow-md transition-all duration-300",
                        (!value.trim() && !isSending)
                            ? "bg-gray-100 text-gray-400 shadow-none hover:bg-gray-200"
                            : editingMessage
                                ? "bg-yellow-500 hover:bg-yellow-600 text-white hover:scale-105"
                                : "bg-[#008060] hover:bg-[#006e53] text-white hover:scale-105"
                    )}
                >
                    {editingMessage ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5 ml-0.5" />}
                </Button>
            </div>
        </div>
    );
};
