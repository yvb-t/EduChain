const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testLocationVerification() {
    try {
        // 1. Register a new student
        const email = `test_student_${Date.now()}@example.com`;
        const password = 'password123';

        console.log(`Registering user: ${email}`);
        const registerRes = await axios.post(`${API_URL}/auth/register`, {
            email,
            password,
            role: 'STUDENT',
            full_name: 'Test Student'
        });

        const token = registerRes.data.token;
        console.log('Registration successful, token received.');

        // 2. Verify Location (Inside Campus)
        console.log('Testing Location Verification (Inside Campus)...');
        const verifyRes = await axios.post(`${API_URL}/kyc/location-verify`, {
            lat: 12.9716,
            lon: 77.5946,
            accuracy: 10,
            timestamp: new Date().toISOString(),
            device_id: "test_device"
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Verification Response:', verifyRes.data);

        if (verifyRes.data.verified) {
            console.log('SUCCESS: Location verified.');
        } else {
            console.log('FAILED: Location not verified.');
        }

        // 3. Verify Location (Outside Campus)
        console.log('Testing Location Verification (Outside Campus)...');
        try {
            await axios.post(`${API_URL}/kyc/location-verify`, {
                lat: 12.0000,
                lon: 77.0000,
                accuracy: 10,
                timestamp: new Date().toISOString(),
                device_id: "test_device"
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log('SUCCESS: Outside campus rejected as expected.');
            } else {
                console.log('FAILED: Unexpected error for outside campus:', err.message);
            }
        }

    } catch (error) {
        console.error('Test Failed:', error.response ? error.response.data : error.message);
    }
}

testLocationVerification();
