
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

  return (
    <Card className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 mb-4 sm:mb-6 md:mb-8 overflow-hidden w-full max-w-full">
      {/* Top border - always visible with light green accent */}
      <div className="h-1 w-full bg-[#95D1BD]" />
      
      <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6">
        {/* Top Section: Avatar and Input */}
        <div className="flex items-start gap-2.5 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-5">
          <Avatar className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 ring-2 ring-[#95D1BD]/30 transition-all shrink-0">
            <AvatarImage src={getProfilePicture()} alt="Profile" />
            <AvatarFallback className="bg-[#008060] text-white font-semibold text-xs sm:text-sm md:text-base">
              {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <Textarea
              placeholder="What's on your mind today?"
              value={postText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onPostTextChange(e.target.value)}
              className={`min-h-[50px] xs:min-h-[60px] sm:min-h-[70px] md:min-h-[80px] lg:min-h-[90px] border-0 bg-transparent text-sm xs:text-base sm:text-base md:text-lg placeholder:text-gray-400 focus-visible:ring-0 p-0 resize-none leading-relaxed w-full ${postText.length > 5000 ? 'text-red-600' : ''}`}
              aria-label="Post content"
              aria-describedby="post-helper-text"
            />
            {postText.length > 0 && (
              <div className="flex items-center justify-between mt-1">
                {postText.length > 5000
                  ? <p className="text-xs text-red-600 flex items-center gap-1">⚠ Content exceeds 5000 characters</p>
                  : <span />}
                <p className={`text-xs ml-auto ${postText.length > 4800 ? postText.length > 5000 ? 'text-red-600 font-medium' : 'text-orange-500' : 'text-gray-400'}`}>
                  {postText.length}/5000
                </p>
              </div>
            )}
            <div id="post-helper-text" className="sr-only">
              Enter your post content. Maximum 5000 characters.
            </div>

            {/* Attached Files Preview */}
            {attachedFiles.length > 0 && (
              <div className="mt-2.5 sm:mt-3 md:mt-4 space-y-2">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 md:p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-xs sm:text-sm text-gray-600 truncate flex-1 min-w-0 font-medium">{file.name}</span>
                    <button
                      onClick={() => onRemoveFile(index)}
                      className="text-red-500 hover:text-red-700 text-base sm:text-lg ml-auto p-1.5 sm:p-2 min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center rounded-full hover:bg-red-50 transition-colors touch-manipulation"
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

        {/* Bottom Section: Post Options and Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 md:gap-4 pt-2.5 sm:pt-3 md:pt-4 border-t border-gray-100">
          {/* Post Options */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 xl:gap-6 flex-1 w-full sm:w-auto">
            <button
              onClick={() => onFileAttachment('document')}
              className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-[#585858] hover:text-[#9D84BD] hover:bg-[#9D84BD]/5 active:bg-[#9D84BD]/10 transition-all rounded-lg p-2 sm:p-2.5 md:px-3 md:py-2 min-h-[44px] sm:min-h-[40px] md:min-h-[44px] group touch-manipulation"
              aria-label="Attach document"
              type="button"
            >
              <FileText className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#9D84BD] group-hover:scale-110 transition-transform flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Document</span>
            </button>
            
            <button
              onClick={() => onFileAttachment('photo')}
              className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-[#585858] hover:text-[#6F667F] hover:bg-[#6F667F]/5 active:bg-[#6F667F]/10 transition-all rounded-lg p-2 sm:p-2.5 md:px-3 md:py-2 min-h-[44px] sm:min-h-[40px] md:min-h-[44px] group touch-manipulation"
              aria-label="Attach photo"
              type="button"
            >
              <ImageIcon className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#6F667F] group-hover:scale-110 transition-transform flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Photo</span>
            </button>
            
            <button
              onClick={() => onFileAttachment('video')}
              className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-[#585858] hover:text-[#6F667F] hover:bg-[#6F667F]/5 active:bg-[#6F667F]/10 transition-all rounded-lg p-2 sm:p-2.5 md:px-3 md:py-2 min-h-[44px] sm:min-h-[40px] md:min-h-[44px] group touch-manipulation"
              aria-label="Attach video"
              type="button"
            >
              <Video className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 text-[#6F667F] group-hover:scale-110 transition-transform flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Video</span>
            </button>
          </div>

          {/* Post Button */}
          <Button
            onClick={onPost}
            disabled={isPosting || (!postText.trim() && attachedFiles.length === 0) || postText.length > 5000}
            className="bg-[#3F8A7D] hover:bg-[#2E6B5F] active:bg-[#1F4D44] text-white px-5 sm:px-6 md:px-8 lg:px-10 py-2.5 sm:py-2.5 md:py-3 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-[44px] md:min-h-[48px] text-sm sm:text-sm md:text-base shadow-sm hover:shadow-md active:shadow-sm transition-all duration-200 shrink-0 w-full sm:w-auto touch-manipulation"
            aria-label={isPosting ? "Posting your message" : "Post your message"}
            aria-busy={isPosting}
          >
            {isPosting ? "Posting..." : "Post"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
