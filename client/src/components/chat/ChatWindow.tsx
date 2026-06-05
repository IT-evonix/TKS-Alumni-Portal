import React, { useRef, useEffect } from 'react';
import { Conversation, Message } from './types';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreVertical, Phone, Video, X } from 'lucide-react';
import { getDateSeparatorIST } from '@/lib/dateUtils';
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLocation } from 'wouter';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface ChatWindowProps {
    conversation: Conversation | null;
    messageText: string;
    isSending: boolean;
    isUploading: boolean;
    onMessageChange: (val: string) => void;
    onSendMessage: () => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBack: () => void;
    currentUserId: string;
    onReply: (message: Message) => void;
    onReact: (messageId: string, emoji: string) => void;
    onDeleteMessage?: (messageId: string) => void;
    replyingTo?: Message | null;
    onCancelReply?: () => void;
    onEdit?: (message: Message) => void;
    editingMessage?: Message | null;
    onCancelEdit?: () => void;
    onBlock?: (userId: string) => void;
    onUnblock?: (userId: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
    conversation,
    messageText,
    isSending,
    isUploading,
    onMessageChange,
    onSendMessage,
    onFileUpload,
    onBack,
    currentUserId,
    onReply,
    onReact,
    onDeleteMessage,
    replyingTo,
    onCancelReply,
    onEdit,
    editingMessage,
    onCancelEdit,
    onBlock,
    onUnblock
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [, setLocation] = useLocation();

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
        setShowScrollButton(!isAtBottom);
    };

    // Track previous conversation ID to detect when a new chat is opened
    const prevConversationIdRef = useRef<string | null>(null);
    const hasScrolledToBottomRef = useRef<boolean>(false);

    useEffect(() => {
        // When a conversation is opened (userId changes), always scroll to latest message
        if (conversation?.userId && conversation.userId !== prevConversationIdRef.current) {
            prevConversationIdRef.current = conversation.userId;
            hasScrolledToBottomRef.current = false;
            
            // Wait for messages to render, then scroll to bottom
            const timeoutId = setTimeout(() => {
                if (conversation.messages && conversation.messages.length > 0) {
                    scrollToBottom('auto');
                    hasScrolledToBottomRef.current = true;
                }
            }, 150);
            
            return () => clearTimeout(timeoutId);
        } else if (!conversation?.userId) {
            // Reset when conversation is closed
            prevConversationIdRef.current = null;
            hasScrolledToBottomRef.current = false;
        }
    }, [conversation?.userId]);

    // Also scroll to bottom when messages first load for a conversation
    useEffect(() => {
        if (conversation?.messages && conversation.messages.length > 0 && !hasScrolledToBottomRef.current) {
            const timeoutId = setTimeout(() => {
                scrollToBottom('auto');
                hasScrolledToBottomRef.current = true;
            }, 150);
            return () => clearTimeout(timeoutId);
        }
    }, [conversation?.messages?.length]);

    useEffect(() => {
        // When messages are added/updated, only auto-scroll if user is already near bottom
        // This prevents interrupting user if they're reading older messages
        const container = scrollContainerRef.current;
        if (container && conversation?.messages && conversation.messages.length > 0) {
            const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 200;
            if (isNearBottom) {
                // Small delay to ensure new message is rendered
                const timeoutId = setTimeout(() => {
                    scrollToBottom('smooth');
                }, 50);
                return () => clearTimeout(timeoutId);
            }
        }
    }, [conversation?.messages]);

    if (!conversation) {
        return (
            <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50/50 flex-col text-center p-8">
                <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
                    <img
                        src="https://cdn-icons-png.flaticon.com/512/589/589708.png"
                        alt="Chat"
                        className="w-12 h-12 opacity-50 grayscale"
                    />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Your Messages</h2>
                <p className="text-gray-500 max-w-sm">
                    Select a conversation from the list to start chatting or connect with a new alumni.
                </p>
            </div>
        );
    }

    const initials = (conversation.firstName?.[0] || conversation.username?.[0] || 'A').toUpperCase();

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] relative overflow-hidden">
            {/* Header */}
            <div className="h-[72px] px-4 flex-shrink-0 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-gray-200 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    {/* Back/Close Button - Always visible */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 -ml-2"
                        title="Close chat"
                    >
                        <ArrowLeft className="w-5 h-5 lg:hidden" />
                        <X className="w-5 h-5 hidden lg:block" />
                    </Button>

                    <div
                        className="relative cursor-pointer group"
                        onClick={() => setLocation(`/profile/${conversation.userId}`)}
                    >
                        <Avatar className="w-10 h-10 border border-gray-100 group-hover:opacity-90 transition-opacity">
                            <AvatarImage src={conversation.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${conversation.username}`} />
                            <AvatarFallback className="bg-[#008060] text-white text-sm">{initials}</AvatarFallback>
                        </Avatar>
                        {conversation.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                        )}
                    </div>

                    <div
                        className="flex flex-col cursor-pointer"
                        onClick={() => setLocation(`/profile/${conversation.userId}`)}
                    >
                        <h2 className="font-semibold text-gray-900 text-[15px] leading-tight hover:underline decoration-gray-400 underline-offset-2 capitalize">
                            {conversation.firstName && conversation.lastName
                                ? `${conversation.firstName} ${conversation.lastName}`
                                : conversation.username}
                        </h2>
                        <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                            {conversation.isBlocked || conversation.hasBlocked
                                ? <span className="text-red-500 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    Blocked
                                </span>
                                : conversation.isOnline ? 'Active now' : 'Click to view profile'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* Action Buttons Mockup */}
                    {conversation.phone && !conversation.isBlocked && !conversation.hasBlocked && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-[#008060] hidden sm:flex"
                            onClick={() => window.open(`tel:${conversation.phone}`)}
                            title={`Call ${conversation.phone}`}
                        >
                            <Phone className="w-5 h-5" />
                        </Button>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-700">
                                <MoreVertical className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setLocation(`/profile/${conversation.userId}`)}>
                                View Profile
                            </DropdownMenuItem>
                            {conversation.hasBlocked ? (
                                <DropdownMenuItem className="text-green-600" onClick={() => onUnblock?.(conversation.userId)}>
                                    Unblock User
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem className="text-red-600" onClick={() => onBlock?.(conversation.userId)}>
                                    Block User
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Blocked Notice Banner */}
            {conversation.hasBlocked && (
                <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <p className="text-[12px] font-medium text-red-800">
                            You have blocked this user. You won't receive their messages.
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onUnblock?.(conversation.userId)}
                        className="h-7 text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-100 px-2"
                    >
                        Unblock
                    </Button>
                </div>
            )}
            {conversation.isBlocked && !conversation.hasBlocked && (
                <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    <p className="text-[12px] font-medium text-gray-600">
                        This user has blocked you. Messages are disabled.
                    </p>
                </div>
            )}

            {/* Messages Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-6 sm:px-6 scroll-smooth"
            >
                {conversation.messages.map((msg, index) => {
                    const previousMsg = conversation.messages[index - 1];
                    const showSeparator = !previousMsg || getDateSeparatorIST(msg.created_at) !== getDateSeparatorIST(previousMsg.created_at);

                    return (
                        <React.Fragment key={msg.id}>
                            {showSeparator && (
                                <div className="flex justify-center my-6">
                                    <span className="bg-gray-100 text-gray-500 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                        {getDateSeparatorIST(msg.created_at)}
                                    </span>
                                </div>
                            )}

                            <MessageBubble
                                message={msg}
                                isSent={msg.sender_id === currentUserId}
                                onReply={onReply}
                                onReact={onReact}
                                onDelete={onDeleteMessage}
                                onEdit={onEdit}
                                previousMessage={previousMsg}
                            />
                        </React.Fragment>
                    );
                })}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Scroll to Bottom Button */}
            {showScrollButton && (
                <button
                    onClick={() => scrollToBottom()}
                    className="absolute bottom-24 right-6 bg-white border border-gray-100 shadow-lg rounded-full p-2.5 text-[#008060] hover:bg-gray-50 transition-all animate-in fade-in zoom-in slide-in-from-bottom-4 z-30"
                    title="Scroll to bottom"
                >
                    <ChevronDown className="w-6 h-6" />
                    {conversation.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white">
                            {conversation.unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Input Area */}
            <MessageInput
                value={messageText}
                onChange={onMessageChange}
                onSend={onSendMessage}
                onFileUpload={onFileUpload}
                isSending={isSending}
                isUploading={isUploading}
                replyingTo={replyingTo}
                onCancelReply={onCancelReply}
                editingMessage={editingMessage}
                onCancelEdit={onCancelEdit}
                isBlocked={conversation.isBlocked}
                hasBlocked={conversation.hasBlocked}
                onUnblock={() => onUnblock?.(conversation.userId)}
            />
        </div>
    );
};
