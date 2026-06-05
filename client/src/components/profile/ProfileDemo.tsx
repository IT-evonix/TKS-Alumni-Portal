import React from 'react';
import { ExperienceManager } from './ExperienceManager';
import { SkillsManager } from './SkillsManager';

/**
 * ProfileDemo Component
 * 
 * This is a complete example showing how to integrate the multi-entry profile components.
 * Copy the relevant parts into your UserProfilePage.tsx
 */

interface ProfileDemoProps {
    userId: string;
}

export const ProfileDemo: React.FC<ProfileDemoProps> = ({ userId }) => {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
                    <p className="text-gray-600 mt-2">Manage your professional information</p>
                </div>

                {/* Profile Sections */}
                <div className="space-y-6">

                    {/* Professional Experience Section */}
                    <ExperienceManager userId={userId} />

                    {/* Skills & Expertise Section */}
                    <SkillsManager userId={userId} />

                    {/* 
            You can add more sections here:
            - CertificationsManager
            - LanguagesManager
            - AchievementsManager
            - ProjectsManager
          */}

                </div>
            </div>
        </div>
    );
};

/**
 * INTEGRATION EXAMPLE FOR UserProfilePage.tsx
 * 
 * Here's how to add these components to your existing UserProfilePage:
 * 
 * 1. Import the components at the top of your file:
 * 
 *    import { ExperienceManager } from '@/components/profile/ExperienceManager';
 *    import { SkillsManager } from '@/components/profile/SkillsManager';
 * 
 * 2. Add them to your JSX where you want them to appear:
 * 
 *    <div className="space-y-6">
 *      {/* Your existing profile sections *\/}
 *      
 *      {/* NEW: Add these components *\/}
 *      <ExperienceManager userId={user.id} />
 *      <SkillsManager userId={user.id} />
 *    </div>
 * 
 * 3. Make sure you have the user ID available in your component
 * 
 * That's it! The components are self-contained and handle their own:
 * - Data fetching
 * - State management
 * - CRUD operations
 * - UI/UX
 * - Error handling
 */

export default ProfileDemo;
