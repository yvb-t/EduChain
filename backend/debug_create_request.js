const { PrismaClient } = require('@prisma/client');
const { generateFileHash, detectFraud } = require('./utils/aiService');
const { calculateRiskScore } = require('./services/riskEngine');

const prisma = new PrismaClient();

// Mock Response Object
const res = {
    status: function (code) {
        console.log(`[Response Status]: ${code}`);
        return this;
    },
    json: function (data) {
        console.log(`[Response JSON]:`, JSON.stringify(data, null, 2));
        return this;
    }
};

async function main() {
    try {
        // 1. Get a student
        const student = await prisma.user.findFirst({
            where: { role: 'STUDENT' },
            include: { studentProfile: true }
        });

        if (!student) {
            console.error("No student found!");
            return;
        }

        console.log(`Using Student ID: ${student.id}`);

        // 2. Mock Request Object
        const req = {
            body: {
                title: "Debug Scholarship",
                description: "This is a debug request.",
                amount: "5000",
                type: "MICRO",
                studentId: student.id,
                authority_number: "AUTH123",
                institution_contact_number: "9876543210",
                personal_details: JSON.stringify({ parentName: "Debug Parent", currentAddress: "Debug Address" }),
                category: "Tuition",
                expenses: JSON.stringify([{ id: 1, item: "Tuition", cost: "5000" }]),
                urgency_level: "MEDIUM",
                guarantee_opt_in: "false"
            },
            file: null // Test without file first
        };

        // 3. Run Controller Logic (Copied & Adapted)
        console.log("🚀 createRequest called (DEBUG MODE)");

        const { title, description, amount, type, studentId, authority_number, institution_contact_number } = req.body;
        const proof_url = req.file ? req.file.path : (req.body.existingProofUrl || null);

        // Check for profile completeness
        const studentProfile = await prisma.studentProfile.findUnique({
            where: { user_id: studentId }
        });

        if (!studentProfile) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        console.log("Student Profile Found:", studentProfile.user_id);

        // Skip some checks for debug if needed, but let's keep them to see if they fail
        // ... (Skipping profile completeness checks for now to focus on DB insert, or maybe they are failing?)

        // Let's assume profile is complete enough or we'll see the error.

        // ... (Skipping KYC/Parent checks for now as they might block us if the random student isn't verified)
        // Actually, let's bypass them for the test to see if INSERT works.
        // If the user's error is "Server error", it's likely the INSERT or logic AFTER checks.

        // ... (Skipping AI checks)

        // Create Scholarship
        console.log("Attempting to create scholarship...");

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
                expense_breakdown: typeof req.body.expenses === 'object' ? JSON.stringify(req.body.expenses) : req.body.expenses,
                proof_url,
                file_hash: null,
                status: 'ACTIVE',
                urgency_level: req.body.urgency_level || 'MEDIUM',
                guarantee_opt_in: req.body.guarantee_opt_in === 'true',
                // proofs: undefined
            }
        });

        console.log("Scholarship Created Successfully!");
        res.status(201).json(scholarship);

    } catch (error) {
        console.error("❌ ERROR CAUGHT:");
        console.error(error);
        res.status(500).json({ message: error.message, stack: error.stack });
    } finally {
        await prisma.$disconnect();
    }
}

main();
