const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Calculates and updates the Risk Score for a student.
 * @param {string} studentId 
 */
const calculateRiskScore = async (studentId) => {
    try {
        const student = await prisma.studentProfile.findUnique({
            where: { user_id: studentId },
            include: {
                user: true
            }
        });

        if (!student) return;

        let score = 0; // 0 to 100 (High is bad)
        let reasons = [];

        // 1. KYC Status
        if (student.kyc_status !== 'VERIFIED') {
            score += 20;
            reasons.push("KYC Not Verified");
        }

        // 2. Profile Completeness
        if (!student.institution_name || !student.course_name) {
            score += 10;
            reasons.push("Incomplete Profile");
        }

        // 3. Campus Verification
        if (!student.is_campus_verified) {
            score += 15;
            reasons.push("Campus Not Verified");
        }

        // 4. Face Verification
        if (!student.is_face_verified) {
            score += 15;
            reasons.push("Face Not Verified");
        }

        // 5. Fraud Logs (Past Flags)
        const fraudLogs = await prisma.fraudLog.count({
            where: { user_id: studentId }
        });

        if (fraudLogs > 0) {
            score += (fraudLogs * 15);
            reasons.push(`Found ${fraudLogs} previous security flags`);
        }

        // 6. Suspicious Login History (Multiple IPs)
        const uniqueIPs = await prisma.loginHistory.groupBy({
            by: ['ip_address'],
            where: { user_id: studentId },
        });

        if (uniqueIPs.length > 3) {
            score += 10;
            reasons.push(`Suspicious Activity: Logged in from ${uniqueIPs.length} different IPs`);
        }

        // 7. Trust Score Inverse
        if (student.trust_score < 20) {
            score += 10;
        }

        // Cap at 100
        score = Math.min(score, 100);

        // Auto-Freeze if Critical Risk
        let isFrozen = student.is_frozen;
        if (score >= 80 && !isFrozen) {
            isFrozen = true;
            reasons.push("Auto-Frozen due to Critical Risk Score");

            // Log the freeze event
            await prisma.fraudLog.create({
                data: {
                    user_id: studentId,
                    event: 'AUTO_FREEZE',
                    details: `Risk Score hit ${score}. Reasons: ${reasons.join(", ")}`
                }
            });
        }

        // Update DB
        await prisma.studentProfile.update({
            where: { user_id: studentId },
            data: {
                risk_score: score,
                is_frozen: isFrozen
            }
        });

        console.log(`[RiskEngine] Student ${studentId} Score: ${score}. Frozen: ${isFrozen}`);
        return { score, isFrozen, reasons };

    } catch (error) {
        console.error("[RiskEngine] Error:", error);
    }
};

module.exports = { calculateRiskScore };
