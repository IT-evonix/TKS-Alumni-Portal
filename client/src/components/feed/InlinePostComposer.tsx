import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Image as ImageIcon, Video } from "lucide-react";

interface InlinePostComposerProps {
  postText: string;
  attachedFiles: File[];
  isPosting: boolean;
  onPostTextChange: (text: string) => void;
  onFileAttachment: (type: "document" | "photo" | "video") => void;
  onPost: () => void;
  onRemoveFile: (index: number) => void;
}

const PLACEHOLDER_PROMPTS = [
  "What's on your mind today?",
  "Share an update with fellow alumni…",
  "Got a milestone to celebrate?",
  "Ask the community something…",
  "Post a photo from a recent meetup…",
];

/**
 * Always-visible composer card at the top of the feed, replacing the
 * previous button + hidden CreatePostModal pattern.
 */
export function InlinePostComposer({
  postText,
  attachedFiles,
  isPosting,
  onPostTextChange,
  onFileAttachment,
  onPost,
  onRemoveFile,
}: InlinePostComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [promptVisible, setPromptVisible] = useState(true);

  const showAnimatedPlaceholder = !postText && !isFocused;

  // Rotate through prompts with a fade-out/fade-in, pausing while the
  // composer is empty and unfocused (native <textarea placeholder> can't be
  // animated directly, so this renders a fake placeholder overlay instead).
  useEffect(() => {
    if (!showAnimatedPlaceholder) return;
    const interval = setInterval(() => {
      setPromptVisible(false);
      setTimeout(() => {
        setPromptIndex((prev) => (prev + 1) % PLACEHOLDER_PROMPTS.length);
        setPromptVisible(true);
      }, 250);
    }, 2800);
    return () => clearInterval(interval);
  }, [showAnimatedPlaceholder]);

  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    onPostTextChange(el.value);
  };

  const isEmpty = !postText.trim() && attachedFiles.length === 0;
  const overLimit = postText.length > 5000;

  return (
    <div
      className="bg-white overflow-hidden w-full"
      style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Textarea */}
      <div className="px-5 pt-5 pb-1 relative">
        {showAnimatedPlaceholder && (
          <span
            aria-hidden="true"
            className="absolute top-5 left-5 text-[15px] leading-relaxed text-gray-400 pointer-events-none transition-opacity duration-300"
            style={{ opacity: promptVisible ? 1 : 0 }}
          >
            {PLACEHOLDER_PROMPTS[promptIndex]}
          </span>
        )}
        <textarea
          ref={textareaRef}
          placeholder=""
          value={postText}
          onChange={autoGrow}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={3}
          className={`w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-0 ${overLimit ? "text-red-600" : "text-gray-800"}`}
          style={{ minHeight: "72px" }}
          aria-label="Post content"
        />

        {postText.length > 100 && (
          <div className="flex items-center justify-end gap-2 mb-1">
            {overLimit && <span className="text-xs text-red-600">⚠ Exceeds 5000 characters</span>}
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

      {/* Attached file previews */}
      {attachedFiles.length > 0 && (
        <div className="px-5 pb-3 space-y-1.5">
          {attachedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "var(--surface-subtle)", border: "1px solid var(--border-subtle)" }}
            >
              <span className="text-xs text-gray-600 truncate flex-1 min-w-0 font-medium">{file.name}</span>
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

      {/* Bottom bar: attachment icons + post button */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-subtle)" }}
      >
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
    </div>
  );
}
