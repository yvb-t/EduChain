const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding Test Users...");

    const passwordHash = await bcrypt.hash("password123", 10);

    // 1. Create Verified Student
    const studentEmail = "verified_student@educhain.com";
    let student = await prisma.user.findUnique({ where: { email: studentEmail } });

    if (!student) {
        student = await prisma.user.create({
            data: {
                email: studentEmail,
                password_hash: passwordHash,
                role: "STUDENT",
                is_verified: true,
                studentProfile: {
                    create: {
                        full_name: "Rahul Verma (Verified)",
                        phone_number: "9876543210",
                        institution_name: "IIT Delhi",
                        course_name: "B.Tech Computer Science",
                        current_year: "3rd Year",
                        academic_score: 9.2,
                        trust_score: 100,
                        trust_level: "GOLD",
                        kyc_status: "VERIFIED",
                        is_identity_verified: true,
                        is_financial_verified: true,
                        is_academic_verified: true,
                        parent_phone_verified: true,
                        is_face_verified: true,
                        bio: "Aspiring software engineer from a humble background. Need support for my final year tuition.",
                        skills: JSON.stringify(["React", "Node.js", "Python"]),
                        goals: JSON.stringify(["Become a Google Engineer", "Support my parents"]),
                        achievements: JSON.stringify([{ title: "Hackathon Winner", date: "2024" }])
                    }
                }
            }
        });
        console.log("✅ Created Verified Student: verified_student@educhain.com");
    } else {
        console.log("ℹ️ Verified Student already exists.");
    }

    // 2. Create Verified Donor
    const donorEmail = "verified_donor@educhain.com";
    let donor = await prisma.user.findUnique({ where: { email: donorEmail } });

    if (!donor) {
        donor = await prisma.user.create({
            data: {
                email: donorEmail,
                password_hash: passwordHash,
                role: "DONOR",
                is_verified: true,
                donorProfile: {
                    create: {
                        full_name: "Vikram Malhotra",
                        total_donated: 55000,
                        impact_points: 1200,
                        club_tier: "GOLD",
                        badges: JSON.stringify(["EARLY_BIRD", "CONST_SUPPORTER"]),
                        bio: "Believer in education for all."
                    }
                }
            }
        });
        console.log("✅ Created Verified Donor: verified_donor@educhain.com");
    } else {
        console.log("ℹ️ Verified Donor already exists.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
