/**
 * Utility functions for parsing and rendering message content with attachments
 */

export interface MessageAttachment {
  fileName: string;
  url: string;
  type: 'image' | 'video' | 'document';
}

export interface ParsedMessage {
  text: string;
  attachments: MessageAttachment[];
}

/**
 * Parses message content to extract attachments and remaining text
 * Handles markdown-style links: [📎 filename](url)
 */
export function parseMessageContent(content: string): ParsedMessage {
  const attachments: MessageAttachment[] = [];
  let text = content;

  // Match markdown-style attachment links: [📎 filename](url)
  // Also handle variations like [📎 filename](url) or [📎 filename](url)
  const attachmentRegex = /\[📎\s*([^\]]+)\]\(([^)]+)\)/g;
  const matches = Array.from(content.matchAll(attachmentRegex));

  if (matches.length > 0) {
    // Remove attachment links from text
    text = content.replace(attachmentRegex, '').trim();

    // Extract attachment information
    matches.forEach(match => {
      const fileName = match[1].trim();
      const url = match[2].trim();

      // Determine file type based on extension or MIME type
      let type: 'image' | 'video' | 'document' = 'document';
      const lowerFileName = fileName.toLowerCase();
      const lowerUrl = url.toLowerCase();

      if (lowerFileName.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) || 
          lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)) {
        type = 'image';
      } else if (lowerFileName.match(/\.(mp4|webm|mov|avi|mkv)$/i) || 
                 lowerUrl.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
        type = 'video';
      }

      attachments.push({
        fileName,
        url,
        type
      });
    });
  }

  return {
    text: text || '',
    attachments
  };
}

/**
 * Gets file extension from filename or URL
 */
export function getFileExtension(fileNameOrUrl: string): string {
  const match = fileNameOrUrl.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Gets a human-readable file type name
 */
export function getFileTypeName(fileName: string): string {
  const ext = getFileExtension(fileName);
  const typeMap: Record<string, string> = {
    'pdf': 'PDF Document',
    'doc': 'Word Document',
    'docx': 'Word Document',
    'xls': 'Excel Spreadsheet',
    'xlsx': 'Excel Spreadsheet',
    'ppt': 'PowerPoint',
    'pptx': 'PowerPoint',
    'txt': 'Text File',
    'zip': 'ZIP Archive',
    'rar': 'RAR Archive',
    'jpg': 'Image',
    'jpeg': 'Image',
    'png': 'Image',
    'gif': 'Image',
    'webp': 'Image',
    'mp4': 'Video',
    'webm': 'Video',
    'mov': 'Video',
  };
  return typeMap[ext] || 'File';
}
