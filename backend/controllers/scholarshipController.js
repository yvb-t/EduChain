const { PrismaClient } = require('@prisma/client');
const { generateFileHash, detectFraud } = require('../utils/aiService');
const { calculateRiskScore } = require('../services/riskEngine');

const prisma = new PrismaClient();

const createRequest = async (req, res) => {
    try {
        console.log("🚀 createRequest called");
        console.log("Body:", JSON.stringify(req.body, null, 2));
        console.log("File:", req.file);

        const { title, description, amount, type, studentId, authority_number, institution_contact_number } = req.body;
        const proof_url = req.file ? req.file.path : (req.body.existingProofUrl || null);

        // Check for profile completeness
        const studentProfile = await prisma.studentProfile.findUnique({
            where: { user_id: studentId }
        });

        if (!studentProfile) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        if (!studentProfile.institution_name || !studentProfile.course_name || !studentProfile.phone_number) {
            return res.status(400).json({
                message: 'Incomplete profile. Please update your institution, course, and phone number before requesting a scholarship.'
            });
        }

        // --- KYC CHECK ---
        if (studentProfile.kyc_status !== 'VERIFIED') {
            return res.status(403).json({
                message: 'KYC Required. You must verify your identity by uploading a Government ID before creating a scholarship request.',
                code: 'KYC_REQUIRED'
            });
        }

        // --- PARENT OTP CHECK ---
        if (!studentProfile.parent_phone_verified) {
            return res.status(403).json({
                message: 'Parent Verification Required. Please verify your parent\'s phone number via OTP before requesting a scholarship.',
                code: 'PARENT_VERIFICATION_REQUIRED'
            });
        }
        // --- END CHECKS ---

        // --- DONOR PROTECTION: FROZEN ACCOUNT CHECK ---
        if (studentProfile.is_frozen) {
            return res.status(403).json({
                message: 'Your account has been frozen due to suspicious activity. Please contact support.',
                code: 'ACCOUNT_FROZEN'
            });
        }

        // --- AI & SECURITY CHECKS ---

        // 1. Duplicate Aadhaar Check
        if (authority_number) {
            const duplicateAadhaar = await prisma.scholarshipRequest.findFirst({
                where: {
                    authority_number: authority_number,
                    student_id: { not: studentId } // Allow same student to reuse their own Aadhaar
                }
            });

            if (duplicateAadhaar) {
                return res.status(400).json({
                    message: 'AI Alert: This Aadhaar number is already linked to another student account. Please verify your details.'
                });
            }
        }

        // 2. AI Image Duplicate & Fraud Detection
        let fileHash = null;
        let fraudResult = { status: 'PASSED', score: 0, reason: null };

        if (req.file) {
            try {
                fileHash = await generateFileHash(req.file.path);

                const duplicateImage = await prisma.scholarshipRequest.findFirst({
                    where: {
                        file_hash: fileHash,
                        student_id: { not: studentId } // Allow same student to re-upload same doc
                    }
                });

                if (duplicateImage) {
                    return res.status(400).json({
                        message: 'AI Alert: This document has been detected as a duplicate used by another student. Please upload your own original documents.'
                    });
                }

                // Run Fraud Detection
                fraudResult = await detectFraud(req.file.path);
                if (fraudResult.status === 'FLAGGED') {
                    // We can either block or just flag. Let's block for high scores.
                    if (fraudResult.score > 0.8) {
                        // Log fraud and update risk score
                        await prisma.fraudLog.create({
                            data: {
                                user_id: studentId,
                                event: 'HIGH_RISK_UPLOAD',
                                details: `Scholarship Request Proof rejected. Reason: ${fraudResult.reason}`
                            }
                        });
                        await calculateRiskScore(studentId);

                        return res.status(400).json({
                            message: `AI Security Alert: Document rejected. Reason: ${fraudResult.reason}`
                        });
                    }
                }

            } catch (err) {
                console.error("AI Hash Error:", err);
            }
        }

        // --- VERIFIED REASON CHECK (Mock) ---
        // Validate amount against type
        if (type === 'MICRO' && parseFloat(amount) > 20000) {
            return res.status(400).json({ message: 'Micro scholarships cannot exceed ₹20,000.' });
        }
        if (type === 'BIG' && parseFloat(amount) > 500000) {
            return res.status(400).json({ message: 'Scholarship request exceeds maximum limit of ₹5,00,000.' });
        }

        // --- END AI CHECKS ---

        // 3. Check for existing ACTIVE request
        const activeRequest = await prisma.scholarshipRequest.findFirst({
            where: {
                student_id: studentId,
                status: 'ACTIVE'
            }
        });

        if (activeRequest) {
            return res.status(400).json({ message: 'You already have an active scholarship request. You can only have one active request at a time.' });
        }

        // 4. Check Yearly Limit for Micro Scholarships (Max 3)
        if (type === 'MICRO') {
            const currentYear = new Date().getFullYear();
            const startOfYear = new Date(currentYear, 0, 1);
            const endOfYear = new Date(currentYear, 11, 31);

            const yearlyRequests = await prisma.scholarshipRequest.count({
                where: {
                    student_id: studentId,
                    type: 'MICRO',
                    created_at: {
                        gte: startOfYear,
                        lte: endOfYear
                    }
                }
            });

            if (yearlyRequests >= 3) {
                return res.status(400).json({ message: 'You have reached the limit of 3 Micro Scholarships for this year.' });
            }
        }

        // 5. Check Academic Score for Big Scholarships
        if (type === 'BIG') {
            if (!studentProfile.academic_score || studentProfile.academic_score < 50) {
                return res.status(400).json({ message: 'Big Scholarships require a minimum academic score of 50% or 5.0 CGPA. Please update your profile.' });
            }
        }

        const scholarship = await prisma.scholarshipRequest.create({
            data: {
                student_id: studentId,
                title,
                description,
                amount_requested: parseFloat(amount),
                type,
                authority_number,
                institution_contact_number,
                personal_details: typeof req.body.personal_details === 'object' ? JSON.stringify(req.body.personal_details) : req.body.personal_details,
                category: req.body.category,
                expense_breakdown: typeof req.body.expenses === 'object' ? JSON.stringify(req.body.expenses) : req.body.expenses, // Map 'expenses' from frontend to 'expense_breakdown'
                proof_url,
                file_hash: fileHash,
                status: 'ACTIVE',
                urgency_level: req.body.urgency_level || 'MEDIUM',
                guarantee_opt_in: req.body.guarantee_opt_in === 'true',
                proofs: proof_url ? {
                    create: {
                        file_url: proof_url,
                        type: 'BEFORE',
                        description: 'Initial Proof Document',
                        status: fraudResult.status === 'FLAGGED' ? 'REJECTED' : 'PENDING',
                        ai_fraud_score: fraudResult.score,
                        ai_fraud_reason: fraudResult.reason
                    }
                } : undefined
            }
        });

        res.status(201).json(scholarship);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message, stack: error.stack });
    }
};

