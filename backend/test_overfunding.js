
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = 'http://localhost:5000/api';

async function main() {
    try {
        console.log("Starting Over-funding Test...");

        // 1. Setup: Create Donor, Student, Scholarship
        const email = `donor_overfund_${Date.now()}@test.com`;
        const password = 'password123';

        // Register/Login Donor
        let token;
        try {
            const regRes = await axios.post(`${API_URL}/auth/register`, { full_name: 'Overfund Tester', email, password, role: 'DONOR' });
            token = regRes.data.token;
        } catch (e) {
            const loginRes = await axios.post(`${API_URL}/auth/login`, { email, password });
            token = loginRes.data.token;
        }

        // Create Student & Scholarship (Goal: 100)
        const studentUser = await prisma.user.create({
            data: {
                email: `student_overfund_${Date.now()}@test.com`,
                password_hash: 'hash',
                role: 'STUDENT',
                studentProfile: { create: { full_name: 'Overfund Student', institution_name: 'Test Inst', course_name: 'Test Course' } }
            }
        });

        const scholarship = await prisma.scholarshipRequest.create({
            data: {
                student_id: studentUser.id,
                type: 'MICRO',
                title: 'Overfund Test',
                description: 'Test',
                amount_requested: 100,
                amount_raised: 0,
                status: 'ACTIVE'
            }
        });
        const scholarshipId = scholarship.id;
        console.log(`Created Scholarship ${scholarshipId} with Goal: 100`);

        // 2. Test 1: Donate 50 (Should Success)
        console.log("Test 1: Donating 50...");
        await axios.post(`${API_URL}/payments/create-order`, {
            amount: 50, currency: 'INR', scholarshipId
        }, { headers: { Authorization: `Bearer ${token}` } });

        // Verify manually (skipping full flow for speed, just checking create-order logic first)
        // Actually, create-order doesn't update DB, verify-payment does. 
        // We need to run verify-payment to update amount_raised.

        // Let's do a full flow for the first 50
        const order1 = await axios.post(`${API_URL}/payments/create-order`, {
            amount: 50, currency: 'INR', scholarshipId
        }, { headers: { Authorization: `Bearer ${token}` } });

        await axios.post(`${API_URL}/payments/verify-payment`, {
            transaction_id: order1.data.transaction_id,
            payment_id: 'pay_test_1',
            signature: 'sig_test_1'
        }, { headers: { Authorization: `Bearer ${token}` } });
        console.log("Test 1 Success. Amount Raised should be 50.");

        // 3. Test 2: Donate 60 (Should Fail - Overfunding)
        console.log("Test 2: Donating 60 (Expected Failure)...");
        try {
            await axios.post(`${API_URL}/payments/create-order`, {
                amount: 60, currency: 'INR', scholarshipId
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.error("Test 2 FAILED: Should have rejected 60.");
        } catch (e) {
            console.log("Test 2 PASSED: Rejected with", e.response?.data?.message);
        }

        // 4. Test 3: Donate 50 (Should Success & Close)
        console.log("Test 3: Donating 50 (Should Success & Close)...");
        const order3 = await axios.post(`${API_URL}/payments/create-order`, {
            amount: 50, currency: 'INR', scholarshipId
        }, { headers: { Authorization: `Bearer ${token}` } });

        await axios.post(`${API_URL}/payments/verify-payment`, {
            transaction_id: order3.data.transaction_id,
            payment_id: 'pay_test_3',
            signature: 'sig_test_3'
        }, { headers: { Authorization: `Bearer ${token}` } });
        console.log("Test 3 Success.");

        // 5. Verify Status
        const finalScholarship = await prisma.scholarshipRequest.findUnique({ where: { id: scholarshipId } });
        console.log("Final Status:", finalScholarship.status);
        console.log("Final Amount Raised:", finalScholarship.amount_raised);

        if (finalScholarship.status === 'FUNDED' && Number(finalScholarship.amount_raised) === 100) {
            console.log("ALL TESTS PASSED");
        } else {
            console.error("FINAL VERIFICATION FAILED");
        }

    } catch (error) {
        console.error("Test Script Error:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
