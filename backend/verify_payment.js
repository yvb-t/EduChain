const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testPayment() {
    try {
        const timestamp = Date.now();
        const email = `donor_pay_${timestamp}@example.com`;

        // 1. Register Donor
        console.log('--- 1. Registering Donor ---');
        const res1 = await axios.post(`${API_URL}/auth/register`, {
            email: email,
            password: 'password123',
            role: 'DONOR',
            firstName: 'Payment',
            lastName: 'Tester',
            phone_number: `98${timestamp.toString().substring(5)}`
        });
        const token = res1.data.token;
        console.log('Donor Registered. Token:', token ? 'OK' : 'MISSING');

        // 2. Create Order
        console.log('\n--- 2. Creating Payment Order ---');
        const orderRes = await axios.post(`${API_URL}/payments/create-order`, {
            amount: 1000,
            currency: 'INR',
            scholarshipId: null, // General donation
            coverFees: true,
            isAnonymous: false,
            message: "Keep up the good work!"
        }, { headers: { Authorization: `Bearer ${token}` } });

        console.log('Order Created:', orderRes.data);
        const { transaction_id, order_id } = orderRes.data;

        // 3. Verify Payment (Simulate Webhook/Client success)
        console.log('\n--- 3. Verifying Payment ---');
        const verifyRes = await axios.post(`${API_URL}/payments/verify-payment`, {
            transaction_id,
            payment_id: 'pay_mock_123456',
            signature: 'sig_mock_123456'
        }, { headers: { Authorization: `Bearer ${token}` } });

        console.log('Payment Verified:', verifyRes.data);

        // 4. Get History
        console.log('\n--- 4. Fetching Donation History ---');
        const historyRes = await axios.get(`${API_URL}/payments/history`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('History Count:', historyRes.data.length);
        console.log('Latest Transaction Status:', historyRes.data[0].status);

    } catch (error) {
        console.error('Test Failed:', error.response?.data || error.message);
    }
}

testPayment();
