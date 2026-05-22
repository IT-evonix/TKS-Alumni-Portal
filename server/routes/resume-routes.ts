// Backend Resume Upload Route
// Add this to server/routes.ts or create a new file server/resume-routes.ts

import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../supabase';

const router = Router();

// Configure multer for file upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, and DOCX are allowed.'));
        }
    }
});

// Upload resume endpoint with guaranteed JSON error handling
router.post('/upload', (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
        if (err) {
            console.error('Multer file upload error:', err);
            return res.status(400).json({ error: err.message || 'File upload failed validation' });
        }
        next();
    });
}, async (req, res) => {
    try {
        const userId = req.headers['user-id'] as string;

        if (!userId) {
            return res.status(401).json({ error: 'User ID required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Generate unique filename
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${userId}/resume_${Date.now()}.${fileExt}`;

        // Upload to Supabase storage using admin client
        const { error: uploadError } = await supabase.storage
            .from('resumes')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: true,
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload resume to storage' });
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('resumes')
            .getPublicUrl(fileName);

        // Update alumni table with resume URL
        const { error: updateError } = await supabase
            .from('alumni')
            .update({ resume_url: publicUrl })
            .eq('user_id', userId);

        if (updateError) {
            console.error('Update error:', updateError);
            return res.status(500).json({ error: 'Failed to update user profile with resume URL' });
        }

        res.json({
            success: true,
            resumeUrl: publicUrl,
            message: 'Resume uploaded successfully'
        });

    } catch (error) {
        console.error('Resume upload endpoint error:', error);
        res.status(500).json({ error: 'Internal server error while uploading resume' });
    }
});

// Delete resume endpoint
router.delete('/delete', async (req, res) => {
    try {
        const userId = req.headers['user-id'] as string;

        if (!userId) {
            return res.status(401).json({ error: 'User ID required' });
        }

        // Get current resume URL
        const { data: alumniData } = await supabase
            .from('alumni')
            .select('resume_url')
            .eq('user_id', userId)
            .single();

        if (alumniData?.resume_url) {
            // Extract file path from URL
            const path = alumniData.resume_url.split('/').slice(-2).join('/');

            // Delete from storage
            await supabase.storage
                .from('resumes')
                .remove([path]);
        }

        // Update alumni table
        const { error: updateError } = await supabase
            .from('alumni')
            .update({ resume_url: null })
            .eq('user_id', userId);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update profile' });
        }

        res.json({ success: true, message: 'Resume deleted successfully' });

    } catch (error) {
        console.error('Resume delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
