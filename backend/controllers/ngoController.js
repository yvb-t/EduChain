const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create or Update NGO Profile
const createProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, registration_number, website_url, video_url } = req.body;

        // Handle file uploads (Logo/Banner) - simplified for now
        const logo_url = req.files?.logo ? req.files.logo[0].path : null;
        const banner_url = req.files?.banner ? req.files.banner[0].path : null;

        const profile = await prisma.nGOProfile.upsert({
            where: { user_id: userId },
            update: {
                name, description, registration_number, website_url, video_url,
                ...(logo_url && { logo_url }),
                ...(banner_url && { banner_url })
            },
            create: {
                user_id: userId,
                name, description, registration_number, website_url, video_url,
                logo_url, banner_url,
                is_verified: false // Requires admin approval
            }
        });

        res.status(200).json({ message: 'NGO Profile updated', profile });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get All Verified NGOs
const getNGOs = async (req, res) => {
    try {
        const ngos = await prisma.nGOProfile.findMany({
            where: { is_verified: true },
            include: { campaigns: { where: { status: 'ACTIVE' } } }
        });
        res.status(200).json(ngos);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get NGO by ID
const getNGOById = async (req, res) => {
    try {
        const { id } = req.params;
        const ngo = await prisma.nGOProfile.findUnique({
            where: { user_id: id },
            include: {
                campaigns: true,
                transparencyReports: true
            }
        });
        if (!ngo) return res.status(404).json({ message: 'NGO not found' });
        res.status(200).json(ngo);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Create Campaign
const createCampaign = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description, target_amount, end_date } = req.body;
        const image_url = req.file ? req.file.path : null;

        const campaign = await prisma.campaign.create({
            data: {
                ngo_id: userId,
                title, description, target_amount, end_date: new Date(end_date),
                image_url
            }
        });

        res.status(201).json({ message: 'Campaign created', campaign });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Upload Transparency Report
const uploadReport = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description } = req.body;
        const document_url = req.file ? req.file.path : null;

        if (!document_url) return res.status(400).json({ message: 'Document required' });

        const report = await prisma.transparencyReport.create({
            data: {
                ngo_id: userId,
                title, description, document_url
            }
        });

        // Increase Trust Score
        await prisma.nGOProfile.update({
            where: { user_id: userId },
            data: { trust_score: { increment: 10 } }
        });

        res.status(201).json({ message: 'Report uploaded', report });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Verify NGO (Upload Documents)
const verifyNGO = async (req, res) => {
    try {
        const userId = req.user.id;
        const { trust_deed, pan, certificate_80g } = req.body; // Expecting URLs or file paths

        // In a real app, handle file uploads here. For now, assuming URLs are passed or handled by middleware.
        const verification_documents = JSON.stringify({ trust_deed, pan, certificate_80g });

        const ngo = await prisma.nGOProfile.update({
            where: { user_id: userId },
            data: {
                verification_documents,
                verification_status: 'UNDER_REVIEW'
            }
        });

        res.status(200).json({ message: 'Verification documents submitted', ngo });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get NGO Donations
const getDonations = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch donations for campaigns created by this NGO
        const donations = await prisma.donation.findMany({
            where: {
                campaign: {
                    ngo_id: userId
                }
            },
            include: {
                donor: {
                    select: { full_name: true }
                },
                campaign: {
                    select: { title: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        res.status(200).json(donations);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Add Managed Student
const addStudent = async (req, res) => {
    try {
        const userId = req.user.id;
        const { full_name, email, phone_number, institution_name, course_name } = req.body;

        // 1. Create User account for student (managed)
        // Note: In a real app, you might generate a temporary password or invite link.
        // Here we'll create a placeholder user.
        const tempPassword = "ManagedStudent123!"; // Placeholder
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password_hash: hashedPassword,
                role: 'STUDENT',
                is_verified: true // Managed students are verified by NGO
            }
        });

        // 2. Create Student Profile linked to NGO
        const student = await prisma.studentProfile.create({
            data: {
                user_id: user.id,
                full_name,
                phone_number,
                institution_name,
                course_name,
                managed_by_ngo_id: userId,
                is_identity_verified: true // Trusted by NGO
            }
        });

        res.status(201).json({ message: 'Student added successfully', student });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create Impact Story
const createImpactStory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description } = req.body;
        const image_url = req.file ? req.file.path : null;

        const story = await prisma.impactStory.create({
            data: {
                ngo_id: userId,
                title,
                description,
                image_url
            }
        });

        res.status(201).json({ message: 'Impact story created', story });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get Impact Stories
const getImpactStories = async (req, res) => {
    try {
        const userId = req.user.id; // Or req.params.id if public
        const stories = await prisma.impactStory.findMany({
            where: { ngo_id: userId },
            orderBy: { created_at: 'desc' }
        });
        res.status(200).json(stories);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    createProfile,
    getNGOs,
    getNGOById,
    createCampaign,
    uploadReport,
    verifyNGO,
    getDonations,
    addStudent,
    createImpactStory,
    getImpactStories
};
