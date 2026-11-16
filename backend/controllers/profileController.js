const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            full_name, phone_number, address, bio, institution_name, course_name, academic_score, gps_location,
            alternate_phone, permanent_address, current_address, emergency_contact,
            dob, gender, parent_name, parent_occupation, family_annual_income,
            roll_number, current_year, attendance_percentage,
            social_links, skills, goals, achievements, video_pitch_url
        } = req.body;
        const role = req.user.role;

        const { calculateTrustScore, calculateFinancialStressScore } = require('../utils/scoreService');

        if (role === 'STUDENT') {
            // Calculate scores
            // We need current profile data merged with updates to calculate accurately.
            // For simplicity, we'll just use the incoming data + existing data fetch if needed.
            // But here we are doing an upsert.

            // Let's just calculate based on what we have in req.body for now, 
            // ideally we should fetch the full profile first.
            // But upsert makes it tricky without a read.
            // Let's do a read-modify-write or just update what we can.

            // Actually, let's fetch the existing profile first to merge.
            const existingProfile = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
            const mergedProfile = { ...existingProfile, ...req.body };

            // Mock KYC status (should be fetched from User or separate KYC table)
            // Assuming we have kyc_status in StudentProfile or User. 
            // Schema says kyc_status is in StudentProfile.
            const trustScore = calculateTrustScore(mergedProfile, mergedProfile.kyc_status || 'PENDING');
            const fssScore = calculateFinancialStressScore(mergedProfile);

            await prisma.studentProfile.upsert({
                where: { user_id: userId },
                update: {
                    full_name,
                    phone_number,
                    bio,
                    institution_name,
                    course_name,
                    academic_score: academic_score ? parseFloat(academic_score) : undefined,
                    gps_location,
                    alternate_phone,
                    permanent_address,
                    current_address,
                    emergency_contact,
                    dob: dob ? new Date(dob) : undefined,
                    gender,
                    parent_name,
                    parent_occupation,
                    family_annual_income: family_annual_income ? parseFloat(family_annual_income) : undefined,
                    roll_number,
                    current_year,
                    attendance_percentage: attendance_percentage ? parseFloat(attendance_percentage) : undefined,
                    social_links: social_links ? JSON.stringify(social_links) : undefined,
                    skills: skills ? JSON.stringify(skills) : undefined,
                    goals: goals ? JSON.stringify(goals) : undefined,
                    achievements: achievements ? JSON.stringify(achievements) : undefined,
                    video_pitch_url,
                    trust_score: trustScore,
                    financial_stress_score: fssScore
                },
                create: {
                    user_id: userId,
                    full_name,
                    phone_number,
                    bio,
                    institution_name,
                    course_name,
                    academic_score: academic_score ? parseFloat(academic_score) : undefined,
                    gps_location,
                    alternate_phone,
                    permanent_address,
                    current_address,
                    emergency_contact,
                    dob: dob ? new Date(dob) : undefined,
                    gender,
                    parent_name,
                    parent_occupation,
                    family_annual_income: family_annual_income ? parseFloat(family_annual_income) : undefined,
                    roll_number,
                    current_year,
                    attendance_percentage: attendance_percentage ? parseFloat(attendance_percentage) : undefined,
                    social_links: social_links ? JSON.stringify(social_links) : undefined,
                    skills: skills ? JSON.stringify(skills) : undefined,
                    goals: goals ? JSON.stringify(goals) : undefined,
                    achievements: achievements ? JSON.stringify(achievements) : undefined,
                    video_pitch_url,
                    trust_score: trustScore,
                    financial_stress_score: fssScore
                }
            });
        } else if (role === 'DONOR') {
            await prisma.donorProfile.upsert({
                where: { user_id: userId },
                update: {
                    full_name,
                    phone_number,
                    address,
                    bio,
                },
                create: {
                    user_id: userId,
                    full_name,
                    phone_number,
                    address,
                    bio,
                }
            });
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const addPortfolioItem = async (req, res) => {
    try {
        const { title, description } = req.body;
        const image_url = req.file ? req.file.path : null;
        const studentId = req.user.id;

        if (!image_url) {
            return res.status(400).json({ message: 'Image is required' });
        }

        const item = await prisma.portfolioItem.create({
            data: {
                student_id: studentId,
                title,
                description,
                image_url
            }
        });

        res.status(201).json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getPortfolio = async (req, res) => {
    try {
        const { studentId } = req.params;
        const items = await prisma.portfolioItem.findMany({
            where: { student_id: studentId },
            orderBy: { date: 'desc' }
        });
        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const addEducationRecord = async (req, res) => {
    try {
        const { level, institution, score, max_score, year_of_passing } = req.body;
        const marksheet_url = req.file ? req.file.path : null;
        const studentId = req.user.id;

        const record = await prisma.educationRecord.create({
            data: {
                student_id: studentId,
                level,
                institution,
                score: parseFloat(score),
                max_score: parseFloat(max_score),
                year_of_passing: parseInt(year_of_passing),
                marksheet_url
            }
        });

        res.status(201).json(record);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getEducationRecords = async (req, res) => {
    try {
        const { studentId } = req.params;
        const records = await prisma.educationRecord.findMany({
            where: { student_id: studentId },
            orderBy: { year_of_passing: 'desc' }
        });
        res.json(records);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const addTimelineEvent = async (req, res) => {
    try {
        const { title, description, icon, date } = req.body;
        const studentId = req.user.id;

        const event = await prisma.timelineEvent.create({
            data: {
                student_id: studentId,
                title,
                description,
                icon: icon || 'CHECK',
                date: date ? new Date(date) : new Date()
            }
        });

        res.status(201).json(event);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getTimelineEvents = async (req, res) => {
    try {
        const { studentId } = req.params;
        const events = await prisma.timelineEvent.findMany({
            where: { student_id: studentId },
            orderBy: { date: 'desc' }
        });
        res.json(events);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const uploadVideoPitch = async (req, res) => {
    try {
        const studentId = req.user.id;
        const video_url = req.file ? req.file.path : null;

        if (!video_url) {
            return res.status(400).json({ message: 'Video file is required' });
        }

        await prisma.studentProfile.update({
            where: { user_id: studentId },
            data: { video_pitch_url: video_url }
        });

        res.json({ message: 'Video pitch uploaded successfully', video_url });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during video upload' });
    }
};

module.exports = { updateProfile, addPortfolioItem, getPortfolio, addEducationRecord, getEducationRecords, addTimelineEvent, getTimelineEvents, uploadVideoPitch };
