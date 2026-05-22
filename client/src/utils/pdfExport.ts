import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProfileData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    batch: string;
    currentCompany: string;
    currentRole: string;
    location: string;
    linkedinUrl: string;
    bio: string;
    gender: string;
    githubUrl: string;
    twitterUrl: string;
    personalWebsite: string;
    resumeUrl: string;
}

interface Experience {
    companyName: string;
    position: string;
    employmentType?: string;
    location?: string;
    locationType?: string;
    startDate: string;
    endDate?: string;
    isCurrent: boolean;
    description?: string;
}

interface Education {
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startDate: string;
    endDate?: string;
    isCurrent: boolean;
    grade?: string;
    description?: string;
}

interface Skill {
    skillName: string;
    category?: string;
    proficiencyLevel?: string;
    yearsOfExperience?: number;
    isPrimary?: boolean;
}

interface Project {
    title: string;
    description?: string;
    technologies?: string[];
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    projectUrl?: string;
    githubUrl?: string;
}

interface Certification {
    name: string;
    issuingOrganization: string;
    issueDate?: string;
    expiryDate?: string;
    credentialId?: string;
    credentialUrl?: string;
}

interface Achievement {
    title: string;
    description?: string;
    date?: string;
    category?: string;
}

interface Language {
    language: string;
    proficiency: string;
}

interface CompleteProfileData {
    profile: ProfileData;
    experiences: Experience[];
    education: Education[];
    skills: Skill[];
    projects: Project[];
    certifications: Certification[];
    achievements: Achievement[];
    languages: Language[];
}

