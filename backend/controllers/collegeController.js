const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const registerCollegeAdmin = async (req, res) => {
    try {
        const { userId, institutionName, email } = req.body;

        // Check if already exists
        const existing = await prisma.collegeAdmin.findUnique({
            where: { email }
        });

        if (existing) {
            return res.status(400).json({ message: 'College Admin already registered with this email.' });
        }

        const admin = await prisma.collegeAdmin.create({
            data: {
                user_id: userId,
                institution_name: institutionName,
                email,
                is_verified: false // Requires super-admin approval (simulated)
            }
        });

        res.status(201).json(admin);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getPendingVerifications = async (req, res) => {
    try {
        const { institutionName } = req.query;

        if (!institutionName) {
            return res.status(400).json({ message: 'Institution name is required' });
        }

        // Find students from this institution with active requests
        const requests = await prisma.scholarshipRequest.findMany({
            where: {
                student: {
                    institution_name: institutionName
                },
                status: 'ACTIVE',
                verified_by_college: false
            },
            include: {
                student: true,
                proofs: true
            }
        });

        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, comments, adminId } = req.body; // status: VERIFIED, REJECTED

        if (!['VERIFIED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        // Update Scholarship Request
        const updatedRequest = await prisma.scholarshipRequest.update({
            where: { id: requestId },
            data: {
                verified_by_college: status === 'VERIFIED',
                verification_status: status === 'VERIFIED' ? 'COLLEGE_VERIFIED' : 'REJECTED'
            }
        });

        // Log Verification Request
        await prisma.verificationRequest.create({
            data: {
                scholarship_id: requestId,
                admin_id: adminId,
                status: status,
                comments: comments
            }
        });

        res.json({ message: `Request ${status.toLowerCase()} successfully`, request: updatedRequest });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { registerCollegeAdmin, getPendingVerifications, verifyRequest };