const getAllRequests = async (req, res) => {
    try {
        const { studentId, type, minScore, maxAmount, urgency } = req.query;

        const where = {
            status: 'ACTIVE' // Only show active requests by default
        };

        if (studentId) {
            where.student_id = studentId;
            delete where.status; // If specific student, show all statuses
        }

        if (type) {
            where.type = type;
        }

        if (maxAmount) {
            where.amount_requested = {
                lte: parseFloat(maxAmount)
            };
        }

        if (minScore) {
            where.student = {
                academic_score: {
                    gte: parseFloat(minScore)
                }
            };
        }

        const orderBy = {};
        if (urgency === 'high') {
            orderBy.amount_requested = 'asc';
        } else {
            orderBy.created_at = 'desc';
        }

        const requests = await prisma.scholarshipRequest.findMany({
            where,
            include: {
                student: true,
                proofs: true
            },
            orderBy
        });
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getRequestById = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await prisma.scholarshipRequest.findUnique({
            where: { id },
            include: {
                student: {
                    include: {
                        educationRecords: true,
                        portfolio: true
                    }
                },
                donations: true,
                updates: {
                    orderBy: { created_at: 'desc' }
                },
                proofs: true
            }
        });

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        res.json(request);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteRequest = async (req, res) => {
    try {
        const { id } = req.params;

        // Check frozen status
        const requestToCheck = await prisma.scholarshipRequest.findUnique({
            where: { id },
            include: { student: true }
        });

        if (requestToCheck && requestToCheck.student.is_frozen) {
            return res.status(403).json({
                message: 'Your account is frozen. You cannot delete requests.',
                code: 'ACCOUNT_FROZEN'
            });
        }

        // Check if request exists
        const request = await prisma.scholarshipRequest.findUnique({
            where: { id },
            include: { donations: true }
        });

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Check for donations
        if (request.donations.length > 0) {
            return res.status(400).json({ message: 'Cannot delete a request that has received donations.' });
        }

        // Delete related records first (Updates, Proofs)
        await prisma.scholarshipUpdate.deleteMany({
            where: { scholarship_id: id }
        });

        await prisma.proofSubmission.deleteMany({
            where: { scholarship_id: id }
        });

        // Delete the request
        await prisma.scholarshipRequest.delete({
            where: { id }
        });

        res.json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const uploadProof = async (req, res) => {
    try {
        const { id } = req.params; // scholarship_id
        const { type, description } = req.body;
        const file_url = req.file ? req.file.path : null;

        if (!file_url) {
            return res.status(400).json({ message: 'File is required' });
        }

        // Run AI Fraud Check
        const fraudResult = await detectFraud(file_url);

        const proof = await prisma.proofSubmission.create({
            data: {
                scholarship_id: id,
                file_url,
                type: type || 'ADDITIONAL',
                description,
                status: fraudResult.status === 'FLAGGED' ? 'REJECTED' : 'PENDING',
                ai_fraud_score: fraudResult.score,
                ai_fraud_reason: fraudResult.reason
            }
        });

        // Log the check
        await prisma.fraudCheckLog.create({
            data: {
                check_type: 'AI_DOCUMENT_ANALYSIS',
                result: fraudResult.status,
                confidence: fraudResult.score,
                details: `Proof ID: ${proof.id}. Reason: ${fraudResult.reason}`
            }
        });

        res.status(201).json(proof);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateRequest = async (req, res) => {
    try {
        const { id } = req.params; // scholarship_id
        const { title, description } = req.body;
        const image_url = req.file ? req.file.path : null;

        // Check frozen status
        const scholarship = await prisma.scholarshipRequest.findUnique({
            where: { id },
            include: { student: true }
        });

        if (scholarship && scholarship.student.is_frozen) {
            return res.status(403).json({
                message: 'Your account is frozen. You cannot post updates.',
                code: 'ACCOUNT_FROZEN'
            });
        }

        const update = await prisma.scholarshipUpdate.create({
            data: {
                scholarship_id: id,
                title,
                description,
                image_url,
                type: 'UPDATE'
            }
        });

        res.status(201).json(update);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const studentId = req.user.id; // Assuming authMiddleware sets req.user

        // 1. Total Received
        const scholarships = await prisma.scholarshipRequest.findMany({
            where: { student_id: studentId },
            select: { amount_raised: true }
        });

        const totalReceived = scholarships.reduce((sum, s) => sum + parseFloat(s.amount_raised || 0), 0);

        // 2. Active Requests Count
        const activeRequestsCount = await prisma.scholarshipRequest.count({
            where: {
                student_id: studentId,
                status: 'ACTIVE'
            }
        });

        // 3. Recent Activity (Recent 3 requests)
        const recentActivity = await prisma.scholarshipRequest.findMany({
            where: { student_id: studentId },
            orderBy: { created_at: 'desc' },
            take: 3,
            select: {
                id: true,
                title: true,
                status: true,
                created_at: true,
                amount_raised: true,
                amount_requested: true
            }
        });

        // 4. KYC Status & Trust Score
        const studentProfile = await prisma.studentProfile.findUnique({
            where: { user_id: studentId },
            select: {
                kyc_status: true,
                trust_score: true,
                financial_stress_score: true
            }
        });

        res.json({
            totalReceived,
            activeRequestsCount,
            recentActivity,
            kycStatus: studentProfile?.kyc_status || 'PENDING',
            trustScore: studentProfile?.trust_score || 0,
            urgencyScore: (studentProfile?.financial_stress_score || 0) * 10 // Mock calculation
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching dashboard stats' });
    }
};

// Get Urgent Cases (Heat Ranking)
const getUrgentCases = async (req, res) => {
    try {
        // Fetch active scholarships
        const requests = await prisma.scholarshipRequest.findMany({
            where: { status: 'ACTIVE' },
            include: { student: true },
            take: 10
        });

        // Calculate Urgency Score dynamically
        // Formula: (Financial Stress * 0.4) + (Days to Deadline * 0.3) + (Trust Score * 0.3)
        const scoredRequests = requests.map(req => {
            const financialStress = req.student.financial_stress_score * 10; // Scale 0-10 to 0-100

            let deadlineScore = 50;
            if (req.deadline) {
                const daysLeft = Math.ceil((new Date(req.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysLeft < 7) deadlineScore = 100;
                else if (daysLeft < 30) deadlineScore = 70;
                else deadlineScore = 30;
            }

            const trustScore = req.student.trust_score;

            const urgencyScore = (financialStress * 0.4) + (deadlineScore * 0.3) + (trustScore * 0.3);

            return { ...req, urgencyScore: Math.round(urgencyScore) };
        });

        // Sort by Urgency Score Descending
        scoredRequests.sort((a, b) => b.urgencyScore - a.urgencyScore);

        res.json(scoredRequests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching urgent cases' });
    }
};

module.exports = {
    createRequest,
    getAllRequests,
    getRequestById,
    deleteRequest,
    uploadProof,
    updateRequest,
    getDashboardStats,
    getUrgentCases
};