export const generateProfilePDF = (data: CompleteProfileData): void => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Brand colors
    const primaryColor: [number, number, number] = [0, 128, 96]; // #008060
    const secondaryColor: [number, number, number] = [51, 51, 51]; // #333333
    const lightGray: [number, number, number] = [245, 245, 245]; // #F5F5F5

    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace: number) => {
        if (yPosition + requiredSpace > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
            return true;
        }
        return false;
    };

    // Helper function to format date
    const formatDate = (dateString?: string): string => {
        if (!dateString) return 'Present';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    // Helper function to safely ensure string
    const safeText = (text: any): string => {
        if (text === null || text === undefined) return '';
        return String(text);
    };

    // ===== HEADER SECTION =====
    // Background rectangle for header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 50, 'F');

    // Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(`${data.profile.firstName} ${data.profile.lastName}`), 20, 25);

    // Current Position & Company
    if (data.profile.currentRole || data.profile.currentCompany) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const subtitle = [data.profile.currentRole, data.profile.currentCompany]
            .filter(Boolean)
            .join(' at ');
        doc.text(safeText(subtitle), 20, 35);
    }

    // Contact info line
    doc.setFontSize(9);
    const contactInfo = [
        data.profile.email,
        data.profile.phone,
        data.profile.location
    ].filter(Boolean).join(' • ');
    doc.text(safeText(contactInfo), 20, 43);

    yPosition = 60;

    // ===== PERSONAL INFORMATION SECTION =====
    doc.setTextColor(...secondaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Personal Information', 20, yPosition);
    yPosition += 8;

    // Personal info table
    const personalData = [
        ['Batch/Graduation Year', safeText(data.profile.batch || 'N/A')],
        ['Gender', safeText(data.profile.gender || 'N/A')],
    ];

    autoTable(doc, {
        startY: yPosition,
        head: [],
        body: personalData,
        theme: 'plain',
        styles: {
            fontSize: 10,
            cellPadding: 3,
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 'auto' },
        },
        margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // ===== BIO SECTION =====
    if (data.profile.bio) {
        checkPageBreak(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Professional Summary', 20, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const bioLines = doc.splitTextToSize(safeText(data.profile.bio), pageWidth - 40);
        doc.text(bioLines, 20, yPosition);
        yPosition += bioLines.length * 5 + 10;
    }

    // ===== SOCIAL MEDIA & LINKS =====
    const links = [
        { label: 'LinkedIn', value: data.profile.linkedinUrl },
        { label: 'GitHub', value: data.profile.githubUrl },
        { label: 'Twitter/X', value: data.profile.twitterUrl },
        { label: 'Personal Website', value: data.profile.personalWebsite },
        { label: 'Resume', value: data.profile.resumeUrl },
    ].filter(link => link.value);

    if (links.length > 0) {
        checkPageBreak(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Online Presence', 20, yPosition);
        yPosition += 8;

        links.forEach(link => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(safeText(`${link.label}:`), 20, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 255);
            doc.textWithLink(safeText(link.value || ''), 50, yPosition, { url: safeText(link.value || '') });
            doc.setTextColor(...secondaryColor);
            yPosition += 6;
        });
        yPosition += 5;
    }

    // ===== PROFESSIONAL EXPERIENCE =====
    if (data.experiences && data.experiences.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Professional Experience', 20, yPosition);
        yPosition += 10;

        data.experiences.forEach((exp, index) => {
            checkPageBreak(35);

            // Company and Position
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...secondaryColor);
            doc.text(safeText(exp.position), 20, yPosition);
            yPosition += 6;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(safeText(exp.companyName), 20, yPosition);
            yPosition += 5;

            // Date and Location
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const dateRange = `${formatDate(exp.startDate)} - ${exp.isCurrent ? 'Present' : formatDate(exp.endDate)}`;
            const locationInfo = exp.location ? ` • ${exp.location}` : '';
            const typeInfo = exp.employmentType ? ` • ${exp.employmentType}` : '';
            doc.text(safeText(dateRange + locationInfo + typeInfo), 20, yPosition);
            yPosition += 7;

            // Description
            if (exp.description) {
                doc.setFontSize(9);
                doc.setTextColor(...secondaryColor);
                const descLines = doc.splitTextToSize(safeText(exp.description), pageWidth - 40);
                doc.text(descLines, 20, yPosition);
                yPosition += descLines.length * 4 + 5;
            }

            // Separator line
            if (index < data.experiences.length - 1) {
                doc.setDrawColor(200, 200, 200);
                doc.line(20, yPosition, pageWidth - 20, yPosition);
                yPosition += 8;
            } else {
                yPosition += 5;
            }
        });
    }

    // ===== EDUCATION =====
    if (data.education && data.education.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Education', 20, yPosition);
        yPosition += 10;

        data.education.forEach((edu, index) => {
            checkPageBreak(30);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...secondaryColor);
            doc.text(safeText(edu.degree), 20, yPosition);
            yPosition += 6;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(safeText(edu.institution), 20, yPosition);
            yPosition += 5;

            if (edu.fieldOfStudy) {
                doc.setFontSize(9);
                doc.text(safeText(`Field of Study: ${edu.fieldOfStudy}`), 20, yPosition);
                yPosition += 5;
            }

            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const eduDateRange = `${formatDate(edu.startDate)} - ${edu.isCurrent ? 'Present' : formatDate(edu.endDate)}`;
            const gradeInfo = edu.grade ? ` • Grade: ${edu.grade}` : '';
            doc.text(safeText(eduDateRange + gradeInfo), 20, yPosition);
            yPosition += 7;

            if (edu.description) {
                doc.setFontSize(9);
                doc.setTextColor(...secondaryColor);
                const eduDescLines = doc.splitTextToSize(safeText(edu.description), pageWidth - 40);
                doc.text(eduDescLines, 20, yPosition);
                yPosition += eduDescLines.length * 4 + 5;
            }

            if (index < data.education.length - 1) {
                doc.setDrawColor(200, 200, 200);
                doc.line(20, yPosition, pageWidth - 20, yPosition);
                yPosition += 8;
            } else {
                yPosition += 5;
            }
        });
    }

    // ===== SKILLS =====
    if (data.skills && data.skills.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Skills & Expertise', 20, yPosition);
        yPosition += 10;

        // Group skills by category
        const skillsByCategory: Record<string, Skill[]> = {};
        data.skills.forEach(skill => {
            const category = skill.category || 'Other';
            if (!skillsByCategory[category]) {
                skillsByCategory[category] = [];
            }
            skillsByCategory[category].push(skill);
        });

        // Primary skills first
        const primarySkills = data.skills.filter(s => s.isPrimary);
        if (primarySkills.length > 0) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...secondaryColor);
            doc.text('Primary Skills:', 20, yPosition);
            yPosition += 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            primarySkills.forEach(skill => {
                const skillText = `${skill.skillName} (${skill.proficiencyLevel || 'N/A'}${skill.yearsOfExperience ? `, ${skill.yearsOfExperience}y` : ''})`;
                doc.text(safeText(`• ${skillText}`), 25, yPosition);
                yPosition += 5;
            });
            yPosition += 3;
        }

        // Skills by category
        Object.entries(skillsByCategory).forEach(([category, skills]) => {
            const nonPrimarySkills = skills.filter(s => !s.isPrimary);
            if (nonPrimarySkills.length === 0) return;

            checkPageBreak(20);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...secondaryColor);
            doc.text(safeText(`${category}:`), 20, yPosition);
            yPosition += 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            nonPrimarySkills.forEach(skill => {
                const skillText = `${skill.skillName} (${skill.proficiencyLevel || 'N/A'}${skill.yearsOfExperience ? `, ${skill.yearsOfExperience}y` : ''})`;
                doc.text(safeText(`• ${skillText}`), 25, yPosition);
                yPosition += 5;
            });
            yPosition += 3;
        });
        yPosition += 2;
    }

    // ===== PROJECTS =====
    if (data.projects && data.projects.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Projects', 20, yPosition);
        yPosition += 10;

        data.projects.forEach((project, index) => {
            checkPageBreak(30);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...secondaryColor);
            doc.text(safeText(project.title), 20, yPosition);
            yPosition += 6;

            if (project.startDate) {
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                const projectDateRange = `${formatDate(project.startDate)} - ${project.isCurrent ? 'Present' : formatDate(project.endDate)}`;
                doc.text(safeText(projectDateRange), 20, yPosition);
                yPosition += 5;
            }

            if (project.description) {
                doc.setFontSize(9);
                doc.setTextColor(...secondaryColor);
                const projDescLines = doc.splitTextToSize(safeText(project.description), pageWidth - 40);
                doc.text(projDescLines, 20, yPosition);
                yPosition += projDescLines.length * 4 + 3;
            }

            if (project.technologies && project.technologies.length > 0) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text('Technologies: ', 20, yPosition);
                doc.setFont('helvetica', 'normal');
                doc.text(safeText(project.technologies.join(', ')), 50, yPosition);
                yPosition += 5;
            }

            if (project.projectUrl || project.githubUrl) {
                doc.setFontSize(8);
                doc.setTextColor(0, 0, 255);
                if (project.projectUrl) {
                    doc.textWithLink(safeText(`Project URL: ${project.projectUrl}`), 20, yPosition, { url: safeText(project.projectUrl) });
                    yPosition += 4;
                }
                if (project.githubUrl) {
                    doc.textWithLink(safeText(`GitHub: ${project.githubUrl}`), 20, yPosition, { url: safeText(project.githubUrl) });
                    yPosition += 4;
                }
                doc.setTextColor(...secondaryColor);
            }

            if (index < data.projects.length - 1) {
                yPosition += 3;
                doc.setDrawColor(200, 200, 200);
                doc.line(20, yPosition, pageWidth - 20, yPosition);
                yPosition += 8;
            } else {
                yPosition += 5;
            }
        });
    }

    // ===== CERTIFICATIONS =====
    if (data.certifications && data.certifications.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Certifications', 20, yPosition);
        yPosition += 10;

        data.certifications.forEach((cert, index) => {
            checkPageBreak(25);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...secondaryColor);
            doc.text(safeText(cert.name), 20, yPosition);
            yPosition += 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(safeText(cert.issuingOrganization), 20, yPosition);
            yPosition += 5;

            if (cert.issueDate) {
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                const certDate = `Issued: ${formatDate(cert.issueDate)}${cert.expiryDate ? ` • Expires: ${formatDate(cert.expiryDate)}` : ''}`;
                doc.text(safeText(certDate), 20, yPosition);
                yPosition += 5;
            }

            if (cert.credentialId) {
                doc.setFontSize(8);
                doc.text(safeText(`Credential ID: ${cert.credentialId}`), 20, yPosition);
                yPosition += 4;
            }

            if (cert.credentialUrl) {
                doc.setFontSize(8);
                doc.setTextColor(0, 0, 255);
                doc.textWithLink(safeText(`Verify: ${cert.credentialUrl}`), 20, yPosition, { url: safeText(cert.credentialUrl) });
                yPosition += 4;
                doc.setTextColor(...secondaryColor);
            }

            if (index < data.certifications.length - 1) {
                yPosition += 3;
            } else {
                yPosition += 5;
            }
        });
    }

    // ===== ACHIEVEMENTS =====
    if (data.achievements && data.achievements.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Achievements & Awards', 20, yPosition);
        yPosition += 10;

        data.achievements.forEach((achievement, index) => {
            checkPageBreak(20);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...secondaryColor);
            doc.text(safeText(achievement.title), 20, yPosition);
            yPosition += 6;

            if (achievement.date) {
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(safeText(formatDate(achievement.date)), 20, yPosition);
                yPosition += 5;
            }

            if (achievement.description) {
                doc.setFontSize(9);
                doc.setTextColor(...secondaryColor);
                const achDescLines = doc.splitTextToSize(safeText(achievement.description), pageWidth - 40);
                doc.text(achDescLines, 20, yPosition);
                yPosition += achDescLines.length * 4 + 5;
            }

            if (index < data.achievements.length - 1) {
                yPosition += 2;
            }
        });
        yPosition += 5;
    }

    // ===== LANGUAGES =====
    if (data.languages && data.languages.length > 0) {
        checkPageBreak(30);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Languages', 20, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...secondaryColor);
        data.languages.forEach(lang => {
            doc.text(safeText(`• ${lang.language} - ${lang.proficiency}`), 20, yPosition);
            yPosition += 6;
        });
    }

    // ===== FOOTER =====
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            safeText(`Generated on ${new Date().toLocaleDateString()} • Page ${i} of ${totalPages}`),
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
    }

    // Save the PDF
    const fileName = `${data.profile.firstName}_${data.profile.lastName}_Profile_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
};
