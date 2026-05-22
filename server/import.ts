
import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Use service role key for admin operations to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

interface StudentData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  graduationYear: number;
  batch: string;
  course?: string;
  branch?: string;
  rollNumber?: string;
  cgpa?: string;
  currentCity?: string;
  currentCompany?: string;
  currentRole?: string;
  linkedinUrl?: string;
  university?: string;
  higherEducationCountry?: string;
}

export async function previewExcelData(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read workbook
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (err: any) {
      console.error('Excel read error:', err);
      return res.status(400).json({ 
        error: 'Failed to read Excel file. It might be password protected or corrupted.',
        passwordRequired: true
      });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({ error: 'No data found in Excel file' });
    }

    const parsedData = jsonData.map((row, i) => {
      const getColumnValue = (row: any, possibleNames: string[]) => {
        for (const name of possibleNames) {
          if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
            return String(row[name]).trim();
          }
          const key = Object.keys(row).find(k => {
            const lowerKey = k.toLowerCase().replace(/[_\s-]/g, '');
            const lowerName = name.toLowerCase().replace(/[_\s-]/g, '');
            return lowerKey === lowerName || lowerKey.includes(lowerName) || lowerName.includes(lowerKey);
          });
          if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') {
            return String(row[key]).trim();
          }
        }
        return '';
      };

      let firstName = getColumnValue(row, ['First Name', 'first_name', 'FirstName', 'First_Name', 'firstname', 'FIRST NAME', 'fname', 'First']);
      let lastName = getColumnValue(row, ['Last Name', 'last_name', 'LastName', 'Last_Name', 'lastname', 'LAST NAME', 'lname', 'Last']);

      if (!firstName || !lastName) {
        const fullName = getColumnValue(row, ['Name', 'name', 'Full Name', 'FullName', 'Student Name', 'StudentName', 'STUDENT NAME', 'Alumni_name', 'Alumni Name']);
        if (fullName) {
          const nameParts = fullName.split(' ');
          if (!firstName) firstName = nameParts[0] || '';
          if (!lastName) lastName = nameParts.slice(1).join(' ') || '.';
        }
      }
      if (!lastName) lastName = '.';

      const emailRaw = getColumnValue(row, [
        'Email', 'email', 'E-mail', 'Email ID', 'EmailID', 'email_id', 'EMAIL',
        'registered_email_id', 'Registered Email', 'Student Email', 'Personal Email'
      ]);
      const normalizedEmail = emailRaw ? emailRaw.trim().toLowerCase() : '';
      const rollNumber = getColumnValue(row, ['Roll Number', 'roll_number', 'Roll No', 'Admission No', 'Student ID']);

      const student: StudentData = {
        firstName: firstName || 'Unknown',
        lastName: lastName,
        email: normalizedEmail || (rollNumber ? `${rollNumber}@student.tks.com` : ''),
        phone: getColumnValue(row, ['Phone', 'Mobile', 'Contact', 'Phone Number']),
        graduationYear: parseInt(getColumnValue(row, ['Graduation Year', 'Year', 'Passing Year', 'Batch Year'])) || new Date().getFullYear(),
        batch: getColumnValue(row, ['Batch', 'batch']) || 'Class 12',
        course: getColumnValue(row, ['Course', 'Degree', 'Program']),
        branch: getColumnValue(row, ['Branch', 'Department', 'Stream']),
        rollNumber: rollNumber,
        cgpa: getColumnValue(row, ['CGPA', 'GPA']),
        currentCity: getColumnValue(row, ['City', 'Location', 'Current City']),
        currentCompany: getColumnValue(row, ['Company', 'Organization', 'Current Company']),
        currentRole: getColumnValue(row, ['Role', 'Designation', 'Current Role', 'Job Title']),
        linkedinUrl: getColumnValue(row, ['LinkedIn', 'linkedin', 'LinkedIn Profile']),
        university: getColumnValue(row, ['University', 'College', 'University Selection']),
        higherEducationCountry: getColumnValue(row, ['Country', 'Location'])
      };

      return student;
    }).filter(s => s.email && s.email.includes('@'));

    res.json({
      message: 'Preview generated',
      data: parsedData,
      totalCount: jsonData.length,
      parsedCount: parsedData.length
    });
  } catch (error: any) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
}

export async function saveImportedData(req: Request, res: Response) {
  try {
    const { students } = req.body;
    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ error: 'Invalid students data' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const studentData of students) {
      try {
        // Find or create user
        const { data: user } = await adminSupabase
          .from('users')
          .select('id')
          .eq('email', studentData.email)
          .single();

        let userId: string;

        if (user) {
          userId = user.id;
        } else {
          const timestamp = Date.now().toString(36);
          const baseUsername = studentData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const uniqueUsername = `${baseUsername}_${timestamp}`;

          const { data: newUser, error: createError } = await adminSupabase
            .from('users')
            .insert({
              username: uniqueUsername,
              email: studentData.email,
              password: await bcrypt.hash('ChangeMe123!', 10),
              is_admin: false,
              user_role: 'alumni',
              account_approved: true,
              account_blocked: false
            })
            .select('id')
            .single();

          if (createError || !newUser) {
            results.failed++;
            results.errors.push(`${studentData.email}: User creation failed - ${createError?.message}`);
            continue;
          }
          userId = newUser.id;
        }

        // Upsert alumni profile
        const { data: existingAlumni } = await adminSupabase
          .from('alumni')
          .select('id')
          .eq('user_id', userId)
          .single();

        const alumniData = {
          user_id: userId,
          first_name: studentData.firstName,
          last_name: studentData.lastName,
          email: studentData.email,
          phone: studentData.phone,
          graduation_year: studentData.graduationYear,
          batch: studentData.batch,
          course: studentData.course,
          branch: studentData.branch,
          roll_number: studentData.rollNumber,
          cgpa: studentData.cgpa,
          current_city: studentData.currentCity,
          current_company: studentData.currentCompany,
          current_role: studentData.currentRole,
          linkedin_url: studentData.linkedinUrl,
          university: studentData.university,
          higher_education_country: studentData.higherEducationCountry,
          updated_at: new Date().toISOString()
        };

        if (existingAlumni) {
          const { error: updateError } = await adminSupabase
            .from('alumni')
            .update(alumniData)
            .eq('id', existingAlumni.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await adminSupabase
            .from('alumni')
            .insert({
              ...alumniData,
              is_profile_public: true,
              is_verified: false,
              is_active: true
            });
          if (insertError) throw insertError;
        }
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${studentData.email}: ${err.message}`);
      }
    }

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

// For backward compatibility or direct import if needed
export async function importExcelData(req: Request, res: Response) {
  // We can just reuse the internal logic or send a message that this is deprecated
  res.status(400).json({ error: 'Use /api/admin/import-preview and /api/admin/import-save instead' });
}
