const { PrismaClient } = require('@prisma/client');
const { generateFileHash } = require('../utils/aiService');
const { calculateRiskScore } = require('../services/riskEngine');
const crypto = require('crypto');

const prisma = new PrismaClient();

const uploadKYC = async (req, res) => {
    try {
        const studentId = req.user.id;
        const file = req.file;
        const { docType } = req.body; // GOVT_ID, STUDENT_ID, etc.

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Mock Metadata Check (Simulated)
        // In a real app, we would parse EXIF data here.
        // For demo, we flag files with "edited" in the name or if the user is a specific test user.
        const isTampered = file.originalname.toLowerCase().includes('edited');

        if (isTampered) {
            await prisma.fraudLog.create({
                data: {
                    user_id: studentId,
                    event: 'TAMPERED_DOC',
                    details: 'Document metadata indicates editing software used.',
                    ip_address: req.ip || '0.0.0.0'
                }
            });
            return res.status(400).json({ message: 'Security Alert: Document appears to be edited. Upload rejected.' });
        }

        // Generate AI Hash for duplicate detection
        let fileHash = null;
        try {
            fileHash = await generateFileHash(file.path);

            // Check if this specific document has been used before by ANOTHER student
            const duplicateDoc = await prisma.studentDocument.findFirst({
                where: {
                    file_hash: fileHash,
                    student_id: { not: studentId }
                }
            });

            if (duplicateDoc) {
                await prisma.fraudLog.create({
                    data: {
                        user_id: studentId,
                        event: 'DUPLICATE_DOC',
                        details: `Document hash match with another student.`,
                        ip_address: req.ip || '0.0.0.0'
                    }
                });
                return res.status(400).json({
                    message: 'AI Alert: This KYC document has already been used by another student. Duplicate identity detected.'
                });
            }

        } catch (err) {
            console.error("AI Hash Error:", err);
        }

        // Save KYC Document Record
        await prisma.studentDocument.create({
            data: {
                student_id: studentId,
                type: docType || 'GOVT_ID',
                category: 'IDENTITY',
                file_url: file.path,
                file_hash: fileHash,
                status: 'APPROVED' // Auto-approve for demo
            }
        });

        // Update Student Profile Status
        await prisma.studentProfile.update({
            where: { user_id: studentId },
            data: { kyc_status: 'VERIFIED' }
        });

        // Recalculate Risk Score
        await calculateRiskScore(studentId);

        res.json({ message: 'KYC Document uploaded and verified successfully', status: 'VERIFIED' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during KYC upload' });
    }
};

const verifyGuardian = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { guardian_phone, otp } = req.body;

        if (!guardian_phone || !otp) {
            return res.status(400).json({ message: 'Phone and OTP required' });
        }

        // Mock OTP Verification
        if (otp !== '123456') {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        await prisma.studentProfile.update({
            where: { user_id: studentId },
            data: {
                guardian_phone,
                guardian_verified: true,
                trust_score: { increment: 5 }
            }
        });

        await calculateRiskScore(studentId);

        res.json({ message: 'Guardian verified successfully', verified: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getKYCStatus = async (req, res) => {
    try {
        const studentId = req.user.id;
        const profile = await prisma.studentProfile.findUnique({
            where: { user_id: studentId },
            select: {
                kyc_status: true,
                is_campus_verified: true,
                campus_verification_date: true,
                verification_count: true,
                last_proof_token: true,
                guardian_verified: true,
                is_financial_verified: true,
                video_pitch_url: true
            }
        });

        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        res.json({
            status: profile.kyc_status,
            is_campus_verified: profile.is_campus_verified,
            campus_verification_date: profile.campus_verification_date,
            verification_count: profile.verification_count,
            last_proof_token: profile.last_proof_token,
            guardian_verified: profile.guardian_verified,
            is_financial_verified: profile.is_financial_verified,
            video_pitch_url: profile.video_pitch_url
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyFace = async (req, res) => {
    try {
        const studentId = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'Face image capture required' });
        }

        // Simulate AI Analysis
        // In a real app, we would use AWS Rekognition or face-api.js here
        // to compare req.file.path with the stored ID document.
        console.log(`[AI Service] Analyzing face for student ${studentId}...`);
        console.log(`[AI Service] Comparing ${file.path} with ID document...`);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock Result: 98% Match
        const aiResult = {
            match_score: 98.5,
            liveness_check: "PASSED",
            face_detected: true,
            timestamp: new Date()
        };

        await prisma.studentProfile.update({
            where: { user_id: studentId },
            data: {
                is_face_verified: true,
                face_verification_image_url: file.path,
                face_verification_data: JSON.stringify(aiResult)
            }
        });

        await calculateRiskScore(studentId);

        res.json({
            message: 'Face verified successfully',
            status: 'VERIFIED',
            ai_score: 98.5
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during face verification' });
    }
};

const verifyLocation = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { lat, lon, accuracy, timestamp, device_id } = req.body;

        if (!lat || !lon || !accuracy) {
            return res.status(400).json({ message: 'Missing location data' });
        }

        // 1. Campus Polygon Check (Mock: Bangalore Center)
        const CAMPUS_LAT = 12.9716;
        const CAMPUS_LON = 77.5946;

        const distance = Math.sqrt(
            Math.pow(lat - CAMPUS_LAT, 2) + Math.pow(lon - CAMPUS_LON, 2)
        ) * 111.32; // Approx conversion to km

        let zone = "RED";
        let message = "You are outside the campus zone.";
        let verified = false;
        let trustDelta = 0;

        if (distance < 0.5) {
            zone = "GREEN";
            message = "Campus Verified (Inside Zone)";
            verified = true;
            trustDelta = 10;
        } else if (distance < 1.0) {
            zone = "ORANGE";
            message = "Near Campus Zone. Please move closer to the center.";
            // Orange is a warning, not a full verification success for trust score, 
            // but we might record it or ask them to retry.
            // User requirement: "Warning instead of failure... Try again inside campus"
            return res.status(400).json({
                verified: false,
                zone: "ORANGE",
                reason: "near_campus",
                message: "You're outside your registered zone. Try again inside campus."
            });
        } else {
            return res.status(400).json({
                verified: false,
                zone: "RED",
                reason: "outside_campus",
                message: "You are too far from campus."
            });
        }

        // 2. Study Hours Bonus (9 AM - 5 PM)
        const date = new Date();
        const hour = date.getHours();
        let studyHoursBonus = false;
        if (hour >= 9 && hour < 17) {
            trustDelta += 5;
            studyHoursBonus = true;
            message += " + Study Hours Bonus!";
        }

        // 3. Generate Proof Token
        const proofString = `${studentId}-${timestamp}-${lat}-${lon}-${process.env.JWT_SECRET}`;
        const proofToken = crypto.createHash('sha256').update(proofString).digest('hex').substring(0, 16).toUpperCase();

        // 4. Truncate Coordinates
        const truncatedLat = parseFloat(lat.toFixed(3));
        const truncatedLon = parseFloat(lon.toFixed(3));

        const verificationData = JSON.stringify({
            lat: truncatedLat,
            lon: truncatedLon,
            accuracy,
            timestamp,
            device_id,
            zone,
            proof_token: proofToken
        });

        // 5. Update Profile
        await prisma.studentProfile.update({
            where: { user_id: studentId },
            data: {
                is_campus_verified: true,
                campus_verification_date: new Date(),
                campus_verification_data: verificationData,
                trust_score: { increment: trustDelta },
                verification_count: { increment: 1 },
                last_proof_token: proofToken
            }
        });

        await calculateRiskScore(studentId);

        res.json({
            verified: true,
            zone: "GREEN",
            trust_delta: trustDelta,
            study_hours_bonus: studyHoursBonus,
            proof_token: proofToken,
            campus: "Govt Engineering College",
            verified_at: new Date(),
            message: message
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during location verification' });
    }
};

const verifyQR = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { qr_code, device_id } = req.body;

        // Mock Secret QR Code
        const SECRET_QR = "CAMPUS_SECURE_2025";

        if (qr_code !== SECRET_QR) {
            return res.status(400).json({ message: 'Invalid QR Code' });
        }

        const proofToken = "QR-" + crypto.randomBytes(4).toString('hex').toUpperCase();

        await prisma.studentProfile.update({
            where: { user_id: studentId },
            data: {
                is_campus_verified: true,
                campus_verification_date: new Date(),
                campus_verification_data: JSON.stringify({ method: "QR", device_id }),
                trust_score: { increment: 5 }, // Lower trust for QR
                verification_count: { increment: 1 },
                last_proof_token: proofToken
            }
        });

        res.json({
            verified: true,
            method: "QR",
            trust_delta: 5,
            proof_token: proofToken,
            message: "Campus Verified via QR"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during QR verification' });
    }
};

const deleteLocation = async (req, res) => {
    try {
        const studentId = req.user.id;

        await prisma.studentProfile.update({
            where: { user_id: studentId },
            data: {
                is_campus_verified: false,
                campus_verification_date: null,
                campus_verification_data: null,
                last_proof_token: null
                // We do NOT decrement verification_count to keep history
                // We optionally decrement trust score if we want "active" trust only
            }
        });

        res.json({ message: 'Location data deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during location deletion' });
    }
};

const updateBankDetails = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { account_number, ifsc, bank_name } = req.body;

        if (!account_number || !ifsc || !bank_name) {
            return res.status(400).json({ message: 'Bank Name, Account number and IFSC required' });
        }

        // Generate Hash (Account + IFSC)
        const bankString = `${account_number.trim()}-${ifsc.trim().toUpperCase()}`;
        const bankHash = crypto.createHash('sha256').update(bankString).digest('hex');

        // Check for duplicates
        const duplicateBank = await prisma.studentProfile.findFirst({
            where: {
                bank_account_hash: bankHash,
                user_id: { not: studentId }
            }
        });

        if (duplicateBank) {
            await prisma.fraudLog.create({
                data: {
                    user_id: studentId,
                    event: 'DUPLICATE_BANK',
                    details: 'Bank account already in use by another student.',
                    ip_address: req.ip || '0.0.0.0'
                }
            });
            return res.status(400).json({ message: 'Security Alert: This bank account is already linked to another profile.' });
        }

        await prisma.studentProfile.update({
            where: { user_id: studentId },
            data: {
                bank_name,
                bank_account_hash: bankHash,
                is_financial_verified: true // Mark as financially verified for now
            }
        });

        res.json({ message: 'Bank details verified and secured successfully', verified: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during bank verification' });
    }
};

module.exports = { uploadKYC, getKYCStatus, verifyFace, verifyLocation, verifyQR, deleteLocation, verifyGuardian, updateBankDetails };
