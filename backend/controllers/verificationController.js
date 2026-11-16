const { PrismaClient } = require('@prisma/client');
const { compareFaces } = require('../utils/aiService');

const prisma = new PrismaClient();

// Mock OTP Store (In-memory for demo)
const otpStore = new Map();

const sendParentOTP = async (req, res) => {
    try {
        const { phone } = req.body;
        const userId = req.user.id;

        if (!phone || phone.length < 10) {
            return res.status(400).json({ message: 'Invalid phone number' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store OTP with expiry (5 mins)
        otpStore.set(userId, { otp, phone, expires: Date.now() + 5 * 60 * 1000 });

        console.log(`[MOCK SMS] OTP for ${phone}: ${otp}`); // For demo purposes

        res.json({ message: 'OTP sent successfully to parent\'s phone.', otp });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error sending OTP' });
    }
};

const verifyParentOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.user.id;

        const record = otpStore.get(userId);

        if (!record) {
            return res.status(400).json({ message: 'OTP expired or not requested' });
        }

        if (Date.now() > record.expires) {
            otpStore.delete(userId);
            return res.status(400).json({ message: 'OTP expired' });
        }

        if (record.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Verify in DB
        await prisma.studentProfile.update({
            where: { user_id: userId },
            data: {
                parent_phone_verified: true,
                guardian_phone: record.phone,
                trust_score: { increment: 15 }
            }
        });

        otpStore.delete(userId);
        res.json({ message: 'Parent phone verified successfully!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error verifying OTP' });
    }
};

const verifyFace = async (req, res) => {
    try {
        const userId = req.user.id;
        const { liveImage } = req.body; // Base64 or URL

        if (!liveImage) {
            return res.status(400).json({ message: 'Live image required' });
        }

        const student = await prisma.studentProfile.findUnique({
            where: { user_id: userId }
        });

        if (!student || !student.photo_url) {
            return res.status(400).json({ message: 'Profile photo not found. Please upload a profile photo first.' });
        }

        // Compare Faces
        const result = await compareFaces(student.photo_url, liveImage);

        if (result.match) {
            await prisma.studentProfile.update({
                where: { user_id: userId },
                data: {
                    is_face_verified: true,
                    face_match_score: result.score,
                    trust_score: { increment: 20 }
                }
            });
            res.json({ message: 'Face verification successful!', score: result.score });
        } else {
            res.status(400).json({ message: 'Face verification failed. Please try again.', score: result.score });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during face verification' });
    }
};

const checkDuplicate = async (req, res) => {
    try {
        const { deviceId, bankHash } = req.body;
        const userId = req.user.id;

        // Check Device ID
        if (deviceId) {
            const existingDevice = await prisma.studentProfile.findFirst({
                where: {
                    device_id: deviceId,
                    user_id: { not: userId }
                }
            });

            if (existingDevice) {
                return res.status(400).json({
                    message: 'Duplicate Account Detected: This device is already linked to another student account.',
                    code: 'DUPLICATE_DEVICE'
                });
            }

            // Update Device ID if new
            await prisma.studentProfile.update({
                where: { user_id: userId },
                data: { device_id: deviceId }
            });
        }

        // Check Bank Hash
        if (bankHash) {
            const existingBank = await prisma.studentProfile.findFirst({
                where: {
                    bank_account_hash: bankHash,
                    user_id: { not: userId }
                }
            });

            if (existingBank) {
                return res.status(400).json({
                    message: 'Duplicate Account Detected: This bank account is already in use.',
                    code: 'DUPLICATE_BANK'
                });
            }
        }

        res.json({ message: 'No duplicates found.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error checking duplicates' });
    }
};

module.exports = { sendParentOTP, verifyParentOTP, verifyFace, checkDuplicate };
