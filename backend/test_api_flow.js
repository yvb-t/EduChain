
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = 'http://localhost:5000/api';

async function main() {
    try {
        console.log("Starting API flow test (Hybrid)...");

        // 1. Login (or Register) to get token for Donor
        const email = `donor_api_${Date.now()}@test.com`;
        const password = 'password123';

        let token;

        try {
            console.log("Registering donor...");
            const regRes = await axios.post(`${API_URL}/auth/register`, {
                full_name: 'API Test Donor',
                email,
                password,
                role: 'DONOR'
            });
            token = regRes.data.token;
        } catch (e) {
            console.log("Registration failed, maybe user exists. Trying login...");
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                email,
                password
            });
            token = loginRes.data.token;
        }
        console.log("Got Donor token");

        // 2. Create Student and Scholarship directly in DB
        console.log("Creating student and scholarship in DB...");
        const studentUser = await prisma.user.create({
            data: {
                email: `student_hybrid_${Date.now()}@test.com`,
                password_hash: 'hash',
                role: 'STUDENT',
                studentProfile: {
                    create: {
                        full_name: 'Hybrid Student',
                        user_id: undefined,
                        institution_name: 'Test Inst',
                        course_name: 'Test Course',
                        phone_number: '1234567890'
                    }
                }
            }
        });

        const scholarship = await prisma.scholarshipRequest.create({
            data: {
                student_id: studentUser.id,
                type: 'MICRO',
                title: 'Hybrid Test Scholarship',
                description: 'Test',
                amount_requested: 5000,
                amount_raised: 0,
                status: 'ACTIVE'
            }
        });
        const scholarshipId = scholarship.id;
        console.log("Created scholarship:", scholarshipId);

        // 3. Create Order
        console.log("Creating order...");
        const amount = 500;
        const orderRes = await axios.post(`${API_URL}/payments/create-order`, {
            amount,
            currency: 'INR',
            scholarshipId, // Passing it here
            isAnonymous: false
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const { transaction_id, order_id } = orderRes.data;
        console.log("Order created. Transaction ID:", transaction_id);

        // 4. Verify Payment
        console.log("Verifying payment...");
        const verifyRes = await axios.post(`${API_URL}/payments/verify-payment`, {
            transaction_id,
            payment_id: 'pay_test_' + Date.now(),
            signature: 'sig_test_' + Date.now()
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Verification response:", verifyRes.data);

        // 5. Check Scholarship Amount via API
        console.log("Checking scholarship amount...");
        const checkRes = await axios.get(`${API_URL}/scholarships/${scholarshipId}`);
        const raised = checkRes.data.amount_raised;
        console.log("Amount Raised:", raised);

        if (Number(raised) === Number(amount)) {
            console.log("SUCCESS: Amount raised matches donation.");
        } else {
            console.error(`FAILURE: Expected ${amount}, got ${raised}`);
        }

    } catch (error) {
        console.error("Test Failed Error Message:", error.response?.data?.error || error.message);
        if (error.response?.data?.stack) console.error("Stack:", error.response.data.stack.split('\n')[0]);
    } finally {
        await prisma.$disconnect();
    }
}

main();
