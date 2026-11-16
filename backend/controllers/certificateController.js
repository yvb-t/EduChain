const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const crypto = require('crypto');

const getCertificate = async (req, res) => {
    try {
        const { id } = req.params; // Donation ID

        let donation = await prisma.donation.findUnique({
            where: { id },
            include: {
                donor: true,
                scholarship: {
                    include: {
                        student: true
                    }
                },
                campaign: {
                    include: {
                        ngo: true
                    }
                }
            }
        });

        if (!donation) {
            return res.status(404).json({ message: 'Certificate not found' });
        }

        // Feature: Blockchain Certificate
        // If no hash exists, generate a mock one and save it (Simulating Minting)
        if (!donation.blockchain_tx_hash) {
            const mockHash = '0x' + crypto.createHash('sha256').update(donation.id + Date.now().toString()).digest('hex');

            donation = await prisma.donation.update({
                where: { id },
                data: { blockchain_tx_hash: mockHash },
                include: {
                    donor: true,
                    scholarship: { include: { student: true } },
                    campaign: { include: { ngo: true } }
                }
            });
        }

        // Determine Badge Level based on total donated
        let badge = "BRONZE";
        const totalDonated = parseFloat(donation.donor.total_donated);
        if (totalDonated > 50000) badge = "DIAMOND";
        else if (totalDonated > 20000) badge = "GOLD";
        else if (totalDonated > 5000) badge = "SILVER";

        const certificateData = {
            id: donation.id,
            date: donation.created_at,
            donorName: donation.donor.full_name,
            amount: donation.amount,
            recipientName: donation.scholarship ? donation.scholarship.student.full_name : donation.campaign.ngo.name,
            recipientType: donation.scholarship ? "Student" : "NGO",
            cause: donation.scholarship ? donation.scholarship.title : donation.campaign.title,
            badgeLevel: badge,
            signature: "EduChain_Official_Sig_" + new Date().getFullYear(),
            verifyUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/certificate/${donation.id}`,
            txHash: donation.blockchain_tx_hash // Include Hash
        };

        res.json(certificateData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error generating certificate' });
    }
};

module.exports = { getCertificate };
