const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const exportData = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                studentProfile: {
                    include: {
                        educationRecords: true,
                        portfolio: true,
                        documents: true,
                        scholarships: true
                    }
                },
                donorProfile: {
                    include: {
                        donations: true,
                        transactions: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Remove sensitive data
        const { password_hash, ...userData } = user;

        res.json(userData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error exporting data' });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        // In a real app, we might soft delete or anonymize
        // For this demo, we'll check if they have active scholarships/donations and prevent if so, or just delete

        // Check for active scholarships
        const activeScholarships = await prisma.scholarshipRequest.count({
            where: { student_id: userId, status: 'ACTIVE' }
        });

        if (activeScholarships > 0) {
            return res.status(400).json({ message: 'Cannot delete account with active scholarships. Please cancel them first.' });
        }

        // Delete related data (Prisma cascade should handle this if configured, but let's be safe)
        // For now, we will just delete the User record and let cascade delete profiles
        // Note: In production, you'd want to keep transaction history for legal reasons.

        // Anonymize Donor Profile instead of deleting if they have donations
        const donorProfile = await prisma.donorProfile.findUnique({ where: { user_id: userId } });
        if (donorProfile && donorProfile.total_donated > 0) {
            await prisma.donorProfile.update({
                where: { user_id: userId },
                data: {
                    full_name: 'Deleted User',
                    phone_number: null,
                    address: null,
                    bio: null,
                    email: `deleted_${userId}@educhain.com` // Mock email to satisfy unique constraint if needed, but email is on User
                }
            });

            await prisma.user.update({
                where: { id: userId },
                data: {
                    email: `deleted_${userId}@educhain.com`,
                    password_hash: 'DELETED',
                    is_verified: false
                }
            });

            return res.json({ message: 'Account deleted (anonymized) successfully' });
        }

        await prisma.user.delete({
            where: { id: userId }
        });

        res.json({ message: 'Account deleted successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting account' });
    }
};

module.exports = { exportData, deleteAccount };
