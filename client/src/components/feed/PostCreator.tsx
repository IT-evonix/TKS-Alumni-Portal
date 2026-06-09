
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Image as ImageIcon, Video } from "lucide-react";

interface PostCreatorProps {
  postText: string;
  attachedFiles: File[];
  isPosting: boolean;
  onPostTextChange: (text: string) => void;
  onFileAttachment: (type: 'document' | 'photo' | 'video') => void;
  onPost: () => void;
  onRemoveFile: (index: number) => void;
}

export const PostCreator: React.FC<PostCreatorProps> = ({
  postText,
  attachedFiles,
  isPosting,
  onPostTextChange,
  onFileAttachment,
  onPost,
  onRemoveFile,
}) => {
  const { user, alumni, adminUser } = useAuth();

  const displayName = `${alumni?.first_name || ''} ${alumni?.last_name || ''}`.trim() || user?.username || adminUser?.username || 'User';

  const getProfilePicture = () => {
    if (alumni?.profile_picture && alumni.profile_picture.trim() !== '') {
      return alumni.profile_picture;
    }

    const seed = encodeURIComponent(displayName);
    switch (alumni?.gender) {
      case 'male':
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      case 'female':
        return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      case 'other':
        return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
      case 'prefer_not_to_say':
        return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=6c63ff`;
      default:
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    }
  };

  const quickActions = [
    { icon: "💼", label: "Share an opportunity", prefill: "I wanted to share an exciting opportunity with the TKS community: " },
    { icon: "🙋", label: "Ask the community",    prefill: "Hey TKS alumni, I need your advice on: " },
    { icon: "🎉", label: "Announce a milestone", prefill: "Excited to share that I've recently: " },
  ];

  return (
    <Card className="bg-white overflow-hidden w-full max-w-full mb-4 sm:mb-5 transition-shadow duration-200 hover:shadow-md" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
      <CardContent className="p-4 sm:p-5">
        {/* Header hint */}
        <p className="text-[13px] font-medium text-gray-400 mb-3">Share something with the community</p>

        {/* Quick-action chips */}
        {!postText && (
          <div className="flex flex-wrap gap-2 mb-4">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onPostTextChange(action.prefill)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium text-gray-600 transition-all duration-150 hover:text-[#008060] hover:border-[#008060]/40 hover:bg-[#e6f5f0]/60 active:scale-95 touch-manipulation"
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}
                aria-label={action.label}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Top Section: Avatar and Input */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar className="w-9 h-9 sm:w-10 sm:h-10 ring-2 shrink-0" style={{ '--tw-ring-color': 'var(--border-default)' } as React.CSSProperties}>
            <AvatarImage src={getProfilePicture()} alt="Profile" />
            <AvatarFallback className="bg-[#008060] text-white font-semibold text-xs">
              {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <Textarea
              placeholder="What's on your mind today?"
              value={postText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onPostTextChange(e.target.value)}
              className={`min-h-[80px] sm:min-h-[96px] lg:min-h-[110px] border-0 bg-transparent text-[15px] placeholder:text-gray-400 focus-visible:ring-0 p-0 resize-none leading-relaxed w-full ${postText.length > 5000 ? 'text-red-600' : 'text-gray-800'}`}
              aria-label="Post content"
              aria-describedby="post-helper-text"
            />
            {postText.length > 100 && (
              <div className="flex items-center justify-end mt-1 gap-2">
                {postText.length > 5000 && (
                  <p className="text-xs text-red-600">⚠ Exceeds 5000 characters</p>
                )}
                <p className={`text-[11px] ${postText.length > 4800 ? postText.length > 5000 ? 'text-red-600 font-semibold' : 'text-orange-500' : 'text-gray-400'}`}>
                  {postText.length}/5000
                </p>
              </div>
            )}
            <div id="post-helper-text" className="sr-only">
              Enter your post content. Maximum 5000 characters.
            </div>

            {/* Attached Files Preview */}
            {attachedFiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <span className="text-xs text-gray-600 truncate flex-1 min-w-0 font-medium">{file.name}</span>
                    <button
                      onClick={() => onRemoveFile(index)}
                      className="text-gray-400 hover:text-red-500 ml-auto p-1 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full hover:bg-red-50 transition-colors touch-manipulation text-base"
                      aria-label="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {/* Attachment buttons grouped */}
          <div className="flex items-center gap-1 rounded-lg px-1 py-0.5" style={{ background: 'var(--surface-subtle)' }}>
            <button
              onClick={() => onFileAttachment('document')}
              className="flex items-center gap-1.5 text-gray-500 hover:text-[#008060] hover:bg-[#e6f5f0] transition-all rounded-md px-2.5 py-2 min-h-[36px] group touch-manipulation"
              aria-label="Attach document"
              type="button"
            >
              <FileText className="w-4 h-4 text-violet-400 group-hover:text-[#008060] transition-colors flex-shrink-0" />
              <span className="text-xs font-medium hidden sm:block">Document</span>
            </button>

            <button
              onClick={() => onFileAttachment('photo')}
              className="flex items-center gap-1.5 text-gray-500 hover:text-[#008060] hover:bg-[#e6f5f0] transition-all rounded-md px-2.5 py-2 min-h-[36px] group touch-manipulation"
              aria-label="Attach photo"
              type="button"
            >
              <ImageIcon className="w-4 h-4 text-blue-400 group-hover:text-[#008060] transition-colors flex-shrink-0" />
              <span className="text-xs font-medium hidden sm:block">Photo</span>
            </button>

            <button
              onClick={() => onFileAttachment('video')}
              className="flex items-center gap-1.5 text-gray-500 hover:text-[#008060] hover:bg-[#e6f5f0] transition-all rounded-md px-2.5 py-2 min-h-[36px] group touch-manipulation"
              aria-label="Attach video"
              type="button"
            >
              <Video className="w-4 h-4 text-pink-400 group-hover:text-[#008060] transition-colors flex-shrink-0" />
              <span className="text-xs font-medium hidden sm:block">Video</span>
            </button>
          </div>

          {/* Post Button */}
          <Button
            onClick={onPost}
            disabled={isPosting || (!postText.trim() && attachedFiles.length === 0) || postText.length > 5000}
            className="bg-[#008060] hover:bg-[#006b51] active:bg-[#005d47] text-white px-6 py-2 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] text-sm shadow-sm hover:shadow-md transition-all duration-200 shrink-0 w-full sm:w-auto touch-manipulation"
            aria-label={isPosting ? "Posting your message" : "Post your message"}
            aria-busy={isPosting}
          >
            {isPosting ? "Posting…" : "Post"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
