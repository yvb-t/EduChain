
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Starting debug script...");

        // 1. Create a dummy user (Student)
        const studentUser = await prisma.user.create({
            data: {
                email: `student_${Date.now()}@test.com`,
                password_hash: 'hash',
                role: 'STUDENT',
                studentProfile: {
                    create: {
                        full_name: 'Test Student',
                        user_id: undefined
                    }
                }
            }
        });
        console.log("Created student:", studentUser.id);

        // 2. Create a dummy scholarship
        const scholarship = await prisma.scholarshipRequest.create({
            data: {
                student_id: studentUser.id,
                type: 'MICRO',
                title: 'Test Scholarship',
                description: 'Test',
                amount_requested: 1000,
                amount_raised: 0
            }
        });
        console.log("Created scholarship:", scholarship.id, "Raised:", scholarship.amount_raised);

        // 3. Create a dummy transaction (simulating a completed payment)
        // We'll skip the donor creation for brevity and just use a fake ID if constraints allow, 
        // but schema enforces relations. So need a donor.
        const donorUser = await prisma.user.create({
            data: {
                email: `donor_${Date.now()}@test.com`,
                password_hash: 'hash',
                role: 'DONOR',
                donorProfile: {
                    create: {
                        full_name: 'Test Donor',
                        user_id: undefined
                    }
                }
            }
        });

        const amountToDonate = 100.50; // Use a float to test Decimal

        const transaction = await prisma.transaction.create({
            data: {
                amount: amountToDonate,
                currency: 'INR',
                status: 'SUCCESS',
                donor_id: donorUser.id,
                scholarship_id: scholarship.id,
                payment_gateway_ref: 'debug_ref'
            }
        });
        console.log("Created transaction:", transaction.id, "Amount:", transaction.amount);

        // 4. Perform the update logic exactly as in the controller
        console.log("Attempting to increment amount_raised...");

        // Fetch transaction again to ensure we have the Decimal object type that the controller would have
        const fetchedTx = await prisma.transaction.findUnique({ where: { id: transaction.id } });

        await prisma.scholarshipRequest.update({
            where: { id: scholarship.id },
            data: { amount_raised: { increment: fetchedTx.amount } }
        });

        // 5. Verify
        const updatedScholarship = await prisma.scholarshipRequest.findUnique({ where: { id: scholarship.id } });
        console.log("Updated Scholarship Raised:", updatedScholarship.amount_raised);

        if (Number(updatedScholarship.amount_raised) === Number(amountToDonate)) {
            console.log("SUCCESS: Amount deducted (raised) correctly.");
        } else {
            console.error("FAILURE: Amount mismatch.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
