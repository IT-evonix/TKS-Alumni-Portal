/**
 * Example: Using VirtualList for long lists
 * This shows how to use the VirtualList component
 */

import React from 'react';
import { VirtualList } from '@/components/common/VirtualList';

// Example: Virtual list for posts
export function VirtualPostList({ posts }: { posts: any[] }) {
  return (
    <VirtualList
      items={posts}
      itemHeight={200} // Approximate height of each post card
      containerHeight={600} // Height of visible container
      overscan={2} // Render 2 extra items outside viewport
      renderItem={(post, index) => (
        <div className="p-4 border-b">
          <h3>{post.title}</h3>
          <p>{post.content}</p>
        </div>
      )}
    />
  );
}

// Example: Virtual list for messages
export function VirtualMessageList({ messages }: { messages: any[] }) {
  return (
    <VirtualList
      items={messages}
      itemHeight={80} // Approximate height of each message
      containerHeight={500}
      overscan={3}
      renderItem={(message, index) => (
        <div className="p-3 border-b">
          <div className="font-semibold">{message.sender}</div>
          <div>{message.content}</div>
        </div>
      )}
    />
  );
}

// Example: Virtual list for connections
export function VirtualConnectionList({ connections }: { connections: any[] }) {
  return (
    <VirtualList
      items={connections}
      itemHeight={100}
      containerHeight={400}
      overscan={2}
      renderItem={(connection, index) => (
        <div className="p-4 border-b flex items-center gap-3">
          <img src={connection.avatar} alt={connection.name} className="w-12 h-12 rounded-full" />
          <div>
            <div className="font-semibold">{connection.name}</div>
            <div className="text-sm text-gray-600">{connection.title}</div>
          </div>
        </div>
      )}
    />
  );
}
