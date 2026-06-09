import React, { useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Image as ImageIcon, Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  postText: string;
  attachedFiles: File[];
  isPosting: boolean;
  onPostTextChange: (text: string) => void;
  onFileAttachment: (type: "document" | "photo" | "video") => void;
  onPost: () => void;
  onRemoveFile: (index: number) => void;
}

const quickActions = [
  {
    icon: "💼",
    label: "Share an opportunity",
    prefill: "I wanted to share an exciting opportunity with the TKS community: ",
    style: { background: "#e6f5f0", color: "#008060", border: "1px solid rgba(0,128,96,0.2)" },
  },
  {
    icon: "🙋",
    label: "Ask the community",
    prefill: "Hey TKS alumni, I need your advice on: ",
    style: { background: "#eff6ff", color: "#2563eb", border: "1px solid rgba(37,99,235,0.2)" },
  },
  {
    icon: "🎉",
    label: "Announce a milestone",
    prefill: "Excited to share that I've recently: ",
    style: { background: "#fffbeb", color: "#d97706", border: "1px solid rgba(217,119,6,0.2)" },
  },
];

export function CreatePostModal({
  open,
  onClose,
  postText,
  attachedFiles,
  isPosting,
  onPostTextChange,
  onFileAttachment,
  onPost,
  onRemoveFile,
}: CreatePostModalProps) {
  const { user, alumni, adminUser } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayName =
    `${alumni?.first_name || ""} ${alumni?.last_name || ""}`.trim() ||
    user?.username ||
    adminUser?.username ||
    "User";

  const roleLabel =
    (user as any)?.user_role === "administrator" || (user as any)?.is_admin ? "Admin" :
    (user as any)?.user_role === "faculty" ? "Faculty" :
    "Alumni";

  const getProfilePicture = () => {
    if (alumni?.profile_picture && alumni.profile_picture.trim() !== "") {
      return alumni.profile_picture;
    }
    const seed = encodeURIComponent(displayName);
    switch (alumni?.gender) {
      case "male":    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
      case "female":  return `https://api.dicebear.com/7.x/avataaars-neutral/svg?seed=${seed}&backgroundColor=ff69b4`;
      case "other":   return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=ffa500`;
      default:        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=008060`;
    }
  };

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    onPostTextChange(el.value);
  };

  const isEmpty = !postText.trim() && attachedFiles.length === 0;
  const overLimit = postText.length > 5000;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 rounded-2xl overflow-hidden shadow-xl">
        {/* Screen-reader title */}
        <DialogTitle className="sr-only">Create a post</DialogTitle>

        {/* ── Header: avatar + name + role ── */}
        <div
          className="flex items-center gap-3 px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <Avatar className="w-11 h-11 shrink-0 ring-2" style={{ "--tw-ring-color": "var(--border-default)" } as React.CSSProperties}>
            <AvatarImage src={getProfilePicture()} alt={displayName} />
            <AvatarFallback className="bg-[#008060] text-white font-semibold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-[15px] text-gray-900 leading-tight truncate">
              {displayName}
            </span>
            <span
              className="self-start text-[11px] font-semibold px-2 py-0.5 rounded-full leading-tight"
              style={{ background: "#e6f5f0", color: "#008060" }}
            >
              {roleLabel}
            </span>
          </div>
        </div>

        {/* ── Quick-action chips (hidden once user starts typing) ── */}
        {!postText && (
          <div
            className="flex flex-wrap gap-2 px-5 py-3"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  onPostTextChange(action.prefill);
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                      textareaRef.current.selectionStart = action.prefill.length;
                      textareaRef.current.selectionEnd = action.prefill.length;
                    }
                  }, 0);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 active:scale-95 touch-manipulation hover:opacity-80"
                style={action.style}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Textarea ── */}
        <div className="px-5 pt-4 pb-1">
          <textarea
            ref={textareaRef}
            placeholder="What's on your mind today?"
            value={postText}
            onChange={autoGrow}
            rows={4}
            className={`w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-0 ${overLimit ? "text-red-600" : "text-gray-800"}`}
            style={{ minHeight: "120px" }}
            aria-label="Post content"
          />

          {/* Character counter */}
          {postText.length > 100 && (
            <div className="flex items-center justify-end gap-2 mb-1">
              {overLimit && (
                <span className="text-xs text-red-600">⚠ Exceeds 5000 characters</span>
              )}
              <span
                className={`text-[11px] ${
                  overLimit ? "text-red-600 font-semibold" :
                  postText.length > 4800 ? "text-orange-500" :
                  "text-gray-400"
                }`}
              >
                {postText.length}/5000
              </span>
            </div>
          )}
        </div>

        {/* ── Attached file previews ── */}
        {attachedFiles.length > 0 && (
          <div className="px-5 pb-3 space-y-1.5">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)" }}
              >
                <span className="text-xs text-gray-600 truncate flex-1 min-w-0 font-medium">
                  {file.name}
                </span>
                <button
                  onClick={() => onRemoveFile(index)}
                  className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors touch-manipulation text-base flex items-center justify-center min-w-[28px] min-h-[28px]"
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Bottom bar: attachment icons + post button ── */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-subtle)" }}
        >
          {/* Attachment icon buttons */}
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onFileAttachment("document")}
                    className="rounded-full p-2 h-9 w-9 flex items-center justify-center text-violet-400 hover:text-violet-600 hover:bg-white hover:shadow-sm transition-all touch-manipulation"
                    aria-label="Attach document"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Document</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onFileAttachment("photo")}
                    className="rounded-full p-2 h-9 w-9 flex items-center justify-center text-blue-400 hover:text-blue-600 hover:bg-white hover:shadow-sm transition-all touch-manipulation"
                    aria-label="Attach photo"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Photo</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onFileAttachment("video")}
                    className="rounded-full p-2 h-9 w-9 flex items-center justify-center text-pink-400 hover:text-pink-600 hover:bg-white hover:shadow-sm transition-all touch-manipulation"
                    aria-label="Attach video"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Video</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          {/* Post button */}
          <Button
            onClick={onPost}
            disabled={isPosting || isEmpty || overLimit}
            className="bg-[#008060] hover:bg-[#006b51] active:bg-[#005d47] text-white rounded-full px-5 py-2 text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
            aria-label={isPosting ? "Posting your message" : "Post your message"}
            aria-busy={isPosting}
          >
            {isPosting ? "Posting…" : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
