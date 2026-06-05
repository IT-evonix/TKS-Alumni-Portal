export interface MessageReaction {
    id: string;
    message_id: string;
    user_id: string;
    emoji: string;
    created_at: string;
    user?: {
        id: string;
        username: string;
        email: string;
    };
}

export interface MessageReply {
    id: string;
    message_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    sender?: {
        id: string;
        username: string;
        email: string;
    };
}

export interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    subject: string;
    content: string;
    is_read: boolean;
    created_at: string;
    is_edited?: boolean;
    sender?: {
        id: string;
        username: string;
        email: string;
        first_name?: string;
        last_name?: string;
    };
    receiver?: {
        id: string;
        username: string;
        email: string;
        first_name?: string;
        last_name?: string;
    };
    reactions?: MessageReaction[];
    replies?: MessageReply[];
}

export interface Conversation {
    userId: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    messages: Message[];
    isOnline?: boolean;
    profilePicture?: string;
    isBlocked?: boolean; // The OTHER user has blocked the current user
    hasBlocked?: boolean; // The current user has blocked the OTHER user
}

export interface AlumniUser {
    id: string;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    profile_picture?: string;
    batch?: string;
    current_city?: string;
    current_company?: string;
    current_role?: string;
    industry?: string;
}
