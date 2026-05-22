/**
 * Upload Configuration and Limits
 * Centralized configuration for file uploads with smart size limits
 */

import multer from 'multer';

// Size limits in bytes
export const UPLOAD_LIMITS = {
    PROFILE_PICTURE: 5 * 1024 * 1024,    // 5MB
    EVENT_COVER: 5 * 1024 * 1024,        // 5MB
    RESUME: 5 * 1024 * 1024,             // 5MB
    POST_ATTACHMENT: 10 * 1024 * 1024,   // 10MB
    EXCEL_IMPORT: 10 * 1024 * 1024,      // 10MB
    MESSAGE_ATTACHMENT: 25 * 1024 * 1024 // 25MB
} as const;

// Allowed MIME types
export const ALLOWED_TYPES = {
    IMAGES: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif'
    ],
    DOCUMENTS: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
    ],
    VIDEOS: [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/webm'
    ],
    EXCEL: [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
    ]
} as const;

// Create multer upload configurations
export const uploadProfilePicture = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.PROFILE_PICTURE },
    fileFilter: (req, file, cb) => {
        if ((ALLOWED_TYPES.IMAGES as readonly string[]).includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images (JPEG, PNG, WebP, GIF) are allowed.'));
        }
    }
});

export const uploadEventCover = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.EVENT_COVER },
    fileFilter: (req, file, cb) => {
        if ((ALLOWED_TYPES.IMAGES as readonly string[]).includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed for event covers.'));
        }
    }
});

export const uploadPostAttachment = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.POST_ATTACHMENT },
    fileFilter: (req, file, cb) => {
        const allowedTypes: string[] = [
            ...ALLOWED_TYPES.IMAGES,
            ...ALLOWED_TYPES.VIDEOS,
            ...ALLOWED_TYPES.DOCUMENTS
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, videos, and documents are allowed.'));
        }
    }
});

export const uploadMessageAttachment = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.MESSAGE_ATTACHMENT },
    fileFilter: (req, file, cb) => {
        // Allow most common file types for messages
        const allowedTypes: string[] = [
            ...ALLOWED_TYPES.IMAGES,
            ...ALLOWED_TYPES.VIDEOS,
            ...ALLOWED_TYPES.DOCUMENTS,
            'application/zip',
            'application/x-zip-compressed',
            'application/x-rar-compressed'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. This file type is not supported.'));
        }
    }
});

export const uploadExcel = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.EXCEL_IMPORT },
    fileFilter: (req, file, cb) => {
        if ((ALLOWED_TYPES.EXCEL as readonly string[]).includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel files (XLS, XLSX, CSV) are allowed.'));
        }
    }
});

// Helper function to format file size for error messages
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Multer error handler middleware
export function handleMulterError(err: any, req: any, res: any, next: any) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                error: 'File too large',
                message: `File size exceeds the maximum allowed limit.`,
                maxSize: formatFileSize(err.field === 'file' ? UPLOAD_LIMITS.MESSAGE_ATTACHMENT : 5 * 1024 * 1024)
            });
        }
        return res.status(400).json({
            error: 'Upload error',
            message: err.message
        });
    }

    if (err) {
        return res.status(400).json({
            error: 'Invalid file',
            message: err.message
        });
    }

    next();
}
