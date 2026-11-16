const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDonations = async (req, res) => {
    try {
        const { scholarshipId, donorId } = req.query;
        const where = {};

        if (scholarshipId) where.scholarship_id = scholarshipId;

        // If specific donorId requested, use it. 
        // Otherwise, if user is a DONOR, only show their donations.
        if (donorId) {
            where.donor_id = donorId;
        } else if (req.user && req.user.role === 'DONOR') {
            where.donor_id = req.user.id;
        }

        console.log(`Fetching donations with filter:`, where);

        const donations = await prisma.donation.findMany({
            where,
            include: {
                scholarship: {
                    select: { title: true, student: { select: { full_name: true } } } // Changed name to full_name to match schema
                },
                donor: {
                    select: { full_name: true } // Changed name to full_name to match schema
                }
            },
            orderBy: { created_at: 'desc' }
        });

        res.json(donations);
    } catch (error) {
        console.error("Error fetching donations:", error);
        res.status(500).json({ message: 'Server error fetching donations' });
    }
};

const createDonation = async (req, res) => {
    try {
        const { scholarshipId, amount, paymentId, message } = req.body;
        const donorId = req.user.id;

        // 1. Create Donation Record
        const donation = await prisma.donation.create({
            data: {
                scholarship_id: scholarshipId,
                donor_id: donorId,
                amount: parseFloat(amount),
                transaction_id: paymentId || `MOCK-${Date.now()}`,
                status: 'COMPLETED',
                message
            }
        });

        // 2. Update Scholarship Amount Raised
        await prisma.scholarshipRequest.update({
            where: { id: scholarshipId },
            data: {
                amount_raised: {
                    increment: parseFloat(amount)
                }
            }
        });

        // 3. Update Donor Profile (Total Donated & Streak)
        const donorProfile = await prisma.donorProfile.findUnique({ where: { user_id: donorId } });

        if (donorProfile) {
            let newStreak = donorProfile.current_streak;
            const today = new Date();
            const lastDate = donorProfile.last_donation_date ? new Date(donorProfile.last_donation_date) : null;

            if (lastDate) {
                const diffTime = Math.abs(today - lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    // Consecutive day
                    newStreak += 1;
                } else if (diffDays > 1) {
                    // Streak broken
                    newStreak = 1;
                }
                // If diffDays === 0 (same day), streak remains same
            } else {
                // First donation
                newStreak = 1;
            }

            await prisma.donorProfile.update({
                where: { user_id: donorId },
                data: {
                    total_donated: { increment: parseFloat(amount) },
                    current_streak: newStreak,
                    last_donation_date: today
                }
            });

            res.status(201).json({ message: "Donation successful", donation, newStreak });
        } else {
            // Fallback if donor profile missing (shouldn't happen usually)
            res.status(201).json({ message: "Donation successful", donation });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getDonations, createDonation };
